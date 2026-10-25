const socket = io();
let myId = null, isHost = false, timerInt = null, quizToken = null, answered = false;

const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'podium'];
const show = n => screens.forEach(s => $('screen-' + s).classList.toggle('active', s === n));
const esc = s => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
const myName = () => $('name-input').value.trim() || 'Player';

socket.on('connect', () => { myId = socket.id; });

// ---- custom quiz from notes ----
function setQuizStatus(msg, ok) {
  $('quiz-status').textContent = msg;
  $('quiz-status').style.color = ok ? 'var(--ok)' : 'var(--danger)';
}
$('btn-notes').onclick = async () => {
  const text = $('notes-input').value.trim();
  if (text.length < 200) return setQuizStatus('Paste a bit more — at least a few paragraphs of notes.', false);
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
function enter(res, errEl) {
  if (!res || !res.ok) { $(errEl).textContent = (res && res.error) || 'Could not enter the room.'; return false; }
  $('lobby-code').textContent = res.code;
  if (res.spectator) $('lobby-wait').textContent = 'A game is running in this room right now — you are on the scoreboard and will play from the next game.';
  show('lobby');
  return true;
}
$('btn-bots').onclick = () => socket.emit('create_room', { name: myName(), mode: 'bots', quizToken }, r => enter(r, 'home-error'));
$('btn-create').onclick = () => socket.emit('create_room', { name: myName(), mode: 'friends', quizToken }, r => enter(r, 'home-error'));
$('btn-join').onclick = () => {
  const code = $('code-input').value.trim().toUpperCase();
  if (code.length !== 4) { $('home-error').textContent = 'Enter the 4-letter room code your friend shared.'; return; }
  socket.emit('join_room', { name: myName(), code }, r => enter(r, 'home-error'));
};

$('btn-start').onclick = () => socket.emit('start_game');
$('btn-again').onclick = () => socket.emit('play_again');
function leave() { socket.emit('leave_room'); show('home'); }
$('btn-leave-lobby').onclick = leave;
$('btn-leave-game').onclick = leave;
$('btn-leave-podium').onclick = leave;

// ---- shared rendering ----
function playerRows(players, el) {
  el.innerHTML = players.map((p, i) => `
    <li class="${p.id === myId ? 'me' : ''}">
      <span>${i + 1}. ${esc(p.name)} ${p.isHost ? '👑' : ''} ${p.connected ? '' : '(away)'}</span>
      <span class="score">${p.score} pts${p.streak >= 3 ? ' 🔥' + p.streak : ''}</span>
    </li>`).join('');
}

socket.on('room_state', st => {
  isHost = st.hostId === myId;
  if (st.phase === 'lobby') {
    show('lobby');
    $('lobby-code').textContent = st.code;
    $('lobby-source').textContent = 'Quiz: ' + st.sourceTitle + ` • ${st.totalRounds} questions this game`;
    playerRows(st.players, $('lobby-players'));
    $('btn-start').classList.toggle('hidden', !isHost);
    $('lobby-wait').classList.toggle('hidden', isHost);
  }
  if (st.phase === 'question') playerRows(st.players, $('board'));
});
socket.on('leaderboard', ({ players }) => playerRows(players, $('board')));

// ---- gameplay ----
socket.on('question', q => {
  show('game');
  answered = false;
  $('round-label').textContent = `Round ${q.round}/${q.totalRounds}`;
  const sc = $('q-scenario');
  if (q.scenario) { sc.textContent = q.scenario; sc.classList.remove('hidden'); } else sc.classList.add('hidden');
  $('q-prompt').textContent = q.prompt;
  $('feedback').classList.add('hidden');
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
    if (left <= 0) clearInterval(timerInt);
  }, 100);
});

socket.on('answer_count', ({ answered: a, total }) => { $('answered-label').textContent = `${a}/${total} answered`; });

// Instant personal feedback the moment YOU answer
socket.on('answer_result', r => {
  const f = $('feedback');
  f.classList.remove('hidden', 'good', 'bad');
  f.classList.add(r.correct ? 'good' : 'bad');
  f.innerHTML = r.correct
    ? `<b>✅ Correct! +${r.gain} pts</b> (score: ${r.yourScore})<br>${esc(r.explain)}`
    : `<b>❌ Not quite.</b> Correct answer: <b>${esc(r.correctText)}</b><br>${esc(r.explain)}`;
});

socket.on('round_end', r => {
  clearInterval(timerInt);
  $('timer-fill').style.width = '0%';
  document.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    if (Number(b.dataset.i) === r.correctIndex) b.classList.add('correct');
  });
  if (!answered) {
    const f = $('feedback');
    f.classList.remove('hidden'); f.classList.add('bad');
    f.innerHTML = `<b>⏰ Time's up.</b> Correct answer: <b>${esc(r.correctText)}</b><br>${esc(r.explain)}`;
  }
  playerRows(r.players, $('board'));
});

socket.on('game_over', ({ players }) => {
  show('podium');
  const medals = ['🥇', '🥈', '🥉'];
  $('podium').innerHTML = players.slice(0, 3).map((p, i) => `
    <div class="pod ${i === 0 ? 'first' : ''}"><div class="medal">${medals[i]}</div>
    <div>${esc(p.name)}</div><div class="score">${p.score} pts</div></div>`).join('');
  playerRows(players, $('final-board'));
  $('btn-again').classList.toggle('hidden', !isHost);
});
