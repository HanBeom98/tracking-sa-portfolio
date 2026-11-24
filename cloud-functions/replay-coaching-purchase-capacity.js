const { fail, owner, id, validTime, MAX_LOTS, MAX_BALANCE } = require('./replay-coaching-credits.js');
// Small, per-account limits for the dormant purchase path. No query, TTL or job.
const MAX_OPEN = 3, MAX_DAILY = 10;
const capacityRef = (db, uid) => db.collection('_replay_coaching_users').doc(`credit_purchase_capacity_v1_${owner(uid)}`);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function dayAt(time) {
  if (!validTime(time) || !validTime(time + 9 * 3600000)) fail('CREDIT_STATE_INVALID');
  return new Date(time + 9 * 3600000).toISOString().slice(0, 10).replaceAll('-', '');
}
function readCapacity(snapshot, uid, time) {
  const day = dayAt(time);
  if (!snapshot.exists) return { schemaVersion: 1, ownerHash: owner(uid), day, created: 0, reservations: [] };
  const c = snapshot.data();
  if (!exact(c, ['schemaVersion', 'ownerHash', 'day', 'created', 'reservations']) || c.schemaVersion !== 1 || c.ownerHash !== owner(uid)
    || !/^\d{8}$/.test(c.day) || c.day > day || !Number.isSafeInteger(c.created) || c.created < 0 || c.created > MAX_DAILY
    || !Array.isArray(c.reservations) || c.reservations.length > MAX_OPEN
    || new Set(c.reservations.map(r => r?.orderId)).size !== c.reservations.length) fail('CREDIT_STATE_INVALID');
  for (const r of c.reservations) {
    if (!exact(r, ['orderId', 'quantity', 'createdAt']) || !id(r.orderId) || !Number.isSafeInteger(r.quantity)
      || r.quantity < 1 || r.quantity > 50 || !validTime(r.createdAt) || r.createdAt > time) fail('CREDIT_STATE_INVALID');
  }
  if (c.reservations.filter(r => dayAt(r.createdAt) === c.day).length > c.created) fail('CREDIT_STATE_INVALID');
  if (c.day !== day) { c.day = day; c.created = 0; }
  return c;
}
function matchReservation(capacity, order) {
  const r = capacity.reservations.find(r => r.orderId === order.orderId);
  if (!r || r.quantity !== order.quantity || r.createdAt !== order.createdAt) fail('CREDIT_STATE_INVALID');
  return r;
}
function checkCapacity(wallet, reservations, extraQuantity = 0, extraLots = 0) {
  if (wallet.lots.length + reservations.length + extraLots > MAX_LOTS
    || wallet.available + wallet.held + wallet.refundHeld + reservations.reduce((n, r) => n + r.quantity, 0) + extraQuantity > MAX_BALANCE)
    fail('CREDIT_CAPACITY', 409);
}
function reserveCapacity(capacity, wallet, orderId, quantity, time) {
  if (capacity.reservations.length >= MAX_OPEN) fail('ORDER_OPEN_LIMIT', 429);
  if (capacity.created >= MAX_DAILY) fail('ORDER_DAILY_LIMIT', 429);
  if (capacity.reservations.some(r => r.orderId === orderId) || wallet.lots.some(l => l.orderId === orderId)) fail('CREDIT_STATE_INVALID');
  checkCapacity(wallet, capacity.reservations, quantity, 1);
  capacity.created++;
  capacity.reservations.push({ orderId, quantity, createdAt: time });
}
module.exports = { capacityRef, readCapacity, matchReservation, checkCapacity, reserveCapacity, MAX_OPEN, MAX_DAILY };
