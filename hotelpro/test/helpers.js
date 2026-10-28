const fs = require('fs'), os = require('os'), path = require('path');
const { apply } = require('../lib/schema'), { seedRooms } = require('../lib/seed');
function open(file = ':memory:') {
  try { return new (require('better-sqlite3'))(file); } catch { return new (require('node:sqlite').DatabaseSync)(file); }
}
function fresh(file) {
  const db = apply(open(file)); db.exec('PRAGMA foreign_keys=ON'); seedRooms(db);
  const u = db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)");
  const ids = ['A', 'B', 'S'].map((n, i) => Number(u.run('User ' + n, n.toLowerCase() + '@t.io', 'x', i === 2 ? 'staff' : 'guest').lastInsertRowid));
  return { db, A: { id: ids[0], role: 'guest' }, B: { id: ids[1], role: 'guest' }, S: { id: ids[2], role: 'staff' } };
}
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hp-')), 't.db');
module.exports = { open, fresh, day, tmpFile };
