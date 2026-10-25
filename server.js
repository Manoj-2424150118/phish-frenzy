const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');

async function extractPdfText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map(it => it.str).join(' '));
  }
  return pages.join('\n');
}
const BANK = require('./questions');
const { generateFromText } = require('./quizgen');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, ts: Date.now() }));

// ---------- Custom quiz generation (paste notes or upload PDF/txt) ----------
const pendingQuizzes = new Map(); // token -> { questions, title }

function storeQuiz(questions, title) {
  const token = crypto.randomBytes(9).toString('hex');
  pendingQuizzes.set(token, { questions, title: title || 'Custom notes quiz' });
  return token;
}

app.post('/api/quiz/from-text', (req, res) => {
  const { text, title } = req.body || {};
  const { questions, reason } = generateFromText(text || '');
  if (!questions.length) return res.status(422).json({ ok: false, error: reason || 'Could not build a quiz from that text.' });
  const token = storeQuiz(questions, title);
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

// ---------- Rooms & game ----------
const ROUNDS = 10;
const QUESTION_MS = Number(process.env.QUESTION_MS || 25000);
const ROUND_END_MS = Number(process.env.ROUND_END_MS || 5000);
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rooms = new Map();

function makeCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, streak: p.streak,
    isHost: p.id === room.hostId, isBot: !!p.isBot, connected: p.connected
  })).sort((a, b) => b.score - a.score);
}
function broadcastState(room) {
  io.to(room.code).emit('room_state', {
    code: room.code, phase: room.phase, players: publicPlayers(room),
    round: room.round, totalRounds: room.totalRounds, hostId: room.hostId,
    sourceTitle: room.sourceTitle
  });
}
function broadcastBoard(room) {
  io.to(room.code).emit('leaderboard', { players: publicPlayers(room) });
}
function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null; } }

// Room-code lifecycle (per product rule): a code is deleted ONLY when the game
// has finished AND every player has left. Unfinished rooms never expire.
function maybeDeleteRoom(room) {
  const anyConnectedHuman = [...room.players.values()].some(p => p.connected && !p.isBot);
  if (room.finished && !anyConnectedHuman) {
    clearTimer(room);
    rooms.delete(room.code);
    return true;
  }
  return false;
}

function startGame(room) {
  room.deck = shuffle(room.source).slice(0, Math.min(ROUNDS, room.source.length));
  room.totalRounds = room.deck.length;
  room.round = 0;
  room.finished = false;
  for (const p of room.players.values()) { p.score = 0; p.streak = 0; }
  nextQuestion(room);
}

function nextQuestion(room) {
  clearTimer(room);
  if (room.round >= room.deck.length) return endGame(room);
  const q = room.deck[room.round];
  // Shuffle options server-side; the correct answer NEVER leaves the server
  // before a player answers. Clients only get a SHA-256 commitment so the
  // answer can be verified as fixed once revealed.
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
    setTimeout(() => {
      if (room.phase !== 'question' || room.answers.has(p.id)) return;
      const smart = Math.random() < 0.62;
      const pick = smart ? room.current.correctIndex : Math.floor(Math.random() * room.current.options.length);
      submitAnswer(room, p, pick);
    }, delay);
  }
  room.timer = setTimeout(() => endRound(room), QUESTION_MS + 400);
}

function submitAnswer(room, player, optionIndex) {
  if (room.phase !== 'question' || room.answers.has(player.id)) return;
  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= room.current.options.length) return;
  const elapsed = Date.now() - room.questionStartedAt;
  const correct = optionIndex === room.current.correctIndex;
  let gain = 0;
  if (correct) {
    const speedBonus = Math.max(0, Math.round(100 * (1 - elapsed / QUESTION_MS)));
    player.streak += 1;
    gain = 100 + speedBonus + (player.streak >= 3 ? 25 : 0);
    player.score += gain;
  } else player.streak = 0;
  room.answers.set(player.id, { optionIndex, correct, gain });

  // Instant, private feedback to the player who answered
  const sock = io.sockets.sockets.get(player.id);
  if (sock) sock.emit('answer_result', {
    correct,
    correctText: room.current.options[room.current.correctIndex],
    explain: room.current.explain,
    gain, yourScore: player.score
  });
  // Realtime leaderboard + progress for everyone
  broadcastBoard(room);
  io.to(room.code).emit('answer_count', {
    answered: room.answers.size,
    total: [...room.players.values()].filter(p => p.connected || p.isBot).length
  });
  const active = [...room.players.values()].filter(p => p.connected || p.isBot);
  if (room.answers.size >= active.length) endRound(room);
}

