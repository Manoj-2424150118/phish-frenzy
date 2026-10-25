// Smoke test v2: MCQ flow, answer-leak check, commitment verification,
// instant feedback, realtime leaderboard, custom quiz from notes,
// room-code lifecycle (persists unfinished; deleted only after finish + all leave).
const { io } = require('socket.io-client');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const URL = process.env.TEST_URL || 'http://localhost:3210';
const wait = ms => new Promise(r => setTimeout(r, ms));

let serverProc = null;
async function bootServerIfNeeded() {
  if (process.env.TEST_URL) return; // external server (e.g. production) — test as-is
  serverProc = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: '3210', ROUND_END_MS: '500', QUESTION_MS: '8000' },
    stdio: 'ignore'
  });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(URL + '/health'); if (r.ok) return; } catch {}
    await wait(250);
  }
  throw new Error('test server did not boot on ' + URL);
}

const NOTES = [
  'Photosynthesis is the process by which green plants convert sunlight, water and carbon dioxide into oxygen and glucose.',
  'Mitochondria is the organelle known as the powerhouse of the cell because it produces most of the chemical energy.',
  'Evaporation is the process where liquid water changes into water vapour at the surface.',
  'Gravity is the force that attracts objects with mass toward one another.',
  'An atom is the smallest unit of ordinary matter that forms a chemical element.',
  'The water cycle is the continuous movement of water through evaporation, condensation and precipitation.',
  'Friction is the force that opposes the relative motion of two surfaces in contact.',
  'A volcano is an opening in the Earth crust through which lava, ash and gases can erupt.'
].join(' ');

async function main() {
  await bootServerIfNeeded();
  // --- crash regression: malformed payloads must never kill the server ---
  const evil = io(URL);
  await new Promise(r => evil.on('connect', r));
  evil.emit('answer', null);
  evil.emit('create_room', null);
  evil.emit('join_room', 'a-string');
  evil.emit('answer', { optionIndex: NaN });
  evil.emit('answer', { optionIndex: 1.5 });
  await wait(400);
  const alive = await fetch(URL + '/health').then(r => r.ok).catch(() => false);
  if (!alive) throw new Error('server died on malformed payloads');
  console.log('✓ malformed-payload crash regression: server alive');
  evil.close();

  // --- custom quiz generation from pasted notes ---
  const genRes = await fetch(URL + '/api/quiz/from-text', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: NOTES, title: 'Science notes' })
  }).then(r => r.json());
  if (!genRes.ok || genRes.count < 3) throw new Error('quiz generation failed: ' + JSON.stringify(genRes));
  console.log(`✓ custom quiz generated from notes: ${genRes.count} questions`);

  const host = io(URL), guest = io(URL);
  await Promise.all([new Promise(r => host.on('connect', r)), new Promise(r => guest.on('connect', r))]);
  console.log('✓ both clients connected');

  const created = await new Promise(r => host.emit('create_room', { name: 'Host', mode: 'friends', quizToken: genRes.token }, r));
  if (!created.ok) throw new Error('create_room failed');
  console.log('✓ friends-mode room created:', created.code, '| source:', created.sourceTitle);

  const joined = await new Promise(r => guest.emit('join_room', { name: 'Guest', code: created.code }, r));
  if (!joined.ok) throw new Error('join failed');
  console.log('✓ guest joined with room code');

  let commit = null, saltChecked = false, instantFeedback = false, boardUpdates = 0, gameOver = false;
  host.on('leaderboard', () => boardUpdates++);
  host.on('question', q => {
    if (!q.options || q.options.length !== 4) throw new Error('question does not have exactly 4 options');
    if ('answer' in q || 'correctIndex' in q || 'explain' in q) throw new Error('LEAK: question payload exposes the answer!');
    commit = q.commit;
    host.emit('answer', { optionIndex: 0 });
  });
  guest.on('question', () => guest.emit('answer', { optionIndex: 1 }));
  host.on('answer_result', r => {
    instantFeedback = true;
    if (typeof r.correct !== 'boolean' || !r.explain || !r.correctText) throw new Error('answer_result incomplete');
    console.log(`✓ instant feedback received (correct=${r.correct}, gain=${r.gain})`);
  });
  host.on('round_end', r => {
    const h = crypto.createHash('sha256').update(r.salt + '|' + r.correctText).digest('hex');
    if (h !== commit || r.commit !== commit) throw new Error('commitment mismatch — answer was not fixed in advance!');
    if (!saltChecked) { saltChecked = true; console.log('✓ answer commitment verified (sha256) — answer was locked before anyone answered'); }
  });
  host.on('game_over', () => { gameOver = true; });

  host.emit('start_game');
  const deadline = Date.now() + 120000;
  while (!gameOver && Date.now() < deadline) await wait(400);
  if (!gameOver) throw new Error('game did not finish');
  if (!instantFeedback) throw new Error('no instant feedback received');
  if (boardUpdates < 3) throw new Error('leaderboard did not update in realtime (updates=' + boardUpdates + ')');
  console.log(`✓ full game finished; leaderboard broadcast ${boardUpdates} times`);

  // --- lifecycle: finished + everyone leaves => code deleted ---
  host.emit('leave_room'); guest.emit('leave_room');
  await wait(500);
  const rejoin = await new Promise(r => host.emit('join_room', { name: 'Late', code: created.code }, r));
  if (rejoin.ok) throw new Error('finished+empty room code should be deleted');
  console.log('✓ room code retired after game finished and everyone left');

  // --- lifecycle: unfinished room code must NOT expire ---
  const c2 = await new Promise(r => host.emit('create_room', { name: 'Host2', mode: 'friends' }, r));
  host.close(); // host vanishes mid-lobby (game never finished)
  await wait(600);
  const g2 = io(URL);
  await new Promise(r => g2.on('connect', r));
  const j2 = await new Promise(r => g2.emit('join_room', { name: 'Still', code: c2.code }, r));
  if (!j2.ok) throw new Error('unfinished room code expired early — violates lifecycle rule');
  console.log('✓ unfinished room code stays valid even after host disconnects');
  g2.close(); guest.close();
  console.log('\nSMOKE TEST V2 PASSED');
  if (serverProc) serverProc.kill();
  process.exit(0);
}
main().catch(e => { console.error('SMOKE TEST FAILED:', e.message); if (serverProc) serverProc.kill(); process.exit(1); });
