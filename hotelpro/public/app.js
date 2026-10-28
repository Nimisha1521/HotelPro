const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const iso = d => d.toISOString().slice(0, 10);
const tomorrow = n => iso(new Date(Date.now() + n * 864e5));
const hues = { Standard: '#33507a', Deluxe: '#2b4a6b', Premium: '#3d3a6b', Family: '#5b4a3a', Suite: '#6b4a5a' };
let user = null, rooms = [], q = { checkIn: tomorrow(1), checkOut: tomorrow(3), guests: 2, type: '' }, tab = 'overview';

async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function modal(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; $('#sheet input,#sheet select')?.focus(); }
const close = () => { $('#modal').hidden = true; };
const staff = () => user && user.role !== 'guest';

function nav() {
  const h = location.hash || '#/', n = $('#nav'); n.classList.remove('open'); $('.burger').setAttribute('aria-expanded', 'false');
  const a = (href, t) => `<a href="${href}" class="${h === href ? 'on' : ''}">${t}</a>`;
  n.innerHTML = [['#/', 'Home'], ['#/rooms', 'Explore Rooms'], ['#/amenities', 'Amenities'], ['#/about', 'About'], ['#/contact', 'Contact']].map(x => a(...x)).join('') +
    (user ? a('#/bookings', 'My bookings') + a('#/account', 'Account') : '') + (staff() ? a('#/admin', 'Management') : '') +
    (user ? `<button data-a="logout">Log out (${esc(user.name.split(' ')[0])})</button>` : `<button data-a="login">Log in</button><button class="btn sm" data-a="register">Register</button>`);
}
async function route() {
  nav(); const h = location.hash || '#/';
  if (h === '#/bookings') return user ? myBookings() : (location.hash = '#/', modal(authForm('login')));
  if (h === '#/admin') return staff() ? admin() : (location.hash = '#/');
  if (h === '#/rooms') return roomsView();
  if (h === '#/confirmation') return lastBooking ? confirmation() : (location.hash = '#/rooms');
  if (h === '#/account') return user ? account() : (location.hash = '#/');
  await landing();
  const sec = { '#/amenities': 'amenities', '#/about': 'about', '#/contact': 'contact' }[h];
  if (sec) document.getElementById(sec)?.scrollIntoView(); else window.scrollTo(0, 0);
}
// Photos live in public/img/ (hero.jpg, rooms/<number>.jpg, amenities/<name>.jpg). Missing photos fall back to a styled panel.
const photo = (p, alt) => `<img src="/img/${p}.jpg" alt="${esc(alt)}" loading="lazy">`;
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.hidden = true; }, true);
const AMEN = [['wifi', 'Wi-Fi'], ['breakfast', 'Breakfast'], ['workspace', 'Work desk'], ['balcony', 'Balcony & views'], ['bathtub', 'Bathtub'], ['lounge', 'Lounge access']];

