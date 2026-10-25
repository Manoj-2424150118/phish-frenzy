// Smoke test: 2 real socket clients create/join a room, start, answer, verify reveal + game flow.
const { io } = require('socket.io-client');
const URL = process.env.TEST_URL || 'http://localhost:3000';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const host = io(URL);
  const guest = io(URL);
  await Promise.all([
    new Promise(r => host.on('connect', r)),
    new Promise(r => guest.on('connect', r))
  ]);
  console.log('✓ both clients connected');

  const created = await new Promise(r => host.emit('create_room', { name: 'Host', bots: false }, r));
  if (!created.ok) throw new Error('create_room failed');
  console.log('✓ room created:', created.code);

  const joined = await new Promise(r => guest.emit('join_room', { name: 'Guest', code: created.code }, r));
  if (!joined.ok) throw new Error('join_room failed: ' + joined.error);
  console.log('✓ guest joined');

  const badJoin = await new Promise(r => guest.emit('join_room', { name: 'X', code: 'ZZZZ' }, r));
  if (badJoin.ok) throw new Error('bad code should fail');
  console.log('✓ invalid code rejected');

  let gotQuestion = false, gotReveal = false;
  host.on('question', q => {
    gotQuestion = true;
    console.log(`✓ question received: round ${q.round}, channel ${q.channel}`);
    host.emit('answer', { isScam: true });
  });
  guest.on('question', () => guest.emit('answer', { isScam: false }));
  host.on('reveal', r => {
    gotReveal = true;
    console.log('✓ reveal received. isScam =', r.isScam, '| players scored:', r.players.map(p => `${p.name}:${p.score}`).join(', '));
    if (typeof r.redFlag !== 'string' || !r.redFlag.length) throw new Error('missing redFlag explanation');
  });

  host.emit('start_game');
  await wait(2500);
  if (!gotQuestion) throw new Error('no question event');
  await wait(1500);
  if (!gotReveal) throw new Error('no reveal after both answered');

  host.close(); guest.close();
  console.log('\nSMOKE TEST PASSED');
  process.exit(0);
}
main().catch(e => { console.error('SMOKE TEST FAILED:', e.message); process.exit(1); });
