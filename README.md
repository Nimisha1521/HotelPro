# HotelPro

A hotel booking and management web application. Guests can search live room availability, book a stay and manage their reservations. Staff handle check-in and check-out, and administrators manage rooms and view occupancy and revenue.

> This is a demonstration project. The room catalogue is sample data and **payments are simulated**: no card details are collected and no money is charged.

## Features

**Guests**
- Register and log in (passwords hashed, session in an httpOnly cookie)
- Landing page with search by check-in, check-out and guests
- Catalogue of 20 room types priced in INR, with filters (price, bed type, room size, amenities) and sorting (price, capacity, size)
- Four-step booking flow (room, stay, price review, demo payment) and a confirmation page
- My Bookings (upcoming and past), booking details and cancellation
- Account page to update name and phone, and change password

**Staff and admin**
- Dashboard: occupancy, arrivals, departures, bookings, revenue, guests
- Check guests in and out
- Guest list
- Admin only: add and edit rooms and prices

## Tech stack

- Node.js 18+ and Express
- SQLite (`better-sqlite3`)
- Vanilla JavaScript single-page frontend served by Express (no build step)
- Security: bcrypt, JWT cookies, Helmet, rate limiting

## Project structure

```
hotelpro/
  server.js        Express routes, authentication, security
  db.js            Opens the SQLite database
  lib/
    schema.js      Tables, indexes and the overlap-blocking trigger
    booking.js     Booking and cancellation rules
    seed.js        The 20 sample rooms
  test/            Automated booking tests
  public/          Website (index.html, app.js, style.css, img/)
  Dockerfile
  .env.example
```

## Getting started

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone <your-repository-url>
cd hotelpro
npm install
```

Create your settings file:

```bash
# macOS / Linux
cp .env.example .env
# Windows (Command Prompt)
copy .env.example .env
```

Edit `.env` (see the table below), then start the app:

```bash
npm run dev
```

Open http://localhost:3000. The database file is created automatically in `data/hotelpro.db`, the 20 sample rooms are loaded, and an admin account is created. The admin login is printed in the terminal the first time the server starts.

If you skip `.env` in development, the server uses a built-in development secret and the default admin `admin@hotelpro.local` / `Admin@12345`. Never use these defaults in production.

### Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set to `production` when deploying |
| `PORT` | Port to listen on (default 3000) |
| `JWT_SECRET` | Long random string used to sign login tokens (required in production) |
| `ADMIN_EMAIL` | Email of the admin account created on first start |
| `ADMIN_PASSWORD` | Password of that admin account |
| `DB_PATH` | Location of the SQLite file (default `./data/hotelpro.db`) |

The admin account is only created when the database has no users. To change it later, delete the database file first (this removes all data).

## Photos

No photos are bundled. Add your own licensed JPG images to `public/img/`:

```
public/img/hero.jpg
public/img/rooms/101.jpg ... 110.jpg, 201.jpg ... 205.jpg, 301.jpg ... 304.jpg, 401.jpg
public/img/amenities/wifi.jpg, breakfast.jpg, workspace.jpg, balcony.jpg, bathtub.jpg, lounge.jpg
```

Filenames must match exactly, with a lowercase `.jpg` extension. A missing photo is replaced by a styled panel, so the site still works without them.

## Booking rules and tests

All reservations go through `lib/booking.js`: validate the dates, take the SQLite write lock (`BEGIN IMMEDIATE`), re-check for overlap, insert, commit. A booking overlaps an existing one when:

```
existing.check_in < new.check_out AND existing.check_out > new.check_in
```

so a new guest may check in on the previous guest's check-out day. Cancelled and checked-out bookings do not block a room. A database trigger also rejects overlapping active bookings from any source.

```bash
npm test
```

The 17 tests cover valid bookings, partial, contained and covering overlaps, same-day turnover, cancellation, invalid dates, guest capacity, duplicate and simultaneous requests, two database connections, the trigger, cancel permissions and data surviving a restart. The HTTP routes and the browser interface are not covered by automated tests.

## API overview

| Method and path | Access |
|---|---|
| `POST /api/auth/register`, `/login`, `/logout` | Public |
| `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/password` | Logged in |
| `GET /api/rooms` (supports `checkIn`, `checkOut`, `guests`, `type`) | Public |
| `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel` | Logged in (own bookings only; staff and admin can access any) |
| `GET /api/admin/bookings`, `PATCH /api/admin/bookings/:id/status`, `GET /api/admin/guests`, `GET /api/admin/stats`, `GET /api/admin/rooms` | Staff and admin |
| `POST /api/admin/rooms`, `PUT /api/admin/rooms/:id` | Admin |
| `GET /health` | Public |

## Security

- Passwords hashed with bcrypt (cost 12)
- JWT stored in an httpOnly, SameSite=Strict cookie (Secure in production)
- Role-based access control (guest, staff, admin)
- Helmet security headers and request rate limiting, stricter on login and registration
- Parameterised SQL queries, server-side validation, escaped output in the frontend
- No secrets in the code: `.env` is git-ignored and `.env.example` holds placeholders

## Deployment

Set the environment variables above and run `npm start`. Because the data lives in one SQLite file, attach a persistent disk and point `DB_PATH` at it, and run a single instance of the app. A `Dockerfile` is included:

```bash
docker build -t hotelpro .
docker run -p 3000:3000 -v hotelpro-data:/data \
  -e NODE_ENV=production -e JWT_SECRET=change-me-to-a-long-random-string \
  -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=change-me \
  -e DB_PATH=/data/hotelpro.db hotelpro
```

Serve the app over HTTPS in production.

## Known limitations

- Payments are simulated; there is no real payment provider
- Taxes, discounts and room ratings are not implemented
- The room catalogue is sample content, and contact details are placeholders
- SQLite suits a single hotel or a small group; a large chain would need PostgreSQL

## License

Add a license of your choice (for example MIT) before publishing.
