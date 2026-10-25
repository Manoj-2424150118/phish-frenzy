const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const BANK = require('./questions');
const { generateFromText } = require('./quizgen');

async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  try {
    const pageCount = Math.min(doc.numPages, 30); // cap: one huge PDF must not stall the game server
    const pages = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      pages.push(tc.items.map(it => it.str).join(' '));
    }
    return pages.join('\n').slice(0, 100000);
  } finally {
    await doc.destroy().catch(() => {});
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 250000 });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

// ---------- state ----------
const rooms = new Map();
const pendingQuizzes = new Map(); // token -> { questions, title, createdAt }

app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, ts: Date.now() }));

// ---------- custom quiz generation ----------
function storeQuiz(questions, title) {
  if (pendingQuizzes.size >= 100) {
    const oldest = pendingQuizzes.keys().next().value;
    pendingQuizzes.delete(oldest);
  }
  const token = crypto.randomBytes(9).toString('hex');
  pendingQuizzes.set(token, { questions, title: title || 'Custom notes quiz', createdAt: Date.now() });
  return token;
}
setInterval(() => { // quiz tokens are pre-room scratch state: expire after 2h, cap the map
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [t, q] of pendingQuizzes.entries()) if (q.createdAt < cutoff) pendingQuizzes.delete(t);
}, 10 * 60 * 1000).unref();

app.post('/api/quiz/from-text', (req, res) => {
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const { questions, reason } = generateFromText(body.text || '');
  if (!questions.length) return res.status(422).json({ ok: false, error: reason || 'Could not build a quiz from that text.' });
  const token = storeQuiz(questions, body.title);
  res.json({ ok: true, token, count: questions.length, note: reason || undefined });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });
app.post('/api/quiz/from-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file received.' });
    const name = (req.file.originalname || '').toLowerCase();
    let text = '';
    if (name.endsWith('.pdf') || req.file.mimetype === 'application/pdf') {
      text = await extractPdfText(req.file.buffer);
    } else if (name.endsWith('.txt') || name.endsWith('.md') || req.file.mimetype.startsWith('text/')) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(422).json({ ok: false, error: 'Please upload a PDF, TXT or MD file — or paste your notes instead.' });
    }
    const { questions, reason } = generateFromText(text);
    if (!questions.length) return res.status(422).json({ ok: false, error: reason || 'Could not build a quiz from that file.' });
    const token = storeQuiz(questions, req.file.originalname);
    res.json({ ok: true, token, count: questions.length, note: reason || undefined });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Could not read that file. Try pasting the notes text instead.' });
  }
});
// JSON error shape for upload/parse errors (never Express HTML stack pages)
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(422).json({ ok: false, error: 'File is too large — maximum 6 MB.' });
  if (err) return res.status(400).json({ ok: false, error: 'That request could not be processed.' });
  next();
});

// ---------- rooms & game ----------
const ROUNDS = 10;
const QUESTION_MS = Number.isFinite(Number(process.env.QUESTION_MS)) && Number(process.env.QUESTION_MS) > 0 ? Number(process.env.QUESTION_MS) : 25000;
const ROUND_END_MS = Number.isFinite(Number(process.env.ROUND_END_MS)) && Number(process.env.ROUND_END_MS) > 0 ? Number(process.env.ROUND_END_MS) : 5000;
const MAX_ROOMS = 500;
const MAX_PLAYERS = 12;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
const asObj = p => (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
const cleanName = n => String(n || 'Player').trim().slice(0, 16) || 'Player';

function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, streak: p.streak,
    isHost: p.id === room.hostId, isBot: !!p.isBot, connected: p.connected,
    spectator: !!p.spectator
  })).sort((a, b) => b.score - a.score);
}
function broadcastState(room) {
  io.to(room.code).emit('room_state', {
    code: room.code, phase: room.phase, players: publicPlayers(room),
    round: room.round, totalRounds: room.totalRounds, hostId: room.hostId,
    sourceTitle: room.sourceTitle
  });
}
function broadcastBoard(room) { io.to(room.code).emit('leaderboard', { players: publicPlayers(room) }); }
function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }
function clearBotTimers(room) { (room.botTimers || []).forEach(t => clearTimeout(t)); room.botTimers = []; }
function activePlayers(room) { return [...room.players.values()].filter(p => (p.connected || p.isBot) && !p.spectator); }
function anyConnectedHuman(room) { return [...room.players.values()].some(p => p.connected && !p.isBot); }

