# HotelPro

Hotel booking and management system: guest booking site, staff check-in/out desk, admin dashboard.

**Stack:** Node.js 18+, Express, SQLite (better-sqlite3, WAL, indexed), vanilla JS single-page frontend served by Express.

## Run locally
    npm install
    npm start            # http://localhost:3000
First start seeds 7 rooms and an admin account (printed in the console; dev default `admin@hotelpro.local` / `Admin@12345`).

## Deploy
Set env vars from `.env.example` (JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, DB_PATH).
- **Render / Railway / Fly.io:** connect the repo, build `npm install`, start `npm start`, attach a persistent disk and point `DB_PATH` at it, health check `/health`.
- **Docker:** `docker build -t hotelpro . && docker run -p 3000:3000 -v hp:/data -e JWT_SECRET=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... hotelpro`
- Put it behind HTTPS (cookies are `secure` in production).

## Features
- Guests: sign up/log in, live availability search by dates, guests and type, booking with payment, cancel with refund status, booking history.
- Staff: arrivals/departures, check-in and check-out, guest list.
- Admin: occupancy and revenue dashboard, add/edit rooms and pricing.

## Security
bcrypt (cost 12) password hashing, JWT in httpOnly SameSite=Strict cookie, role-based access (guest/staff/admin), Helmet headers, rate limiting (stricter on auth), parameterised SQL, input validation, XSS-escaped rendering, double-booking prevented inside a DB transaction.

## Payments (demo only)
Payment is **simulated**. The booking dialog has a "payment succeeds / fails" switch; no card details are collected or stored and no money is charged. To take real payments, integrate Stripe or Razorpay in test mode with server-side verification.

## Booking rules and tests
All reservations go through `lib/booking.js`: validate dates, take the SQLite write lock (`BEGIN IMMEDIATE`), re-check overlap, insert, commit. Overlap rule: `existing.check_in < new.check_out AND existing.check_out > new.check_in` (same-day turnover allowed); cancelled and checked-out bookings do not block. A database trigger rejects overlapping active bookings even from raw SQL.

    npm test        # 17 tests, uses your installed SQLite driver (better-sqlite3), falls back to node:sqlite on Node 22+
The HTTP layer (Express routes, login, cookies) is not covered by automated tests yet.

## Windows setup
    cd hotelpro
    npm install
    copy .env.example .env     (then edit; or set JWT_SECRET in the terminal: set JWT_SECRET=some-long-random-text)
    npm run dev
Open http://localhost:3000. The database file is created automatically in `data\hotelpro.db`; the 20 sample rooms are loaded on every start (existing room numbers are updated to the sample catalogue, bookings are kept).

## Known limitations
- No photos are bundled (see Photos below); no demo video; payment is simulated; no automated tests for HTTP routes or the browser UI.
- Rooms have no ratings (no review data), so rating filters/sorting are omitted.
- Taxes and discounts are not implemented.

## Scaling
SQLite handles a single hotel or small group comfortably. For large chains, swap `db.js` for PostgreSQL (the schema is standard SQL) and run multiple instances.

## Demo video script (about 2 minutes)
1. Home page, search dates, show live availability. 2. Sign up, book a room with test card 4242 4242 4242 4242, any future expiry, any CVC. 3. My bookings, cancel one. 4. Log in as admin: dashboard, check a guest in and out, edit a room price. Record with Loom or OBS and upload to YouTube (unlisted).

## Photos (stage 2)
No photos are bundled. Download licensed images (e.g. from Unsplash or Pexels, check each licence) and save them as JPG in `public/img/`:
`hero.jpg`, `rooms/101.jpg` ... `rooms/401.jpg` (one per room number), `amenities/wifi.jpg`, `breakfast.jpg`, `workspace.jpg`, `balcony.jpg`, `bathtub.jpg`, `lounge.jpg`.
Any missing photo falls back to a navy panel with the room name, so the site still works without them.