function endRound(room) {
  if (room.phase !== 'question') return;
  clearTimer(room);
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
  clearTimer(room);
  room.phase = 'podium';
  room.finished = true;
  io.to(room.code).emit('game_over', { players: publicPlayers(room) });
  broadcastState(room);
}

function removePlayer(socket, { explicit }) {
  const code = socket.data.code;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  const player = room.players.get(socket.id);
  if (!player) return;
  if (explicit) room.players.delete(socket.id); else player.connected = false;
  if (room.hostId === socket.id) {
    const next = [...room.players.values()].find(p => p.connected && !p.isBot);
    if (next) room.hostId = next.id;
  }
  socket.leave(code);
  if (!maybeDeleteRoom(room)) broadcastState(room);
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name, mode, quizToken } = {}, cb) => {
    const clean = String(name || 'Player').trim().slice(0, 16) || 'Player';
    let source = BANK, sourceTitle = 'Phish Frenzy — Scam-Spotting Bank';
    if (quizToken && pendingQuizzes.has(quizToken)) {
      const pq = pendingQuizzes.get(quizToken);
      source = pq.questions; sourceTitle = 'Custom quiz: ' + pq.title;
    }
    const code = makeCode();
    const room = {
      code, phase: 'lobby', players: new Map(), hostId: socket.id,
      round: 0, totalRounds: ROUNDS, deck: [], answers: new Map(),
      timer: null, questionStartedAt: 0, finished: false, source, sourceTitle, current: null
    };
    room.players.set(socket.id, { id: socket.id, name: clean, score: 0, streak: 0, connected: true });
    if (mode === 'bots') {
      ['RoboRita 🤖', 'ByteBot 🤖'].forEach((bn, i) => {
        const id = `bot-${code}-${i}`;
        room.players.set(id, { id, name: bn, score: 0, streak: 0, connected: true, isBot: true });
      });
    }
    rooms.set(code, room);
    socket.data.code = code;
    socket.join(code);
    if (cb) cb({ ok: true, code, sourceTitle });
    broadcastState(room);
  });

  socket.on('join_room', ({ name, code } = {}, cb) => {
    const cleanCode = String(code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) return cb && cb({ ok: false, error: 'Room not found. Check the code — codes stay valid until a game finishes and everyone leaves.' });
    if (room.phase === 'question' || room.phase === 'round_end') {
      // Late joiners wait in the lobby and join the NEXT game in this room,
      // or spectate the scoreboard now.
      room.players.set(socket.id, { id: socket.id, name: String(name || 'Player').trim().slice(0, 16) || 'Player', score: 0, streak: 0, connected: true, spectator: true });
      socket.data.code = cleanCode; socket.join(cleanCode);
      if (cb) cb({ ok: true, code: cleanCode, spectator: true });
      broadcastState(room);
      return;
    }
    if (room.finished) { room.phase = 'lobby'; room.finished = false; }
    room.players.set(socket.id, { id: socket.id, name: String(name || 'Player').trim().slice(0, 16) || 'Player', score: 0, streak: 0, connected: true });
    socket.data.code = cleanCode;
    socket.join(cleanCode);
    if (cb) cb({ ok: true, code: cleanCode });
    broadcastState(room);
  });

  socket.on('start_game', () => {
    const room = rooms.get(socket.data.code);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'lobby' && room.phase !== 'podium') return;
    for (const [id, p] of room.players.entries()) if (p.spectator) { p.spectator = false; }
    startGame(room);
  });

  socket.on('answer', ({ optionIndex } = {}) => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || player.spectator) return;
    submitAnswer(room, player, optionIndex);
  });

  socket.on('play_again', () => {
    const room = rooms.get(socket.data.code);
    if (!room || room.hostId !== socket.id) return;
    room.phase = 'lobby'; room.finished = false;
    broadcastState(room);
  });

  socket.on('leave_room', () => removePlayer(socket, { explicit: true }));
  socket.on('disconnect', () => removePlayer(socket, { explicit: false }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Phish Frenzy listening on :${PORT}`));