// Room-code lifecycle (product rule): a code is deleted ONLY when the game has
// finished AND every player has left. Unfinished rooms with players never expire.
function maybeDeleteRoom(room) {
  if (room.finished && !anyConnectedHuman(room)) {
    clearTimer(room); clearBotTimers(room);
    rooms.delete(room.code);
    return true;
  }
  return false;
}
// Safety sweep: a room abandoned in the lobby (nobody connected, never played)
// for 6+ hours is reaped so memory/codes can't leak forever. Active or
// in-progress rooms are never touched.
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const room of rooms.values()) {
    if (room.phase === 'lobby' && !room.finished && !anyConnectedHuman(room) && room.createdAt < cutoff) {
      clearTimer(room); clearBotTimers(room); rooms.delete(room.code);
    }
  }
}, 30 * 60 * 1000).unref();

function startGame(room) {
  clearBotTimers(room);
  room.deck = shuffle(room.source).slice(0, Math.min(ROUNDS, room.source.length));
  room.totalRounds = room.deck.length;
  room.round = 0;
  room.finished = false;
  room.gameSeq = (room.gameSeq || 0) + 1;
  for (const p of room.players.values()) { p.score = 0; p.streak = 0; }
  nextQuestion(room);
}

function nextQuestion(room) {
  clearTimer(room); clearBotTimers(room);
  if (room.round >= room.deck.length) return endGame(room);
  if (!anyConnectedHuman(room)) return endGame(room); // nobody left to play: finish & retire cleanly
  const q = room.deck[room.round];
  const order = shuffle(q.options.map((_, i) => i));
  room.current = {
    options: order.map(i => q.options[i]),
    correctIndex: order.indexOf(q.answer),
    explain: q.explain,
    salt: crypto.randomBytes(8).toString('hex')
  };
  room.current.commit = crypto.createHash('sha256')
    .update(room.current.salt + '|' + room.current.options[room.current.correctIndex]).digest('hex');
  room.phase = 'question';
  room.answers = new Map();
  room.questionStartedAt = Date.now();
  room.questionSeq = (room.questionSeq || 0) + 1;
  const seq = room.questionSeq;
  io.to(room.code).emit('question', {
    round: room.round + 1, totalRounds: room.totalRounds,
    scenario: q.scenario || null, prompt: q.prompt,
    options: room.current.options, timeMs: QUESTION_MS,
    commit: room.current.commit,
    players: publicPlayers(room)
  });
  broadcastState(room);

  for (const p of room.players.values()) {
    if (!p.isBot) continue;
    const delay = 3000 + Math.random() * 14000;
    const t = setTimeout(() => {
      if (room.questionSeq !== seq || room.phase !== 'question' || room.answers.has(p.id)) return; // stale timer guard
      const smart = Math.random() < 0.62;
      const pick = smart ? room.current.correctIndex : Math.floor(Math.random() * room.current.options.length);
      submitAnswer(room, p, pick);
    }, delay);
    room.botTimers.push(t);
  }
  room.timer = setTimeout(() => endRound(room), QUESTION_MS + 400);
}

