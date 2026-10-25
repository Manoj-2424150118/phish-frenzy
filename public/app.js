/* Phish Frenzy client — speaks the server.js protocol exactly:
   create_room {name, mode?, quizToken} · join_room {name, code} · answer {optionIndex}
   events: room_state, question, answer_result, answer_count, leaderboard, round_end, game_over */
const socket = io();
let myId = null, isHost = false, timerInt = null, quizToken = null;
let answered = false, iAmSpectator = false, wasConnected = false;
let currentPrompt = '', missed = [], myPicked = -1, currentScreen = 'home', activeTotal = 0;

const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'podium'];
const show = n => {
  screens.forEach(s => $('screen-' + s).classList.toggle('active', s === n));
  if (n !== currentScreen) { currentScreen = n; const el = $('screen-' + n); if (el) el.focus({ preventScroll: true }); }
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const myName = () => $('name-input').value.trim() || 'Player';

socket.on('connect', () => {
  myId = socket.id;
  $('conn-banner').classList.add('hidden');
  // After a drop, rejoin the same room with the same name to reclaim the seat.
  if (wasConnected) {
    try {
      const saved = JSON.parse(sessionStorage.getItem('pf_room') || 'null');
      if (saved && saved.code && !saved.left) {
        $('name-input').value = saved.name;
        setTimeout(() => enterRoom('join_room', { code: saved.code }), 400);
      }
    } catch (_) {}
  }
});
socket.on('disconnect', () => { $('conn-banner').classList.remove('hidden'); wasConnected = true; });

function rememberRoom(code) { try { sessionStorage.setItem('pf_room', JSON.stringify({ code, name: myName() })); } catch (_) {} }
function forgetRoom() { try { sessionStorage.setItem('pf_room', JSON.stringify({ left: true })); } catch (_) {} }

/* ---------- Home actions (debounced, with a visible busy state) ---------- */
function setBusy(btn, busy) {
  if (!btn) return;
  btn.classList.toggle('busy', !!busy);
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
}
function enterRoom(event, payload) {
  const btn = event === 'create_room'
    ? (payload && payload.mode === 'bots' ? $('btn-bots') : $('btn-create'))
    : $('btn-join');
  if (btn && btn.dataset.busy === '1') return;
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; setBusy(btn, true); }
  $('home-error').textContent = '';
  socket.emit(event, Object.assign({ name: myName() }, payload || {}), res => {
    if (btn) { delete btn.dataset.busy; btn.disabled = false; setBusy(btn, false); }
    if (!res || !res.ok) { $('home-error').textContent = (res && res.error) || 'Something blocked the door — give it another tap.'; show('home'); }
  });
}
$('btn-bots').onclick = () => enterRoom('create_room', { mode: 'bots', quizToken });
$('btn-create').onclick = () => enterRoom('create_room', { quizToken });
$('btn-join').onclick = () => {
  const code = $('code-input').value.trim().toUpperCase();
  if (code.length !== 4) { $('home-error').textContent = 'Room codes are 4 letters — check the code and try again.'; return; }
  enterRoom('join_room', { code });
};
$('code-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-create').click(); });

