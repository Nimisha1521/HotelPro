// Booking rules. Every reservation goes through createBooking(): validate -> BEGIN IMMEDIATE (write lock)
// -> re-check overlap -> insert -> COMMIT. The DB trigger in schema.js is a second line of defence.
class BookingError extends Error { constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; } }
const ACTIVE = "status IN('confirmed','checked_in')";
const parseDay = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? null : t;
};
const todayStr = () => new Date().toISOString().slice(0, 10);
function validateStay(checkIn, checkOut, today = todayStr()) {
  const a = parseDay(checkIn), b = parseDay(checkOut);
  if (a === null || b === null) throw new BookingError('BAD_DATES', 'Choose valid dates');
  if (checkIn < today) throw new BookingError('PAST', 'Check-in cannot be in the past');
  if (b <= a) throw new BookingError('BAD_RANGE', 'Check-out must be after check-in');
  const n = Math.round((b - a) / 864e5);
  if (n > 30) throw new BookingError('TOO_LONG', 'Stay must be 30 nights or fewer');
  return n;
}
// half-open intervals: existing.in < new.out AND existing.out > new.in (same-day turnover is allowed)
const hasConflict = (db, roomId, checkIn, checkOut) =>
  !!db.prepare(`SELECT 1 FROM bookings WHERE room_id=? AND ${ACTIVE} AND check_in<? AND check_out>?`).get(roomId, checkOut, checkIn);

function createBooking(db, userId, b, opts = {}) {
  const nights = validateStay(b.checkIn, b.checkOut, opts.today);
  const guests = Number.isInteger(b.guests) ? b.guests : 1;
  db.exec('BEGIN IMMEDIATE');
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id=? AND active=1').get(b.roomId);
    if (!room) throw new BookingError('NO_ROOM', 'Room not found', 404);
    if (guests < 1 || guests > room.capacity) throw new BookingError('CAPACITY', `This room sleeps up to ${room.capacity}`);
    if (hasConflict(db, room.id, b.checkIn, b.checkOut)) throw new BookingError('CONFLICT', 'Sorry, this room is already booked for some of these dates', 409);
    const total = nights * room.price;
    const id = Number(db.prepare('INSERT INTO bookings(user_id,room_id,check_in,check_out,guests,total,payment_ref,payment_status) VALUES(?,?,?,?,?,?,?,?)')
      .run(userId, room.id, b.checkIn, b.checkOut, guests, total, b.paymentRef || null, 'demo_paid').lastInsertRowid);
    db.exec('COMMIT');
    return { id, total, nights, paymentRef: b.paymentRef };
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch {}
    if (/ROOM_CONFLICT/.test(e.message)) throw new BookingError('CONFLICT', 'Sorry, this room is already booked for some of these dates', 409);
    throw e;
  }
}
function cancelBooking(db, user, id) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(id);
  if (!b || (b.user_id !== user.id && user.role === 'guest')) throw new BookingError('NOT_FOUND', 'Booking not found', 404); // 404, not 403: don't reveal other users' IDs
  if (b.status !== 'confirmed') throw new BookingError('NOT_CANCELLABLE', 'Only upcoming bookings can be cancelled');
  db.prepare("UPDATE bookings SET status='cancelled', payment_status='demo_cancelled' WHERE id=?").run(id);
}
module.exports = { BookingError, validateStay, hasConflict, createBooking, cancelBooking };
