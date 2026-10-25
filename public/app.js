const socket = io();
let myId = null, myCode = null, isHost = false, timerInt = null;

const $ = id => document.getElementById(id);
const screens = ['home', 'lobby', 'game', 'podium'];
function show(name) {
  screens.forEach(s => $('screen-' + s).classList.toggle('active', s === name));
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

socket.on('connect', () => { myId = socket.id; });

$('btn-create').onclick = () => {
  const name = $('name-input').value.trim() || 'Player';
  socket.emit('create_room', { name, bots: $('bots-check').checked }, res => {
    if (!res.ok) return;
    myCode = res.code; isHost = true;
    $('lobby-code').textContent = res.code;
    show('lobby');
  });
};

$('btn-join').onclick = () => {
  const name = $('name-input').value.trim() || 'Player';
  const code = $('code-input').value.trim().toUpperCase();
  if (code.length !== 4) { $('home-error').textContent = 'Enter the 4-letter room code.'; return; }
  socket.emit('join_room', { name, code }, res => {
    if (!res.ok) { $('home-error').textContent = res.error; return; }
    myCode = res.code;
    $('lobby-code').textContent = res.code;
    show('lobby');
  });
};

$('btn-start').onclick = () => socket.emit('start_game');
$('btn-again').onclick = () => socket.emit('play_again');

function playerRows(players, el) {
  el.innerHTML = players.map((p, i) => `
    <li class="${p.id === myId ? 'me' : ''}">
      <span>${i + 1}. ${esc(p.name)} ${p.isHost ? '👑' : ''} ${p.connected ? '' : '(left)'}</span>
      <span class="score">${p.score} pts${p.streak >= 3 ? ' 🔥' + p.streak : ''}</span>
    </li>`).join('');
}

socket.on('room_state', state => {
  isHost = state.hostId === myId;
  if (state.phase === 'lobby') {
    show('lobby');
    $('lobby-code').textContent = state.code;
    playerRows(state.players, $('lobby-players'));
    $('btn-start').classList.toggle('hidden', !isHost);
    $('lobby-wait').classList.toggle('hidden', isHost);
  }
  if (state.phase === 'question' || state.phase === 'reveal') {
    playerRows(state.players, $('board'));
  }
});

socket.on('question', q => {
  show('game');
  $('round-label').textContent = `Round ${q.round}/${q.totalRounds}`;
  $('q-channel').textContent = q.channel;
  $('q-sender').textContent = 'from ' + q.sender;
  $('q-message').textContent = q.message;
  $('answer-zone').classList.remove('hidden');
  $('reveal-zone').classList.add('hidden');
  $('answer-status').textContent = 'Tap fast — speed earns bonus points!';
  $('btn-scam').disabled = false; $('btn-legit').disabled = false;
  $('answered-label').textContent = '0 answered';
  playerRows(q.players, $('board'));
  const start = Date.now();
  clearInterval(timerInt);
  timerInt = setInterval(() => {
    const left = Math.max(0, q.timeMs - (Date.now() - start));
    $('timer-fill').style.width = (left / q.timeMs * 100) + '%';
    if (left <= 0) clearInterval(timerInt);
  }, 100);
});

function answer(isScam) {
  socket.emit('answer', { isScam });
  $('btn-scam').disabled = true; $('btn-legit').disabled = true;
  $('answer-status').textContent = 'Locked in! Waiting for everyone else…';
}
$('btn-scam').onclick = () => answer(true);
$('btn-legit').onclick = () => answer(false);

socket.on('answer_count', ({ answered, total }) => {
  $('answered-label').textContent = `${answered}/${total} answered`;
});

socket.on('reveal', r => {
  clearInterval(timerInt);
  $('timer-fill').style.width = '0%';
  $('answer-zone').classList.add('hidden');
  $('reveal-zone').classList.remove('hidden');
  $('reveal-title').textContent = r.isScam ? '🚨 It was a SCAM' : '✅ It was LEGIT';
  $('reveal-flag').textContent = r.redFlag;
  const mine = r.results[myId];
  $('reveal-gain').textContent = !mine ? 'You did not answer in time.'
    : mine.correct ? `You got it! +${mine.gain} pts` : 'Not this time — watch for that red flag.';
  $('answer-status').textContent = '';
  playerRows(r.players, $('board'));
});

socket.on('game_over', ({ players }) => {
  show('podium');
  const top3 = players.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  $('podium').innerHTML = top3.map((p, i) => `
    <div class="pod ${i === 0 ? 'first' : ''}"><div class="medal">${medals[i]}</div>
    <div>${esc(p.name)}</div><div class="score">${p.score} pts</div></div>`).join('');
  playerRows(players, $('final-board'));
  $('btn-again').classList.toggle('hidden', !isHost);
});
