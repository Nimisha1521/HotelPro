require('dotenv').config()
const express = require('express'), helmet = require('helmet'), cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const crypto = require('crypto'), path = require('path');
const db = require('./db');
const { seedRooms } = require('./lib/seed');
const { createBooking, cancelBooking, BookingError } = require('./lib/booking');

const PROD = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || (PROD ? null : 'dev-only-secret');
if (!SECRET || SECRET.length < 16) { console.error('Set JWT_SECRET (16+ chars).'); process.exit(1); }

// ---- seed ----
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const email = process.env.ADMIN_EMAIL || 'admin@hotelpro.local';
  const pass = process.env.ADMIN_PASSWORD || (PROD ? crypto.randomBytes(9).toString('base64url') : 'Admin@12345');
  db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run('Administrator', email, bcrypt.hashSync(pass, 12), 'admin');
  console.log(`Admin created: ${email} / ${pass}  (change this after first login)`);
}
seedRooms(db);

// ---- app ----
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 15 * 60e3, limit: 300, standardHeaders: true, legacyHeaders: false }));
const authLimit = rateLimit({ windowMs: 15 * 60e3, limit: 20, message: { error: 'Too many attempts. Try again later.' } });

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
const today = () => new Date().toISOString().slice(0, 10);
const nights = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const luhn = n => { let s = 0, d = false; for (let i = n.length - 1; i >= 0; i--) { let x = +n[i]; if (d && (x *= 2) > 9) x -= 9; s += x; d = !d; } return s % 10 === 0; };

function auth(roles) {
  return (req, res, next) => {
    try {
      const { id } = jwt.verify(req.cookies.token, SECRET);
      const u = db.prepare('SELECT id,name,email,phone,role FROM users WHERE id=?').get(id);
      if (!u) throw 0;
      if (roles && !roles.includes(u.role)) return bad(res, 'Not allowed', 403);
      req.user = u; next();
    } catch { bad(res, 'Please log in', 401); }
  };
}
const setCookie = (res, id) => res.cookie('token', jwt.sign({ id }, SECRET, { expiresIn: '7d' }),
  { httpOnly: true, sameSite: 'strict', secure: PROD, maxAge: 7 * 864e5 });

// ---- auth ----
app.post('/api/auth/register', authLimit, (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email).toLowerCase(), phone = str(req.body.phone, 20), pw = req.body.password;
  if (name.length < 2) return bad(res, 'Enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Enter a valid email');
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) return bad(res, 'Password must be 8-72 characters');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'Email already registered', 409);
  const id = db.prepare('INSERT INTO users(name,email,phone,password_hash) VALUES(?,?,?,?)').run(name, email, phone, bcrypt.hashSync(pw, 12)).lastInsertRowid;
  setCookie(res, id);
  res.status(201).json({ user: { id, name, email, phone, role: 'guest' } });
});
app.post('/api/auth/login', authLimit, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(str(req.body.email).toLowerCase());
  const ok = u && typeof req.body.password === 'string' && bcrypt.compareSync(req.body.password, u.password_hash);
  if (!ok) return bad(res, 'Wrong email or password', 401);
  setCookie(res, u.id);
  res.json({ user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role } });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/auth/me', auth(), (req, res) => res.json({ user: req.user }));

app.patch('/api/auth/me', auth(), (req, res) => {
  const name = str(req.body.name, 80), phone = str(req.body.phone, 20);
  if (name.length < 2) return bad(res, 'Enter your name');
  db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(name, phone, req.user.id);
  res.json({ user: { ...req.user, name, phone } });
});
app.post('/api/auth/password', authLimit, auth(), (req, res) => {
  const u = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id), { current, next } = req.body || {};
  if (typeof current !== 'string' || !bcrypt.compareSync(current, u.password_hash)) return bad(res, 'Current password is wrong', 401);
  if (typeof next !== 'string' || next.length < 8 || next.length > 72) return bad(res, 'New password must be 8-72 characters');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(next, 12), req.user.id);
  res.json({ ok: true });
});

// ---- rooms ----
const CONFLICT = `SELECT 1 FROM bookings WHERE room_id=? AND status IN('confirmed','checked_in') AND check_in<? AND check_out>?`;
app.get('/api/rooms', (req, res) => {
  const { checkIn, checkOut } = req.query, guests = +req.query.guests || 1, type = str(req.query.type, 40);
  let rooms = db.prepare('SELECT * FROM rooms WHERE active=1 AND capacity>=? AND (?=\'\' OR type=?) ORDER BY price').all(guests, type, type);
  const dated = isDate(checkIn) && isDate(checkOut) && checkOut > checkIn;
  rooms = rooms.map(r => ({ ...r, amenities: r.amenities ? r.amenities.split(',') : [],
    available: dated ? !db.prepare(CONFLICT).get(r.id, checkOut, checkIn) : null }));
  res.json({ rooms: dated ? rooms.filter(r => r.available) : rooms });
});
const roomBody = b => ({ number: str(b.number, 10), type: str(b.type, 40), price: +b.price, capacity: +b.capacity | 0,
  description: str(b.description, 400), amenities: str(b.amenities, 300), active: b.active === false || b.active === 0 ? 0 : 1 });
