const socket = io();
let myId = null, isHost = false, timerInt = null, quizToken = null;
let answered = false, iAmSpectator = false, wasConnected = false;
let currentPrompt = '', missed = [];

const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'podium'];
const show = n => screens.forEach(s => $('screen-' + s).classList.toggle('active', s === n));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const myName = () => $('name-input').value.trim() || 'Player';

socket.on('connect', () => {
  myId = socket.id;
  $('conn-banner').classList.add('hidden');
  if (wasConnected) { // reconnect: try to reclaim our seat
    const code = sessionStorage.getItem('pf_code');
    const name = sessionStorage.getItem('pf_name');
    if (code) {
      $('name-input').value = name || myName();
      socket.emit('join_room', { name: name || myName(), code }, res => enter(res, 'home-error'));
    }
  }
  wasConnected = true;
});
socket.on('disconnect', () => $('conn-banner').classList.remove('hidden'));

// ---- custom quiz from notes ----
function setQuizStatus(msg, ok) {
  $('quiz-status').textContent = msg;
  $('quiz-status').style.color = ok ? 'var(--ok)' : 'var(--danger)';
  $('quiz-reset-row').classList.toggle('hidden', !quizToken);
}
$('quiz-reset').onclick = e => {
  e.preventDefault();
  quizToken = null;
  setQuizStatus('Back to the built-in scam-spotting bank for your next room.', true);
};
$('btn-notes').onclick = async () => {
  const text = $('notes-input').value.trim();
  if (text.length < 200) return setQuizStatus('Paste a bit more — at least a few paragraphs of notes (200+ characters).', false);
  setQuizStatus('Analysing your notes and building questions…', true);
  try {
    const r = await fetch('/api/quiz/from-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, title: 'Pasted notes' }) });
    const d = await r.json();
    if (!d.ok) return setQuizStatus(d.error, false);
    quizToken = d.token;
    setQuizStatus(`✅ Custom quiz ready — ${d.count} questions built from your notes. Now create a room or play vs bots and your room will use THIS quiz.`, true);
  } catch { setQuizStatus('Something went wrong building the quiz. Try again.', false); }
};
$('file-input').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setQuizStatus(`Reading ${file.name} and building questions…`, true);
  try {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/quiz/from-file', { method: 'POST', body: fd });
    const d = await r.json();
    if (!d.ok) return setQuizStatus(d.error, false);
    quizToken = d.token;
    setQuizStatus(`✅ Custom quiz ready — ${d.count} questions built from ${file.name}. Now create a room or play vs bots.`, true);
  } catch { setQuizStatus('Could not read that file. Try pasting the notes instead.', false); }
};

// ---- entering rooms ----
function debounce(btn) { btn.disabled = true; setTimeout(() => btn.disabled = false, 1200); }
function enter(res, errEl) {
  if (!res || !res.ok) { $(errEl).textContent = (res && res.error) || 'Could not enter the room.'; return false; }
  sessionStorage.setItem('pf_code', res.code);
  sessionStorage.setItem('pf_name', myName());
  $('lobby-code').textContent = res.code;
  iAmSpectator = !!res.spectator;
  show('lobby');
  return true;
}
$('btn-bots').onclick = e => { debounce(e.target); socket.emit('create_room', { name: myName(), mode: 'bots', quizToken }, r => enter(r, 'home-error')); };
$('btn-create').onclick = e => { debounce(e.target); socket.emit('create_room', { name: myName(), mode: 'friends', quizToken }, r => enter(r, 'home-error')); };
$('btn-join').onclick = e => {
  debounce(e.target);
  const code = $('code-input').value.trim().toUpperCase();
  if (code.length !== 4) { $('home-error').textContent = 'Enter the 4-letter room code your friend shared.'; return; }
  socket.emit('join_room', { name: myName(), code }, r => enter(r, 'home-error'));
};
$('btn-copy').onclick = () => {
  const code = $('lobby-code').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(code);
  $('btn-copy').textContent = '✅ Copied!';
  setTimeout(() => $('btn-copy').textContent = '📋 Copy code', 1500);
};

$('btn-start').onclick = () => { missed = []; socket.emit('start_game'); };
$('btn-again').onclick = () => { missed = []; socket.emit('play_again'); };
function leave() { socket.emit('leave_room'); sessionStorage.removeItem('pf_code'); show('home'); }
$('btn-leave-lobby').onclick = leave;
$('btn-leave-game').onclick = leave;
$('btn-leave-podium').onclick = leave;

// ---- shared rendering ----
function playerRows(players, el) {
  el.innerHTML = players.map((p, i) => `
    <li class="${p.id === myId ? 'me' : ''}">
      <span>${i + 1}. ${esc(p.name)} ${p.isHost ? '👑' : ''} ${p.spectator ? '👀' : ''} ${p.connected ? '' : '(away)'}</span>
      <span class="score">${p.score} pts${p.streak >= 3 ? ' 🔥' + p.streak : ''}</span>
    </li>`).join('');
}

