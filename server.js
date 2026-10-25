const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QUESTIONS = require('./questions');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, ts: Date.now() }));

const ROUNDS = 10;
const QUESTION_MS = 20000;
const REVEAL_MS = 8000;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const rooms = new Map();

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function publicPlayers(room) {
  return [...room.players.values()].map(p => ({
    id: p.id, name: p.name, score: p.score, streak: p.streak,
    isHost: p.id === room.hostId, isBot: !!p.isBot, connected: p.connected
  })).sort((a, b) => b.score - a.score);
}

function roomState(room) {
  return {
    code: room.code,
    phase: room.phase,
    players: publicPlayers(room),
    round: room.round,
    totalRounds: ROUNDS,
    hostId: room.hostId
  };
}

function broadcast(room) {
  io.to(room.code).emit('room_state', roomState(room));
}

function clearTimers(room) {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
}

function startGame(room) {
  room.deck = shuffle(QUESTIONS).slice(0, ROUNDS);
  room.round = 0;
  for (const p of room.players.values()) { p.score = 0; p.streak = 0; p.lastGain = 0; }
  nextQuestion(room);
}

function nextQuestion(room) {
  clearTimers(room);
  if (room.round >= ROUNDS) return endGame(room);
  const q = room.deck[room.round];
  room.phase = 'question';
  room.answers = new Map();
  room.questionStartedAt = Date.now();
  io.to(room.code).emit('question', {
    round: room.round + 1,
    totalRounds: ROUNDS,
    channel: q.channel,
    sender: q.sender,
    message: q.message,
    timeMs: QUESTION_MS,
    players: publicPlayers(room)
  });
  broadcast(room);

  // Bots answer after a random delay
  for (const p of room.players.values()) {
    if (!p.isBot) continue;
    const delay = 2500 + Math.random() * 11000;
    setTimeout(() => {
      if (room.phase !== 'question' || room.answers.has(p.id)) return;
      const correct = Math.random() < 0.62;
      const answer = correct ? q.isScam : !q.isScam;
      submitAnswer(room, p, answer);
    }, delay);
  }

  room.timer = setTimeout(() => reveal(room), QUESTION_MS + 400);
}

function submitAnswer(room, player, isScamGuess) {
  if (room.phase !== 'question' || room.answers.has(player.id)) return false;
  const q = room.deck[room.round];
  const elapsed = Date.now() - room.questionStartedAt;
  const correct = isScamGuess === q.isScam;
  let gain = 0;
  if (correct) {
    const speedBonus = Math.max(0, Math.round(100 * (1 - elapsed / QUESTION_MS)));
    player.streak += 1;
    const streakBonus = player.streak >= 3 ? 25 : 0;
    gain = 100 + speedBonus + streakBonus;
    player.score += gain;
  } else {
    player.streak = 0;
  }
  player.lastGain = gain;
  room.answers.set(player.id, { guess: isScamGuess, correct, gain });

  io.to(room.code).emit('answer_count', {
    answered: room.answers.size,
    total: [...room.players.values()].filter(p => p.connected || p.isBot).length
  });

  const active = [...room.players.values()].filter(p => p.connected || p.isBot);
  if (room.answers.size >= active.length) reveal(room);
  return true;
}

function reveal(room) {
  if (room.phase !== 'question') return;
  clearTimers(room);
  room.phase = 'reveal';
  const q = room.deck[room.round];
  const results = {};
  for (const [pid, a] of room.answers.entries()) results[pid] = a;
  io.to(room.code).emit('reveal', {
    round: room.round + 1,
    isScam: q.isScam,
    redFlag: q.redFlag,
    results,
    players: publicPlayers(room)
  });
  broadcast(room);
  room.round += 1;
  room.timer = setTimeout(() => nextQuestion(room), REVEAL_MS);
}

function endGame(room) {
  clearTimers(room);
  room.phase = 'podium';
  io.to(room.code).emit('game_over', { players: publicPlayers(room) });
  broadcast(room);
}

function leaveRoom(socket) {
  const code = socket.data.code;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  const player = room.players.get(socket.id);
  if (player) player.connected = false;
  // Host migration
  if (room.hostId === socket.id) {
    const next = [...room.players.values()].find(p => p.connected && !p.isBot);
    if (next) room.hostId = next.id;
  }
  const anyHuman = [...room.players.values()].some(p => p.connected && !p.isBot);
  if (!anyHuman) {
    clearTimers(room);
    rooms.delete(code);
    return;
  }
  socket.leave(code);
  broadcast(room);
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name, bots } = {}, cb) => {
    const clean = String(name || 'Player').trim().slice(0, 16) || 'Player';
    const code = makeCode();
    const room = {
      code, phase: 'lobby', players: new Map(), hostId: socket.id,
      round: 0, deck: [], answers: new Map(), timer: null, questionStartedAt: 0
    };
    room.players.set(socket.id, { id: socket.id, name: clean, score: 0, streak: 0, lastGain: 0, connected: true });
    if (bots) {
      const botNames = ['RoboRita 🤖', 'ByteBot 🤖'];
      botNames.forEach((bn, i) => {
        const id = `bot-${code}-${i}`;
        room.players.set(id, { id, name: bn, score: 0, streak: 0, lastGain: 0, connected: true, isBot: true });
      });
    }
    rooms.set(code, room);
    socket.data.code = code;
    socket.join(code);
    if (cb) cb({ ok: true, code });
    broadcast(room);
  });

  socket.on('join_room', ({ name, code } = {}, cb) => {
    const cleanCode = String(code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) return cb && cb({ ok: false, error: 'Room not found. Check the code.' });
    if (room.phase === 'question' || room.phase === 'reveal') {
      return cb && cb({ ok: false, error: 'Game already in progress. Wait for the next round in the lobby.' });
    }
    if (room.phase === 'podium') room.phase = 'lobby';
    const clean = String(name || 'Player').trim().slice(0, 16) || 'Player';
    room.players.set(socket.id, { id: socket.id, name: clean, score: 0, streak: 0, lastGain: 0, connected: true });
    socket.data.code = cleanCode;
    socket.join(cleanCode);
    if (cb) cb({ ok: true, code: cleanCode });
    broadcast(room);
  });

  socket.on('start_game', () => {
    const room = rooms.get(socket.data.code);
    if (!room || room.hostId !== socket.id) return;
    if (room.phase !== 'lobby' && room.phase !== 'podium') return;
    startGame(room);
  });

  socket.on('answer', ({ isScam } = {}) => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    submitAnswer(room, player, !!isScam);
  });

  socket.on('play_again', () => {
    const room = rooms.get(socket.data.code);
    if (!room || room.hostId !== socket.id) return;
    room.phase = 'lobby';
    broadcast(room);
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Phish Frenzy listening on :${PORT}`));