function submitAnswer(room, player, optionIndex) {
  if (room.phase !== 'question' || room.answers.has(player.id)) return;
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= room.current.options.length) return;
  const elapsed = Date.now() - room.questionStartedAt;
  const correct = optionIndex === room.current.correctIndex;
  let gain = 0, speedBonus = 0, streakBonus = 0;
  if (correct) {
    speedBonus = Math.max(0, Math.round(100 * (1 - elapsed / QUESTION_MS)));
    player.streak += 1;
    streakBonus = player.streak >= 3 ? 25 : 0;
    gain = 100 + speedBonus + streakBonus;
    player.score += gain;
  } else player.streak = 0;
  room.answers.set(player.id, { optionIndex, correct, gain });

  const sock = io.sockets.sockets.get(player.id);
  if (sock) sock.emit('answer_result', {
    correct,
    correctText: room.current.options[room.current.correctIndex],
    explain: room.current.explain,
    gain, base: correct ? 100 : 0, speedBonus, streakBonus,
    yourScore: player.score, streak: player.streak
  });
  broadcastBoard(room);
  io.to(room.code).emit('answer_count', { answered: room.answers.size, total: activePlayers(room).length });
  if (room.answers.size >= activePlayers(room).length) endRound(room);
}

function endRound(room) {
  if (room.phase !== 'question') return;
  clearTimer(room); clearBotTimers(room);
  room.phase = 'round_end';
  io.to(room.code).emit('round_end', {
    round: room.round + 1,
    correctIndex: room.current.correctIndex,
    correctText: room.current.options[room.current.correctIndex],
    explain: room.current.explain,
    salt: room.current.salt, commit: room.current.commit,
    players: publicPlayers(room)
  });
  broadcastState(room);
  room.round += 1;
  room.timer = setTimeout(() => nextQuestion(room), ROUND_END_MS);
}

function endGame(room) {
  clearTimer(room); clearBotTimers(room);
  room.phase = 'podium';
  room.finished = true;
  const players = publicPlayers(room);
  const top = players.length ? players[0].score : 0;
  const winners = players.filter(p => p.score === top && top > 0).map(p => p.name);
  io.to(room.code).emit('game_over', { players, winners });
  broadcastState(room);
  maybeDeleteRoom(room);
}

function removePlayer(socket, { explicit }) {
  const code = socket.data.code;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  const player = room.players.get(socket.id);
  socket.data.code = undefined;
  if (!player) return;
  if (explicit) room.players.delete(socket.id); else player.connected = false;
  if (room.hostId === socket.id) {
    const next = [...room.players.values()].find(p => p.connected && !p.isBot);
    if (next) room.hostId = next.id;
  }
  socket.leave(code);
  if (!maybeDeleteRoom(room)) broadcastState(room);
}

function joinFailsThrottled(socket) {
  const now = Date.now();
  socket.data.joinFails = (socket.data.joinFails || []).filter(t => now - t < 60000);
  return socket.data.joinFails.length >= 10;
}