/* ---------- Custom quiz from notes / file ---------- */
function quizReady(token, count, source) {
  quizToken = token;
  $('quiz-status').style.color = 'var(--success-text)';
  $('quiz-status').textContent = '✅ Custom quiz ready — ' + count + ' questions built from ' + source + '. Now create a room or play vs Bots and your room will use THIS quiz.';
  $('quiz-reset-row').classList.remove('hidden');
  $('quiz-loaded-note').classList.remove('hidden');
}
function quizFailed(msg) {
  quizToken = null;
  $('quiz-status').style.color = 'var(--danger-text)';
  $('quiz-status').textContent = msg;
  $('quiz-loaded-note').classList.add('hidden');
}
$('quiz-reset').onclick = () => {
  quizToken = null;
  $('quiz-status').style.color = 'var(--success-text)';
  $('quiz-status').textContent = 'Back to the built-in scam-spotting bank for your next room.';
  $('quiz-reset-row').classList.add('hidden');
  $('quiz-loaded-note').classList.add('hidden');
};
$('btn-notes').onclick = async () => {
  const notes = $('notes-input').value.trim();
  if (notes.length < 200) { quizFailed('Paste a bit more — at least a few paragraphs of notes (200+ characters).'); return; }
  $('quiz-status').style.color = 'var(--text-2)';
  $('quiz-status').textContent = 'Analysing your notes and building questions…';
  setBusy($('btn-notes'), true);
  try {
    const r = await fetch('/api/quiz/from-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: notes }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.token) quizReady(j.token, j.count, 'your notes'); else quizFailed(j.error || 'Something went wrong building the quiz. Try again.');
  } catch (_) { quizFailed('Something went wrong building the quiz. Try again.'); }
  setBusy($('btn-notes'), false);
};
$('file-input').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = ''; // reset so picking the same file again re-fires change
  if (!f) return;
  $('quiz-status').style.color = 'var(--text-2)';
  $('quiz-status').textContent = 'Reading ' + f.name + ' and building questions…';
  try {
    const fd = new FormData(); fd.append('file', f);
    const r = await fetch('/api/quiz/from-file', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.token) quizReady(j.token, j.count, f.name); else quizFailed(j.error || 'Could not read that file. Try pasting the notes instead.');
  } catch (_) { quizFailed('Could not read that file. Try pasting the notes instead.'); }
});

/* ---------- Shared player rendering ---------- */
function playerRows(players, withRank) {
  return players.map((p, i) => {
    const streak = p.streak >= 3 ? ' <span class="streak">🔥' + p.streak + '</span>' : '';
    const you = p.id === myId ? '<span class="you-tag">You</span>' : '';
    const away = p.connected === false;
    return '<li class="' + (p.id === myId ? 'me' : '') + (away ? ' away' : '') + '">' +
      '<span class="pname">' + (withRank ? (i + 1) + '. ' : '') + esc(p.name) + (p.isHost ? ' 👑' : '') + (p.spectator ? ' 👀' : '') + (away ? ' (away)' : '') + you + '</span>' +
      '<span class="pscore">' + p.score + streak + '</span></li>';
  }).join('');
}

/* ---------- Room state / lobby / board ---------- */
socket.on('room_state', st => {
  isHost = st.hostId === myId;
  const me = (st.players || []).find(p => p.id === myId);
  iAmSpectator = !!(me && me.spectator);
  rememberRoom(st.code);
  if (st.phase === 'lobby') {
    show('lobby');
    $('lobby-code').textContent = st.code;
    $('lobby-eyebrow').textContent = isHost ? 'Your room is open' : "You're in";
    $('host-line').textContent = isHost
      ? "👑 You're the host — you press Start when your crew is in."
      : '👑 marks the host — only they can start the game.';
    const src = st.sourceTitle || 'Phish Frenzy — Scam-Spotting Bank';
    $('lobby-source').textContent = 'Quiz: ' + src + ' • ' + (st.totalRounds || 10) + ' questions this game';
    $('spectator-note').classList.toggle('hidden', !iAmSpectator);
    $('players-heading').textContent = 'Players (' + st.players.length + ')';
    $('lobby-players').innerHTML = playerRows(st.players, false);
    const humans = st.players.filter(p => !p.isBot).length;
    const hasBots = st.players.some(p => p.isBot);
    $('solo-note').classList.toggle('hidden', !(humans === 1 && !hasBots));
    $('btn-start').classList.toggle('hidden', !(isHost && !iAmSpectator));
    $('lobby-wait').textContent = iAmSpectator
      ? 'You are watching this game — you will play from the next one.'
      : (isHost ? '' : 'Waiting for the host to start…');
    $('lobby-wait').style.display = isHost ? 'none' : '';
  } else if (st.phase === 'question' || st.phase === 'round_end') {
    if (currentScreen !== 'game') show('game');
    $('board').innerHTML = playerRows(st.players, true);
  }
  // phase 'podium' is rendered by game_over; nothing extra needed here.
});
socket.on('leaderboard', data => {
  if (data && data.players) $('board').innerHTML = playerRows(data.players, true);
});
socket.on('answer_count', data => {
  if (data) $('answered-label').textContent = data.answered + '/' + data.total + ' answered';
});