socket.on('room_state', st => {
  isHost = st.hostId === myId;
  const me = st.players.find(p => p.id === myId);
  if (me) iAmSpectator = !!me.spectator;
  if (st.phase === 'lobby') {
    show('lobby');
    $('lobby-code').textContent = st.code;
    $('lobby-source').textContent = 'Quiz: ' + st.sourceTitle + ` • ${st.totalRounds} questions this game`;
    $('spectator-note').classList.toggle('hidden', !iAmSpectator);
    playerRows(st.players, $('lobby-players'));
    $('btn-start').classList.toggle('hidden', !isHost);
    $('lobby-wait').classList.toggle('hidden', isHost);
  }
  if (st.phase === 'question' && !iAmSpectator) playerRows(st.players, $('board'));
  if (st.phase === 'podium') {
    show('podium');
    playerRows(st.players, $('final-board'));
    $('btn-again').classList.toggle('hidden', !isHost);
  }
});
socket.on('leaderboard', ({ players }) => { if (!iAmSpectator) playerRows(players, $('board')); });

// ---- gameplay ----
socket.on('question', q => {
  if (iAmSpectator) return; // spectators stay on the lobby/scoreboard view
  show('game');
  answered = false;
  currentPrompt = (q.scenario ? q.scenario + ' ' : '') + q.prompt;
  $('round-label').textContent = `Round ${q.round}/${q.totalRounds}`;
  const sc = $('q-scenario');
  if (q.scenario) { sc.textContent = q.scenario; sc.classList.remove('hidden'); } else sc.classList.add('hidden');
  $('q-prompt').textContent = q.prompt;
  $('feedback').classList.add('hidden');
  $('hash-line').textContent = `🔒 Answer locked in advance — verification hash ${q.commit.slice(0, 12)}… (key revealed at round end)`;
  $('answered-label').textContent = '0 answered';
  $('options').innerHTML = q.options.map((o, i) =>
    `<button class="opt" data-i="${i}"><span class="letter">${'ABCD'[i]}</span> ${esc(o)}</button>`).join('');
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (answered) return;
    answered = true;
    document.querySelectorAll('.opt').forEach(x => x.disabled = true);
    b.classList.add('picked');
    socket.emit('answer', { optionIndex: Number(b.dataset.i) });
  });
  const start = Date.now();
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    const left = Math.max(0, q.timeMs - (Date.now() - start));
    $('timer-fill').style.width = (left / q.timeMs * 100) + '%';
    $('timer-text').textContent = Math.ceil(left / 1000) + 's';
    if (left <= 0) clearInterval(timerInt);
  }, 100);
});

socket.on('answer_count', ({ answered: a, total }) => { $('answered-label').textContent = `${a}/${total} answered`; });

socket.on('answer_result', r => {
  const f = $('feedback');
  f.classList.remove('hidden', 'good', 'bad');
  f.classList.add(r.correct ? 'good' : 'bad');
  if (r.correct) {
    const parts = [`100 base`, r.speedBonus ? `+${r.speedBonus} speed` : null, r.streakBonus ? `+${r.streakBonus} streak 🔥` : null].filter(Boolean).join(' ');
    f.innerHTML = `<b>✅ Correct! +${r.gain} pts</b> (${parts}) — score: ${r.yourScore}<br>${esc(r.explain)}`;
  } else {
    f.innerHTML = `<b>❌ Not quite — your answer is locked in.</b> Correct answer: <b>${esc(r.correctText)}</b><br>${esc(r.explain)}`;
    missed.push({ prompt: currentPrompt, correctText: r.correctText, explain: r.explain });
  }
});

socket.on('round_end', r => {
  if (iAmSpectator) return;
  clearInterval(timerInt);
  $('timer-fill').style.width = '0%';
  $('timer-text').textContent = '0s';
  document.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    if (Number(b.dataset.i) === r.correctIndex) b.classList.add('correct');
  });
  if (!answered) {
    const f = $('feedback');
    f.classList.remove('hidden'); f.classList.add('bad');
    f.innerHTML = `<b>⏰ Time's up.</b> Correct answer: <b>${esc(r.correctText)}</b><br>${esc(r.explain)}`;
    missed.push({ prompt: currentPrompt, correctText: r.correctText, explain: r.explain });
  }
  $('hash-line').textContent = `🔒 Verified: the answer was locked before anyone answered (hash ${r.commit.slice(0, 12)}…, key ${r.salt.slice(0, 8)}…).`;
  playerRows(r.players, $('board'));
});

socket.on('game_over', ({ players, winners }) => {
  show('podium');
  const medals = ['🥇', '🥈', '🥉'];
  $('winner-line').textContent = winners && winners.length
    ? (winners.length > 1 ? `🏆 It's a tie — ${winners.join(' & ')} win with ${players[0].score} pts!` : `🏆 ${winners[0]} wins with ${players[0].score} pts!`)
    : '🏆 Final results';
  $('podium').innerHTML = players.slice(0, 3).map((p, i) => `
    <div class="pod ${i === 0 ? 'first' : ''}"><div class="medal">${medals[i]}</div>
    <div>${esc(p.name)}</div><div class="score">${p.score} pts</div></div>`).join('');
  playerRows(players, $('final-board'));
  $('btn-again').classList.toggle('hidden', !isHost);
  const rz = $('review-zone');
  if (missed.length) {
    rz.classList.remove('hidden');
    $('review-list').innerHTML = missed.map(m => `
      <div class="review-item"><p class="review-q">${esc(m.prompt)}</p>
      <p><b>Correct:</b> ${esc(m.correctText)}</p><p class="fine">${esc(m.explain)}</p></div>`).join('');
  } else {
    rz.classList.add('hidden');
  }
});