async function landing() {
  app.innerHTML = `<section class="lhero">${photo('hero', 'Hotel suite with a large bed and city view')}<div class="in">
    <h1>Find your perfect stay</h1><p>Search live availability, choose from 20 room types and confirm your booking in minutes. Prices are shown in rupees, per night, before you commit.</p>
    <div class="cta"><a class="btn" href="#/rooms">Explore Rooms</a><button class="btn line" data-a="${user ? 'rooms' : 'register'}">Book Your Stay</button></div></div>
    <form class="lsearch" id="ls"><label>Property<select disabled><option>HotelPro (demo property)</option></select></label>
    <label>Check-in<input type="date" name="checkIn" min="${tomorrow(0)}" value="${q.checkIn}" required></label>
    <label>Check-out<input type="date" name="checkOut" min="${tomorrow(1)}" value="${q.checkOut}" required></label>
    <label>Guests<input type="number" name="guests" min="1" max="8" value="${q.guests}"></label><button class="btn" style="align-self:end">Search rooms</button></form></section>
  <section class="band"><div class="three">
    <div><h3>Live availability</h3><p>Rooms shown for your dates are checked against current bookings, so you only see what you can actually book.</p></div>
    <div><h3>Clear pricing</h3><p>You see the nightly rate and the full total in INR before you confirm.</p></div>
    <div><h3>Manage your stay</h3><p>Create an account to review, track and cancel your bookings at any time before check-in.</p></div></div></section>
  <section class="band"><h2>Featured stays</h2><p class="lead">A selection from our room catalogue.</p><div class="grid" id="feat"></div></section>
  <section class="band dark" id="amenities"><div><h2>Amenities and experiences</h2><p class="lead">Sample property content for this demo. Each room lists the amenities it includes.</p>
    <div class="amen-grid">${AMEN.map(([k, t]) => `<div class="amen">${photo('amenities/' + k, t)}<span>${t}</span></div>`).join('')}</div></div></section>
  <section class="band" id="about"><h2>About HotelPro</h2><p class="lead">HotelPro is a hotel booking and management platform: guests search and book, staff handle check-in and check-out, and administrators manage rooms and see occupancy and revenue. This site is a demonstration project with sample rooms and a simulated payment step.</p></section>
  <footer class="foot" id="contact"><div class="three"><div><h3>HotelPro</h3><p>Demo hotel booking platform.</p></div>
    <div><h3>Explore</h3><p><a href="#/rooms">Rooms</a><br><a href="#/amenities">Amenities</a><br><a href="#/about">About</a></p></div>
    <div><h3>Contact</h3><p>Contact details are added by the property when the site goes live.</p><p class="note">Payments on this site are simulated. No money is charged.</p></div></div></footer>`;
  $('#ls').onsubmit = e => { e.preventDefault(); q = { ...q, ...Object.fromEntries(new FormData(e.target)) }; location.hash = '#/rooms'; };
  try { const all = (await api('/rooms')).rooms, pick = all.filter(r => ['104', '203', '304', '401'].includes(r.number));
    $('#feat').innerHTML = pick.map(r => `<article class="room"><div class="pic" style="background:linear-gradient(135deg,${hues[r.type] || '#2b3f6b'},#0a1326)">${photo('rooms/' + r.number, r.name)}<span>${esc(r.name)}</span></div>
      <div class="body"><p>${esc(r.description)}</p><div class="tags"><span class="tag">Sleeps ${r.capacity}</span>${r.amenities.slice(3, 6).map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div>
      <div class="price"><span><b>${money(r.price)}</b> / night</span><a class="btn sm" href="#/rooms">View rooms</a></div></div></article>`).join(''); } catch {}
}
// ---------- guest views ----------
// ---------- rooms catalogue ----------
const BEDS = ['Single', 'Double', 'Twin', 'Queen', 'King'], AMS = ['WiFi', 'Breakfast', 'Minibar', 'Balcony', 'Bathtub', 'Lounge access', 'Kitchenette'];
const SORTS = { 'price-asc': ['Price: low to high', (a, b) => a.price - b.price], 'price-desc': ['Price: high to low', (a, b) => b.price - a.price],
  capacity: ['Capacity', (a, b) => b.capacity - a.capacity || a.price - b.price], size: ['Room size', (a, b) => b.size_sqm - a.size_sqm] };