io.on('connection', (socket) => {
  socket.on('create_room', (payload, cb) => {
    const { name, mode, quizToken } = asObj(payload);
    const reply = typeof cb === 'function' ? cb : () => {};
    if (socket.data.code) removePlayer(socket, { explicit: true }); // never haunt two rooms
    if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'The arena is full right now — try again in a bit.' });
    let source = BANK, sourceTitle = 'Phish Frenzy — Scam-Spotting Bank';
    if (typeof quizToken === 'string' && pendingQuizzes.has(quizToken)) {
      const pq = pendingQuizzes.get(quizToken);
      source = pq.questions; sourceTitle = 'Custom quiz: ' + pq.title;
    }
    const code = makeCode();
    const room = {
      code, phase: 'lobby', players: new Map(), hostId: socket.id,
      round: 0, totalRounds: ROUNDS, deck: [], answers: new Map(),
      timer: null, botTimers: [], questionStartedAt: 0, questionSeq: 0, gameSeq: 0,
      finished: false, source, sourceTitle, current: null, createdAt: Date.now()
    };
    room.players.set(socket.id, { id: socket.id, name: cleanName(name), score: 0, streak: 0, connected: true });
    if (mode === 'bots') {
      ['RoboRita 🤖', 'ByteBot 🤖'].forEach((bn, i) => {
        const id = `bot-${code}-${i}`;
        room.players.set(id, { id, name: bn, score: 0, streak: 0, connected: true, isBot: true });
      });
    }
    rooms.set(code, room);
    socket.data.code = code;
    socket.join(code);
    reply({ ok: true, code, sourceTitle });
    broadcastState(room);
  });

  socket.on('join_room', (payload, cb) => {
    const { name, code } = asObj(payload);
    const reply = typeof cb === 'function' ? cb : () => {};
    if (joinFailsThrottled(socket)) return reply({ ok: false, error: 'Too many wrong codes — wait a minute and try again.' });
    const cleanCode = String(code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) {
      socket.data.joinFails = [...(socket.data.joinFails || []), Date.now()];
      return reply({ ok: false, error: 'Room not found. Check the code — codes stay valid until a game finishes and everyone leaves.' });
    }
    if (socket.data.code && socket.data.code !== cleanCode) removePlayer(socket, { explicit: true });
    if (socket.data.code === cleanCode && room.players.has(socket.id)) return reply({ ok: true, code: cleanCode });
    if (room.players.size >= MAX_PLAYERS) return reply({ ok: false, error: 'That room is full (12 players max).' });
    const clean = cleanName(name);

    // Resume: a disconnected player rejoining the lobby under the same name
    // reclaims their seat, score and (if applicable) host role.
    if (room.phase === 'lobby' || room.phase === 'podium') {
      const ghost = [...room.players.values()].find(p => !p.isBot && !p.connected && p.name === clean);
      if (ghost) {
        room.players.delete(ghost.id);
        if (room.hostId === ghost.id) room.hostId = socket.id;
        room.players.set(socket.id, { id: socket.id, name: clean, score: ghost.score, streak: ghost.streak, connected: true });
        socket.data.code = cleanCode; socket.join(cleanCode);
        reply({ ok: true, code: cleanCode, resumed: true });
        broadcastState(room);
        return;
      }
      // Host rescue: if the host entry is gone or offline, the joiner takes over.
      const hostEntry = room.players.get(room.hostId);
      if (!hostEntry || (!hostEntry.connected && !hostEntry.isBot)) room.hostId = socket.id;
      // Prune stale offline entries while in the lobby.
      for (const [pid, p] of room.players.entries()) if (!p.connected && !p.isBot && pid !== room.hostId) room.players.delete(pid);
    }

    if (room.phase === 'question' || room.phase === 'round_end') {
      room.players.set(socket.id, { id: socket.id, name: clean, score: 0, streak: 0, connected: true, spectator: true });
      socket.data.code = cleanCode; socket.join(cleanCode);
      reply({ ok: true, code: cleanCode, spectator: true });
      broadcastState(room);
      return;
    }
    if (room.finished) { room.phase = 'lobby'; room.finished = false; }
    room.players.set(socket.id, { id: socket.id, name: clean, score: 0, streak: 0, connected: true });
    socket.data.code = cleanCode;
    socket.join(cleanCode);
    reply({ ok: true, code: cleanCode });
    broadcastState(room);
  });

  socket.on('start_game', () => {
    const room = rooms.get(socket.data.code);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'lobby' && room.phase !== 'podium') return;
    for (const p of room.players.values()) if (p.spectator) p.spectator = false;
    startGame(room);
  });

  socket.on('answer', (payload) => {
    const { optionIndex } = asObj(payload);
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || player.spectator) return;
    submitAnswer(room, player, optionIndex);
  });

  socket.on('play_again', () => {
    const room = rooms.get(socket.data.code);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'podium') return; // phase-gated: no mid-round resets
    clearTimer(room); clearBotTimers(room);
    room.phase = 'lobby'; room.finished = false;
    broadcastState(room);
  });

  socket.on('leave_room', () => removePlayer(socket, { explicit: true }));
  socket.on('disconnect', () => removePlayer(socket, { explicit: false }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Phish Frenzy listening on :${PORT}`));