$('btn-copy').onclick = async () => {
  const code = $('lobby-code').textContent;
  try { await navigator.clipboard.writeText(code); } catch (_) {
    const r = document.createRange(); r.selectNodeContents($('lobby-code'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    try { document.execCommand('copy'); } catch (__) {}
    sel.removeAllRanges();
  }
  const b = $('btn-copy');
  b.textContent = '✅ Copied';
  setTimeout(() => { b.textContent = '📋 Copy code'; }, 1500);
};
$('btn-start').onclick = () => socket.emit('start_game');
$('btn-again').onclick = () => socket.emit('play_again');
const leave = () => { forgetRoom(); socket.emit('leave_room'); missed = []; show('home'); };
$('btn-leave-lobby').onclick = leave;
$('btn-leave-game').onclick = leave;
$('btn-leave-podium').onclick = leave;

/* ---------- Game flow ---------- */
function startTimer(seconds) {
  clearInterval(timerInt);
  const end = Date.now() + seconds * 1000;
  const bar = $('timerbar'), fill = $('timer-fill'), text = $('timer-text');
  bar.setAttribute('aria-valuemax', String(seconds));
  let lastShown = -1;
  const tick = () => {
    const left = Math.max(0, (end - Date.now()) / 1000);
    fill.style.width = (left / seconds * 100) + '%';
    const s = Math.ceil(left);
    if (s !== lastShown) { // 1Hz text/aria updates
      lastShown = s;
      text.textContent = s + 's';
      bar.setAttribute('aria-valuenow', String(s));
      const urgent = s <= 5 && s > 0;
      text.classList.toggle('urgent', urgent);
      bar.classList.toggle('urgent', urgent);
    }
    if (left <= 0) clearInterval(timerInt);
  };
  tick();
  timerInt = setInterval(tick, 100);
}
socket.on('question', q => {
  show('game');
  answered = false; myPicked = -1;
  if (q.round === 1) missed = [];
  currentPrompt = q.prompt;
  activeTotal = (q.players || []).filter(p => !p.spectator).length;
  $('round-label').textContent = 'Round ' + q.round + '/' + q.totalRounds;
  $('answered-label').textContent = '0/' + activeTotal + ' answered';
  if (q.players) $('board').innerHTML = playerRows(q.players, true);
  if (q.scenario) { $('q-scenario').textContent = q.scenario; $('q-scenario').classList.remove('hidden'); }
  else $('q-scenario').classList.add('hidden');
  $('q-prompt').textContent = q.prompt;
  const fb = $('feedback'); fb.className = 'feedback hidden'; fb.innerHTML = '';
  $('hash-line').textContent = '🔒 The answer is already locked in — nobody can peek at it or change it.';
  $('hash-proof').classList.add('hidden');
  const letters = ['A', 'B', 'C', 'D'];
  $('options').innerHTML = q.options.map((o, i) =>
    '<button class="opt" data-i="' + i + '"><span class="chip">' + letters[i] + '</span><span class="otext">' + esc(o) + '</span><span class="mark"></span></button>'
  ).join('');
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (answered) return;
    answered = true; myPicked = Number(b.dataset.i);
    document.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x !== b) x.classList.add('softdim'); });
    b.classList.add('picked');
    b.insertAdjacentHTML('beforeend', '<span class="you-tag">You</span>');
    const fb2 = $('feedback');
    fb2.className = 'feedback waiting';
    fb2.innerHTML = '<p class="fb-head">Locked in — waiting for everyone else…</p>';
    if (window.innerWidth < 601) setTimeout(() => fb2.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    socket.emit('answer', { optionIndex: myPicked });
  });
  startTimer(Math.round((q.timeMs || 25000) / 1000));
});
socket.on('answer_result', r => {
  const fb = $('feedback');
  const breakdown = ['100 for the answer'];
  if (r.speedBonus) breakdown.push('+' + r.speedBonus + ' for speed');
  if (r.streakBonus) breakdown.push('+' + r.streakBonus + ' streak bonus 🔥');
  if (r.correct) {
    fb.className = 'feedback good';
    fb.innerHTML = '<p class="fb-head">✅ Correct! +' + r.gain + ' pts</p>' +
      '<p class="fb-sub">' + breakdown.join(' · ') + ' — your score: ' + r.yourScore + '</p>' +
      '<p class="fb-body">' + esc(r.explain) + '</p>';
  } else {
    fb.className = 'feedback bad';
    fb.innerHTML = '<p class="fb-head">❌ Not quite — your answer is locked in.</p>' +
      '<p class="fb-sub">Correct answer: ' + esc(r.correctText) + '</p>' +
      '<p class="fb-body">' + esc(r.explain) + '</p>';
    missed.push({ prompt: currentPrompt, correct: r.correctText, explanation: r.explain });
  }
});
async function verifyCommit(salt, correctText, commit) {
  try {
    if (!window.crypto || !crypto.subtle) return false;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + correctText));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === commit;
  } catch (_) { return false; }
}
socket.on('round_end', r => {
  clearInterval(timerInt);
  $('timer-text').textContent = '0s';
  $('timerbar').setAttribute('aria-valuenow', '0');
  if (myPicked === -1 && !iAmSpectator) {
    // No answer submitted (time ran out): the server sends no answer_result, so record the miss here.
    missed.push({ prompt: currentPrompt, correct: r.correctText, explanation: r.explain });
    const fb = $('feedback');
    fb.className = 'feedback bad';
    fb.innerHTML = '<p class="fb-head">⏰ Time\'s up.</p>' +
      '<p class="fb-sub">Correct answer: ' + esc(r.correctText) + '</p>' +
      '<p class="fb-body">' + esc(r.explain) + '</p>';
  }
  document.querySelectorAll('.opt').forEach(b => {
    const i = Number(b.dataset.i);
    b.disabled = true;
    b.classList.remove('softdim');
    if (i === r.correctIndex) {
      b.classList.add('correct');
      b.querySelector('.mark').textContent = '✓';
    } else if (i === myPicked) {
      b.classList.add('wrongpick');
      b.querySelector('.mark').textContent = '✗';
    } else {
      b.classList.add('dim');
    }
  });
  if (r.players) $('board').innerHTML = playerRows(r.players, true);
  const proof = $('hash-proof');
  proof.classList.remove('hidden');
  $('hash-proof-body').textContent =
    'Locked with hash ' + String(r.commit || '').slice(0, 12) + '… · revealed with key ' + String(r.salt || '').slice(0, 8) +
    '… at round end. Anyone can re-check the maths — the answer never moved.';
  verifyCommit(r.salt, r.correctText, r.commit).then(ok => {
    $('hash-line').textContent = ok
      ? '🔒 Fair-play check passed — that answer was locked before anyone played.'
      : '🔒 The answer for that round was locked in before the question opened.';
  });
});
socket.on('game_over', data => {
  clearInterval(timerInt);
  show('podium');
  const players = data.players || [];
  const winners = data.winners || [];
  const topScore = players.length ? players[0].score : 0;
  $('winner-line').textContent = (!players.length || topScore <= 0)
    ? '🏆 Final results'
    : winners.length > 1
      ? '🏆 It\'s a tie — ' + winners.join(' & ') + ' win with ' + topScore + ' pts!'
      : '🏆 ' + winners[0] + ' wins with ' + topScore + ' pts!';
  const medals = ['🥇', '🥈', '🥉'];
  $('podium').innerHTML = players.slice(0, 3).map((p, i) =>
    '<div class="pod' + (i === 0 ? ' first' : '') + '"><div class="medal">' + medals[i] + '</div>' +
    '<div class="pname">' + esc(p.name) + '</div><div class="pscore">' + p.score + ' pts</div></div>'
  ).join('');
  $('final-board').innerHTML = playerRows(players, true);
  const zone = $('review-zone');
  zone.classList.remove('hidden');
  if (missed.length) {
    $('review-list').innerHTML = missed.map(m =>
      '<div class="review-item"><p class="rq">' + esc(m.prompt) + '</p>' +
      '<p class="ra">Correct: <b>' + esc(m.correct) + '</b></p>' +
      '<p class="re">' + esc(m.explanation) + '</p></div>'
    ).join('');
  } else {
    $('review-list').innerHTML = '<p class="flawless">🎯 Flawless — you missed nothing, so there\'s nothing to review. Take a bow.</p>';
  }
  $('btn-again').classList.toggle('hidden', !isHost);
});