let F = { min: '', max: '', bed: '', am: [], size: '', sort: 'price-asc' };
function roomsView() {
  app.innerHTML = `<div class="pagehead"><h1>${user ? `Hello, ${esc(user.name.split(' ')[0])}! Where would you like to stay?` : 'Explore rooms'}</h1></div>
  <form class="search" id="sf">
    <label>Check-in<input type="date" name="checkIn" min="${tomorrow(0)}" value="${esc(q.checkIn)}"></label>
    <label>Check-out<input type="date" name="checkOut" min="${tomorrow(1)}" value="${esc(q.checkOut)}"></label>
    <label>Guests<input type="number" name="guests" min="1" max="8" value="${esc(q.guests)}"></label>
    <button class="btn" style="align-self:end">Check availability</button></form>
  <section class="wrap"><div class="layout"><aside><button class="btn ghost sm fbtn" data-a="fpanel" aria-expanded="false">Filters</button>
    <form id="ff" class="fpanel"><h3>Filters</h3>
      <div class="row"><label>Min price (₹)<input type="number" name="min" min="0" value="${esc(F.min)}"></label><label>Max price (₹)<input type="number" name="max" min="0" value="${esc(F.max)}"></label></div>
      <label>Bed type<select name="bed"><option value="">Any</option>${BEDS.map(b => `<option ${F.bed === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
      <label>Min room size (m²)<input type="number" name="size" min="0" value="${esc(F.size)}"></label>
      <fieldset><legend>Amenities</legend>${AMS.map(a => `<label class="chk"><input type="checkbox" name="am" value="${a}" ${F.am.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</fieldset>
      <button type="button" class="btn ghost sm" data-a="clear">Clear all filters</button></form></aside>
    <div><div class="rhead"><h2 id="count">Rooms</h2><label>Sort by<select id="sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${F.sort === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label></div>
    <div class="tags" id="chips"></div><div class="grid" id="rooms"></div></div></div></section>`;
  $('#sf').onsubmit = e => { e.preventDefault(); q = { ...q, ...Object.fromEntries(new FormData(e.target)) }; loadRooms(); };
  $('#ff').oninput = () => { const d = new FormData($('#ff')); F = { ...F, min: d.get('min') || '', max: d.get('max') || '', bed: d.get('bed') || '', size: d.get('size') || '', am: d.getAll('am') }; renderRooms(); };
  $('#sort').onchange = e => { F.sort = e.target.value; renderRooms(); };
  loadRooms();
}
async function loadRooms() {
  $('#rooms').innerHTML = '<div class="sk"></div>'.repeat(6);
  try { rooms = (await api('/rooms?' + new URLSearchParams({ checkIn: q.checkIn, checkOut: q.checkOut, guests: q.guests }))).rooms; }
  catch (e) { $('#rooms').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  renderRooms();
}
const filtered = () => rooms.filter(r => (!F.min || r.price >= +F.min) && (!F.max || r.price <= +F.max) && (!F.bed || r.bed_type === F.bed) &&
  (!F.size || r.size_sqm >= +F.size) && F.am.every(a => r.amenities.includes(a))).sort(SORTS[F.sort][1]);
function card(r) {
  return `<article class="room"><div class="pic" style="background:linear-gradient(135deg,${hues[r.type] || '#2b3f6b'},#0a1326)">${photo('rooms/' + r.number, r.name || r.type)}<span>${esc(r.name || r.type)}</span></div>
  <div class="body"><p>${esc(r.bed_type)} bed × ${r.beds} · ${r.size_sqm} m² · Sleeps ${r.capacity}</p><div class="tags">${r.amenities.map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div>
  <div class="price"><span><b>${money(r.price)}</b> / night</span><button class="btn sm" data-a="book" data-id="${r.id}">View &amp; book</button></div></div></article>`;
}
function renderRooms() {
  const l = filtered(), act = [F.min && `From ${money(F.min)}`, F.max && `Up to ${money(F.max)}`, F.bed && `${F.bed} bed`, F.size && `${F.size}+ m²`, ...F.am].filter(Boolean);
  $('#count').textContent = `${l.length} of ${rooms.length} rooms available`;
  $('#chips').innerHTML = act.map(a => `<span class="tag on">${esc(a)}</span>`).join('') + (act.length ? '<button class="btn ghost sm" data-a="clear">Clear all</button>' : '');
  $('#rooms').innerHTML = l.length ? l.map(card).join('') : '<div class="empty">No rooms match these filters or dates. Try clearing filters or choosing other dates.</div>';
}

// ---------- multi-step booking ----------
let bk = null, lastBooking = null;
const STEPS = ['Room', 'Stay', 'Review', 'Payment'];
const nightsOf = () => Math.round((Date.parse(bk.checkOut) - Date.parse(bk.checkIn)) / 864e5);
function openBooking(r) {
  if (!user) { toast('Please log in to book'); return modal(authForm('login')); }
  bk = { r, step: 1, checkIn: q.checkIn, checkOut: q.checkOut, guests: Math.min(+q.guests || 1, r.capacity) }; renderStep();
}
function renderStep(err = '') {
  const r = bk.r, n = nightsOf(), t = n * r.price, s = bk.step;
  const bar = `<ol class="steps">${STEPS.map((x, i) => `<li class="${s === i + 1 ? 'on' : s > i + 1 ? 'done' : ''}">${i + 1}. ${x}</li>`).join('')}</ol>`;
  const back = '<button type="button" class="btn ghost" data-a="back">Back</button>';
  const body = s === 1 ? `<div class="mpic" style="background:linear-gradient(135deg,${hues[r.type] || '#2b3f6b'},#0a1326)">${photo('rooms/' + r.number, r.name)}</div>
      <h2>${esc(r.name)} · Room ${esc(r.number)}</h2><p>${esc(r.description)}</p><p>${esc(r.bed_type)} bed × ${r.beds} · ${r.size_sqm} m² · Sleeps ${r.capacity}</p>
      <div class="tags">${r.amenities.map(a => `<span class="tag">${esc(a)}</span>`).join('')}</div><p><b>${money(r.price)}</b> per night</p><button class="btn" data-a="next">Select this room</button>`
    : s === 2 ? `<h2>Your stay</h2><form class="form" id="sd"><div class="row"><label>Check-in<input type="date" name="checkIn" min="${tomorrow(0)}" value="${esc(bk.checkIn)}" required></label>
      <label>Check-out<input type="date" name="checkOut" min="${tomorrow(1)}" value="${esc(bk.checkOut)}" required></label></div>
      <label>Guests (max ${r.capacity})<input type="number" name="guests" min="1" max="${r.capacity}" value="${bk.guests}" required></label>
      <p class="sum">Booking for ${esc(user.name)} (${esc(user.email)}). Change your details under Account.</p><p class="err" role="alert">${esc(err)}</p><div class="row">${back}<button class="btn" data-a="next">Check &amp; continue</button></div></form>`
    : s === 3 ? `<h2>Review pricing</h2><div class="sum"><span>${esc(r.name)} · ${esc(bk.checkIn)} to ${esc(bk.checkOut)} · ${bk.guests} guest(s)</span>
      <span>${money(r.price)} × ${n} night${n > 1 ? 's' : ''} = ${money(t)}</span><span>Taxes and fees: none configured in this demo</span><b>Total ${money(t)}</b></div><div class="row">${back}<button class="btn" data-a="next">Continue to payment</button></div>`
    : `<h2>Payment (demonstration)</h2><p class="sum">This is a simulated payment. No card details are collected and no money is charged.</p>
      <label>Simulated result<select id="sim"><option value="success">Payment succeeds</option><option value="failure">Payment fails</option></select></label>
      <p class="err" role="alert">${esc(err)}</p><div class="row">${back}<button class="btn" data-a="pay">Run demo payment · ${money(t)}</button></div>`;
  modal(bar + `<div class="stepbody">${body}</div>`);
}
async function stepNext() {
  if (bk.step === 2) {
    const d = Object.fromEntries(new FormData($('#sd'))); Object.assign(bk, { checkIn: d.checkIn, checkOut: d.checkOut, guests: +d.guests });
    if (!bk.checkIn || !bk.checkOut || bk.checkIn < tomorrow(0) || bk.checkOut <= bk.checkIn) return renderStep('Choose valid dates: check-out must be after check-in, and not in the past.');
    if (nightsOf() > 30) return renderStep('Stays are limited to 30 nights.');
    if (!(bk.guests >= 1 && bk.guests <= bk.r.capacity)) return renderStep(`This room sleeps up to ${bk.r.capacity}.`);
    try { const ok = (await api('/rooms?' + new URLSearchParams({ checkIn: bk.checkIn, checkOut: bk.checkOut, guests: bk.guests }))).rooms.some(x => x.id === bk.r.id);
      if (!ok) return renderStep('This room is not available for those dates.'); } catch (e) { return renderStep(e.message); }
  }
  bk.step++; renderStep();
}
async function pay(btn) {
  btn.disabled = true;
  try { const d = await api('/bookings', 'POST', { roomId: bk.r.id, checkIn: bk.checkIn, checkOut: bk.checkOut, guests: bk.guests, simulate: $('#sim').value });
    lastBooking = { ...d, room: bk.r, checkIn: bk.checkIn, checkOut: bk.checkOut, guests: bk.guests }; close(); location.hash = '#/confirmation'; }
  catch (e) { renderStep(e.message); }
}
function confirmation() {
  const b = lastBooking, r = b.room;
  app.innerHTML = `<section class="wrap done"><svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg>
  <h1>Booking confirmed</h1><p class="lead">Reference <b>#${b.id}</b> · Payment: demo only, no money was charged (${esc(b.paymentRef)})</p>
  <div class="panel conf"><div class="mpic" style="background:linear-gradient(135deg,${hues[r.type] || '#2b3f6b'},#0a1326)">${photo('rooms/' + r.number, r.name)}</div>
  <dl><dt>Room</dt><dd>${esc(r.name)} (${esc(r.number)})</dd><dt>Guest</dt><dd>${esc(user.name)}</dd><dt>Check-in</dt><dd>${esc(b.checkIn)}</dd><dt>Check-out</dt><dd>${esc(b.checkOut)}</dd>
  <dt>Nights</dt><dd>${b.nights}</dd><dt>Guests</dt><dd>${b.guests}</dd><dt>Total</dt><dd>${money(b.total)}</dd></dl></div>
  <div class="cta"><a class="btn" href="#/bookings">View my bookings</a><a class="btn ghost" href="#/rooms">Explore more rooms</a><a class="btn ghost" href="#/">Home</a></div></section>`;
}

function authForm(mode) {
  const reg = mode === 'register';
  setTimeout(() => $('#af').onsubmit = async e => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    if (reg && b.password !== b.confirm) return void ($('#err').textContent = 'Passwords do not match');
    try { user = (await api('/auth/' + mode, 'POST', b)).user; close(); nav(); toast('Welcome, ' + user.name.split(' ')[0]); route(); }
    catch (x) { $('#err').textContent = x.message; }
  });
  return `<h2>${reg ? 'Create your account' : 'Welcome back'}</h2><form class="form" id="af">
  ${reg ? '<label>Full name<input name="name" required></label>' : ''}<label>Email<input name="email" type="email" required></label>
  ${reg ? '<label>Phone<input name="phone" type="tel"></label>' : ''}<label>Password<input name="password" type="password" minlength="8" required></label>
  ${reg ? '<label>Confirm password<input name="confirm" type="password" minlength="8" required></label>' : ''}
  <p class="err" id="err"></p><button class="btn">${reg ? 'Sign up' : 'Log in'}</button>
  <button type="button" class="btn ghost" data-a="${reg ? 'login' : 'register'}">${reg ? 'I already have an account' : 'Create an account'}</button></form>`;
}
const statusPill = s => `<span class="pill ${s}">${s.replace('_', ' ')}</span>`;
const PAY = { demo_paid: 'Demo payment (no charge)', demo_cancelled: 'Demo payment cancelled', paid: 'Paid (earlier version)', refunded: 'Cancelled' };
async function myBookings() {
  const { bookings } = await api('/bookings/mine'), t = tomorrow(0);
  const up = bookings.filter(b => ['confirmed', 'checked_in'].includes(b.status) && b.check_out >= t), past = bookings.filter(b => !up.includes(b));
  const tbl = l => l.length ? `<table><tr><th>Ref</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th></th></tr>${l.map(b => `<tr><td>#${b.id}</td><td>${esc(b.room_type)} ${esc(b.room_number)}</td>
    <td>${b.check_in} to ${b.check_out}</td><td>${money(b.total)}</td><td>${statusPill(b.status)}</td><td><button class="btn ghost sm" data-a="details" data-id="${b.id}">Details</button>
    ${b.status === 'confirmed' ? `<button class="btn danger sm" data-a="cancel" data-id="${b.id}">Cancel</button>` : ''}</td></tr>`).join('')}</table>` : '<div class="empty">Nothing here yet.</div>';
  app.innerHTML = `<section class="wrap"><h2>My bookings</h2><h3 style="margin-top:18px">Upcoming stays</h3><div class="panel">${tbl(up)}</div><h3 style="margin-top:18px">Past and cancelled</h3><div class="panel">${tbl(past)}</div></section>`;
}
async function bookingDetails(id) {
  const { booking: b } = await api('/bookings/' + id);
  modal(`<h2>Booking #${b.id}</h2><dl class="dl"><dt>Room</dt><dd>${esc(b.room_type)} ${esc(b.room_number)}</dd><dt>Dates</dt><dd>${b.check_in} to ${b.check_out}</dd><dt>Guests</dt><dd>${b.guests}</dd>
  <dt>Total</dt><dd>${money(b.total)}</dd><dt>Status</dt><dd>${statusPill(b.status)}</dd><dt>Payment</dt><dd>${esc(PAY[b.payment_status] || b.payment_status)}</dd><dt>Reference</dt><dd>${esc(b.payment_ref || '-')}</dd></dl>`);
}
function account() {
  app.innerHTML = `<section class="wrap"><h2>Account</h2><div class="panel"><form class="form" id="pf" style="max-width:420px"><label>Full name<input name="name" value="${esc(user.name)}" required></label>
  <label>Phone<input name="phone" type="tel" value="${esc(user.phone)}"></label><label>Email<input value="${esc(user.email)}" disabled></label><p class="err" id="e1"></p><button class="btn">Save details</button></form></div>
  <div class="panel"><form class="form" id="pw" style="max-width:420px"><h3>Change password</h3><label>Current password<input name="current" type="password" required></label>
  <label>New password<input name="next" type="password" minlength="8" required></label><p class="err" id="e2"></p><button class="btn">Update password</button></form></div></section>`;
  $('#pf').onsubmit = async e => { e.preventDefault(); try { user = (await api('/auth/me', 'PATCH', Object.fromEntries(new FormData(e.target)))).user; nav(); toast('Details saved'); } catch (x) { $('#e1').textContent = x.message; } };
  $('#pw').onsubmit = async e => { e.preventDefault(); try { await api('/auth/password', 'POST', Object.fromEntries(new FormData(e.target))); e.target.reset(); toast('Password updated'); } catch (x) { $('#e2').textContent = x.message; } };
}

// ---------- management ----------
async function admin() {
  app.innerHTML = `<section class="wrap"><h2>Management</h2><div class="tabs">${['overview', 'bookings', 'rooms', 'guests'].map(t => `<button class="${tab === t ? 'on' : ''}" data-a="tab" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div><div id="tabc"></div></section>`;
  const box = $('#tabc');
  try {
    if (tab === 'overview') {
      const s = await api('/admin/stats');
      box.innerHTML = `<div class="stats">${[['Occupancy today', s.occupancy + '%'], ['Arrivals today', s.arrivals], ['Departures today', s.departures], ['Active bookings', s.bookings], ['Revenue', money(s.revenue)], ['Guests', s.guests]].map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div class="panel"><b>${s.occupied} of ${s.rooms} rooms occupied</b><div class="bar"><i style="width:${s.occupancy}%"></i></div></div>`;
    } else if (tab === 'bookings') {
      const { bookings } = await api('/admin/bookings');
      box.innerHTML = `<div class="panel"><table><tr><th>Ref</th><th>Guest</th><th>Room</th><th>Dates</th><th>Total</th><th>Status</th><th>Action</th></tr>${bookings.map(b => `<tr>
      <td>#${b.id}</td><td>${esc(b.guest_name)}<br><small>${esc(b.guest_email)}</small></td><td>${esc(b.room_number)}</td><td>${b.check_in} to ${b.check_out}</td><td>${money(b.total)}</td><td>${statusPill(b.status)}</td>
      <td>${b.status === 'confirmed' ? `<button class="btn sm" data-a="status" data-id="${b.id}" data-s="checked_in">Check in</button>` : b.status === 'checked_in' ? `<button class="btn sm" data-a="status" data-id="${b.id}" data-s="checked_out">Check out</button>` : ''}</td></tr>`).join('')}</table></div>`;
    } else if (tab === 'rooms') {
      const { rooms } = await api('/admin/rooms');
      box.innerHTML = `${user.role === 'admin' ? '<p><button class="btn sm" data-a="room">Add room</button></p>' : ''}<div class="panel"><table><tr><th>No.</th><th>Type</th><th>Price</th><th>Sleeps</th><th>Active</th><th></th></tr>${rooms.map(r => `<tr>
      <td>${esc(r.number)}</td><td>${esc(r.type)}</td><td>${money(r.price)}</td><td>${r.capacity}</td><td>${r.active ? 'Yes' : 'No'}</td>
      <td>${user.role === 'admin' ? `<button class="btn ghost sm" data-a="room" data-id="${r.id}">Edit</button>` : ''}</td></tr>`).join('')}</table></div>`;
      box._rooms = rooms; window._rooms = rooms;
    } else {
      const { guests } = await api('/admin/guests');
      box.innerHTML = `<div class="panel"><table><tr><th>Name</th><th>Email</th><th>Phone</th><th>Bookings</th><th>Spent</th></tr>${guests.map(g => `<tr><td>${esc(g.name)}</td><td>${esc(g.email)}</td><td>${esc(g.phone)}</td><td>${g.stays}</td><td>${money(g.spent)}</td></tr>`).join('')}</table></div>`;
    }
  } catch (e) { toast(e.message); }
}
function roomForm(r = {}) {
  modal(`<h2>${r.id ? 'Edit' : 'Add'} room</h2><form class="form" id="rf">
  <div class="row"><label>Number<input name="number" value="${esc(r.number)}" required></label><label>Type<input name="type" value="${esc(r.type)}" required></label></div>
  <div class="row"><label>Price / night<input name="price" type="number" min="1" value="${esc(r.price)}" required></label><label>Sleeps<input name="capacity" type="number" min="1" value="${esc(r.capacity)}" required></label></div>
  <label>Description<textarea name="description">${esc(r.description)}</textarea></label><label>Amenities (comma separated)<input name="amenities" value="${esc(r.amenities)}"></label>
  <label><span><input type="checkbox" name="active" style="width:auto" ${r.active !== 0 ? 'checked' : ''}> Available for booking</span></label>
  <p class="err" id="err"></p><button class="btn">Save room</button></form>`);
  $('#rf').onsubmit = async e => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.active = !!b.active;
    try { await api('/admin/rooms' + (r.id ? '/' + r.id : ''), r.id ? 'PUT' : 'POST', b); close(); toast('Room saved'); admin(); } catch (x) { $('#err').textContent = x.message; } };
}

// ---------- events ----------
document.addEventListener('click', async e => {
  if (e.target.id === 'modal') return close();
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, id = +el.dataset.id;
  try {
    if (a === 'close') close();
    else if (a === 'burger') { const n = $('#nav'); el.setAttribute('aria-expanded', String(n.classList.toggle('open'))); }
    else if (a === 'rooms') location.hash = '#/rooms';
    else if (a === 'login' || a === 'register') modal(authForm(a));
    else if (a === 'logout') { await api('/auth/logout', 'POST'); user = null; location.hash = '#/'; route(); }
    else if (a === 'book') openBooking(rooms.find(r => r.id === id));
    else if (a === 'next') await stepNext();
    else if (a === 'back') { bk.step--; renderStep(); }
    else if (a === 'pay') await pay(el);
    else if (a === 'details') await bookingDetails(id);
    else if (a === 'clear') { F = { ...F, min: '', max: '', bed: '', size: '', am: [] }; $('#ff').reset(); renderRooms(); }
    else if (a === 'fpanel') el.setAttribute('aria-expanded', $('#ff').classList.toggle('open'));
    else if (a === 'cancel' && confirm('Cancel this booking?')) { await api(`/bookings/${id}/cancel`, 'POST'); toast('Booking cancelled'); myBookings(); }
    else if (a === 'tab') { tab = el.dataset.t; admin(); }
    else if (a === 'status') { await api(`/admin/bookings/${id}/status`, 'PATCH', { status: el.dataset.s }); toast('Updated'); admin(); }
    else if (a === 'room') roomForm(window._rooms?.find(r => r.id === id));
  } catch (x) { toast(x.message); }
});
document.addEventListener('keydown', e => e.key === 'Escape' && close());
window.addEventListener('hashchange', route);
(async () => { try { user = (await api('/auth/me')).user; } catch {} route(); })();
