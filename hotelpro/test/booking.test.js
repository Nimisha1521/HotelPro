const test = require('node:test'), assert = require('node:assert/strict');
const { fresh, open, day, tmpFile } = require('./helpers');
const { createBooking, cancelBooking, BookingError } = require('../lib/booking');
const { apply } = require('../lib/schema');
const room = db => db.prepare("SELECT id FROM rooms WHERE number='108'").get().id;
const book = (db, u, r, i, o, g = 2) => createBooking(db, u.id, { roomId: r, checkIn: day(i), checkOut: day(o), guests: g });
const code = f => { try { f(); } catch (e) { return e.code || e.message; } return 'NO_ERROR'; };

test('catalogue has 20 distinct rooms', () => {
  const { db } = fresh(); const r = db.prepare('SELECT COUNT(*) n, COUNT(DISTINCT name) d FROM rooms').get();
  assert.equal(Number(r.n), 20); assert.equal(Number(r.d), 20);
});
test('valid first booking succeeds and totals nights x INR price', () => {
  const { db, A } = fresh(), r = room(db); const b = book(db, A, r, 10, 12);
  assert.equal(b.nights, 2); assert.equal(b.total, 2 * 4499);
});
test('second user cannot book overlapping dates (partial overlap)', () => {
  const { db, A, B } = fresh(), r = room(db); book(db, A, r, 10, 12);
  assert.equal(code(() => book(db, B, r, 11, 13)), 'CONFLICT');
});
test('booking contained inside an existing one is rejected', () => {
  const { db, A, B } = fresh(), r = room(db); book(db, A, r, 10, 15);
  assert.equal(code(() => book(db, B, r, 11, 12)), 'CONFLICT');
});
test('booking that fully covers an existing one is rejected', () => {
  const { db, A, B } = fresh(), r = room(db); book(db, A, r, 11, 12);
  assert.equal(code(() => book(db, B, r, 10, 14)), 'CONFLICT');
});
test('adjacent booking starting on previous check-out succeeds; one ending on check-in succeeds', () => {
  const { db, A, B } = fresh(), r = room(db); book(db, A, r, 10, 12);
  book(db, B, r, 12, 14); book(db, B, r, 8, 10);
});
test('other rooms are unaffected', () => {
  const { db, A, B } = fresh(), r = room(db), r2 = db.prepare("SELECT id FROM rooms WHERE number='109'").get().id;
  book(db, A, r, 10, 12); book(db, B, r2, 10, 12);
});
test('cancelled booking frees the room', () => {
  const { db, A, B } = fresh(), r = room(db); const b = book(db, A, r, 10, 12);
  cancelBooking(db, A, b.id); book(db, B, r, 10, 12);
});
test('invalid, reversed, equal, past and impossible dates are rejected', () => {
  const { db, A } = fresh(), r = room(db);
  assert.equal(code(() => book(db, A, r, 12, 10)), 'BAD_RANGE');
  assert.equal(code(() => book(db, A, r, 10, 10)), 'BAD_RANGE');
  assert.equal(code(() => book(db, A, r, -3, 2)), 'PAST');
  assert.equal(code(() => createBooking(db, A.id, { roomId: r, checkIn: '2099-02-30', checkOut: '2099-03-02', guests: 1 })), 'BAD_DATES');
  assert.equal(code(() => createBooking(db, A.id, { roomId: r, checkIn: 'abc', checkOut: null, guests: 1 })), 'BAD_DATES');
  assert.equal(code(() => book(db, A, r, 10, 60)), 'TOO_LONG');
});
test('guest count above capacity is rejected', () => {
  const { db, A } = fresh(); assert.equal(code(() => book(db, A, room(db), 10, 12, 5)), 'CAPACITY');
});
test('duplicate submission by the same user creates only one reservation', () => {
  const { db, A } = fresh(), r = room(db); book(db, A, r, 10, 12);
  assert.equal(code(() => book(db, A, r, 10, 12)), 'CONFLICT');
  assert.equal(Number(db.prepare('SELECT COUNT(*) n FROM bookings').get().n), 1);
});
test('simultaneous requests for the last room: only one wins', async () => {
  const { db, A, B } = fresh(), r = room(db);
  const res = await Promise.allSettled([A, B].map(u => Promise.resolve().then(() => book(db, u, r, 10, 12))));
  assert.equal(res.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(Number(db.prepare('SELECT COUNT(*) n FROM bookings').get().n), 1);
});
test('two separate connections (two server processes): write lock stops a double booking', () => {
  const f = tmpFile(), one = fresh(f), r = room(one.db);
  const other = apply(open(f)); other.exec('PRAGMA busy_timeout=0');
  one.db.exec('BEGIN IMMEDIATE');               // connection 1 is mid-booking
  assert.throws(() => book(other, one.B, r, 10, 12));   // connection 2 cannot enter at the same time
  one.db.prepare("INSERT INTO bookings(user_id,room_id,check_in,check_out,guests,total) VALUES(?,?,?,?,?,?)").run(one.A.id, r, day(10), day(12), 2, 1);
  one.db.exec('COMMIT');
  assert.equal(code(() => book(other, one.B, r, 10, 12)), 'CONFLICT');  // after commit, connection 2 sees it
  assert.equal(Number(other.prepare('SELECT COUNT(*) n FROM bookings').get().n), 1);
});
test('database trigger blocks overlapping inserts even from raw SQL', () => {
  const { db, A, B } = fresh(), r = room(db); book(db, A, r, 10, 12);
  assert.throws(() => db.prepare("INSERT INTO bookings(user_id,room_id,check_in,check_out,guests,total) VALUES(?,?,?,?,?,?)").run(B.id, r, day(11), day(13), 1, 1), /ROOM_CONFLICT/);
});
test('users cannot cancel others bookings; staff can', () => {
  const { db, A, B, S } = fresh(), r = room(db); const b = book(db, A, r, 10, 12);
  assert.equal(code(() => cancelBooking(db, B, b.id)), 'NOT_FOUND');
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(b.id).status, 'confirmed');
  cancelBooking(db, S, b.id);
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(b.id).status, 'cancelled');
});
test('re-cancelling is rejected', () => {
  const { db, A } = fresh(), b = book(db, A, room(db), 10, 12); cancelBooking(db, A, b.id);
  assert.equal(code(() => cancelBooking(db, A, b.id)), 'NOT_CANCELLABLE');
});
test('data survives reopening the database file', () => {
  const f = tmpFile(), one = fresh(f); book(one.db, one.A, room(one.db), 10, 12); one.db.close();
  assert.equal(Number(apply(open(f)).prepare('SELECT COUNT(*) n FROM bookings').get().n), 1);
});