const roomOk = r => r.number && r.type && r.price > 0 && r.capacity > 0;
app.get('/api/admin/rooms', auth(['admin', 'staff']), (req, res) => res.json({ rooms: db.prepare('SELECT * FROM rooms ORDER BY number').all() }));
app.post('/api/admin/rooms', auth(['admin']), (req, res) => {
  const r = roomBody(req.body); if (!roomOk(r)) return bad(res, 'Number, type, price and capacity are required');
  try { const id = db.prepare('INSERT INTO rooms(number,type,price,capacity,description,amenities,active) VALUES(@number,@type,@price,@capacity,@description,@amenities,@active)').run(r).lastInsertRowid; res.status(201).json({ id }); }
  catch { bad(res, 'Room number already exists', 409); }
});
app.put('/api/admin/rooms/:id', auth(['admin']), (req, res) => {
  const r = roomBody(req.body); if (!roomOk(r)) return bad(res, 'Number, type, price and capacity are required');
  try { db.prepare('UPDATE rooms SET number=@number,type=@type,price=@price,capacity=@capacity,description=@description,amenities=@amenities,active=@active WHERE id=@id').run({ ...r, id: +req.params.id }); res.json({ ok: true }); }
  catch { bad(res, 'Room number already exists', 409); }
});

// ---- bookings ----
app.post('/api/bookings', auth(), (req, res) => {
  // Payment is a DEMO simulation: no card data is collected, nothing is charged.
  if (!['success', 'failure'].includes(req.body.simulate)) return bad(res, 'Choose a simulated payment result');
  if (req.body.simulate === 'failure') return bad(res, 'Simulated payment declined. No booking was created.', 402);
  try {
    const r = createBooking(db, req.user.id, { roomId: +req.body.roomId, checkIn: req.body.checkIn, checkOut: req.body.checkOut,
      guests: +req.body.guests || 1, paymentRef: 'DEMO-' + crypto.randomBytes(5).toString('hex').toUpperCase() });
    res.status(201).json(r);
  } catch (e) { if (e instanceof BookingError) return bad(res, e.message, e.status); throw e; }
});
const SEL = `SELECT b.*, r.number room_number, r.type room_type, u.name guest_name, u.email guest_email, u.phone guest_phone
  FROM bookings b JOIN rooms r ON r.id=b.room_id JOIN users u ON u.id=b.user_id`;
app.get('/api/bookings/mine', auth(), (req, res) => res.json({ bookings: db.prepare(SEL + ' WHERE b.user_id=? ORDER BY b.check_in DESC').all(req.user.id) }));
app.get('/api/bookings/:id', auth(), (req, res) => {
  const b = db.prepare(SEL + ' WHERE b.id=?').get(+req.params.id);
  if (!b || (b.user_id !== req.user.id && req.user.role === 'guest')) return bad(res, 'Booking not found', 404);
  res.json({ booking: b });
});
app.post('/api/bookings/:id/cancel', auth(), (req, res) => {
  try { cancelBooking(db, req.user, +req.params.id); res.json({ ok: true }); }
  catch (e) { if (e instanceof BookingError) return bad(res, e.message, e.status); throw e; }
});

// ---- staff / admin ----
app.get('/api/admin/bookings', auth(['admin', 'staff']), (req, res) => {
  const s = str(req.query.status, 20);
  res.json({ bookings: db.prepare(SEL + " WHERE (?='' OR b.status=?) ORDER BY b.check_in DESC LIMIT 200").all(s, s) });
});
const NEXT = { confirmed: ['checked_in'], checked_in: ['checked_out'] };
app.patch('/api/admin/bookings/:id/status', auth(['admin', 'staff']), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(+req.params.id);
  if (!b) return bad(res, 'Booking not found', 404);
  if (!(NEXT[b.status] || []).includes(req.body.status)) return bad(res, `Cannot move from ${b.status} to ${req.body.status}`);
  db.prepare('UPDATE bookings SET status=? WHERE id=?').run(req.body.status, b.id);
  res.json({ ok: true });
});
app.get('/api/admin/guests', auth(['admin', 'staff']), (req, res) => res.json({ guests: db.prepare(
  `SELECT u.id,u.name,u.email,u.phone,u.created_at, COUNT(b.id) stays, COALESCE(SUM(CASE WHEN b.status!='cancelled' THEN b.total END),0) spent
   FROM users u LEFT JOIN bookings b ON b.user_id=u.id WHERE u.role='guest' GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`).all() }));
app.get('/api/admin/stats', auth(['admin', 'staff']), (req, res) => {
  const t = today(), q = (sql, ...p) => db.prepare(sql).get(...p);
  const rooms = q('SELECT COUNT(*) n FROM rooms WHERE active=1').n;
  const occ = q("SELECT COUNT(DISTINCT room_id) n FROM bookings WHERE status IN('confirmed','checked_in') AND check_in<=? AND check_out>?", t, t).n;
  res.json({ rooms, occupied: occ, occupancy: rooms ? Math.round(occ / rooms * 100) : 0,
    arrivals: q("SELECT COUNT(*) n FROM bookings WHERE status='confirmed' AND check_in=?", t).n,
    departures: q("SELECT COUNT(*) n FROM bookings WHERE status='checked_in' AND check_out=?", t).n,
    revenue: q("SELECT COALESCE(SUM(total),0) n FROM bookings WHERE status!='cancelled'").n,
    bookings: q("SELECT COUNT(*) n FROM bookings WHERE status!='cancelled'").n,
    guests: q("SELECT COUNT(*) n FROM users WHERE role='guest'").n });
});

app.get('/health', (q, r) => r.send('ok'));
app.use('/api', (req, res) => bad(res, 'Not found', 404));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: PROD ? '1h' : 0 }));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); bad(res, 'Server error', 500); });
app.listen(process.env.PORT || 3000, () => console.log('HotelPro running on port ' + (process.env.PORT || 3000)));
