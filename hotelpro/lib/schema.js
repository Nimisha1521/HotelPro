// Shared schema: works with better-sqlite3 and node:sqlite (same prepare/get/run/exec API).
const SQL = `
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'guest' CHECK(role IN('guest','staff','admin')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rooms(
  id INTEGER PRIMARY KEY, number TEXT UNIQUE NOT NULL, type TEXT NOT NULL, price REAL NOT NULL CHECK(price>0),
  capacity INTEGER NOT NULL CHECK(capacity>0), description TEXT DEFAULT '', amenities TEXT DEFAULT '', active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), room_id INTEGER NOT NULL REFERENCES rooms(id),
  check_in TEXT NOT NULL, check_out TEXT NOT NULL, guests INTEGER NOT NULL, total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN('confirmed','checked_in','checked_out','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'demo_paid', payment_ref TEXT, card_last4 TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, CHECK(check_out>check_in));
CREATE INDEX IF NOT EXISTS idx_b_room ON bookings(room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_b_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_b_status ON bookings(status);
-- Database-level backstop: no code path can insert an overlapping active booking for the same room.
CREATE TRIGGER IF NOT EXISTS no_overlap BEFORE INSERT ON bookings
WHEN NEW.status IN('confirmed','checked_in')
BEGIN
  SELECT RAISE(ABORT,'ROOM_CONFLICT') WHERE EXISTS(
    SELECT 1 FROM bookings WHERE room_id=NEW.room_id AND status IN('confirmed','checked_in')
    AND check_in<NEW.check_out AND check_out>NEW.check_in);
END;`;
function apply(db) {
  db.exec(SQL);
  const have = db.prepare('PRAGMA table_info(rooms)').all().map(c => c.name);
  for (const [c, t] of [['name', 'TEXT'], ['bed_type', 'TEXT'], ['beds', 'INTEGER DEFAULT 1'], ['size_sqm', 'INTEGER']])
    if (!have.includes(c)) db.exec(`ALTER TABLE rooms ADD COLUMN ${c} ${t}`);
  return db;
}
module.exports = { apply };
