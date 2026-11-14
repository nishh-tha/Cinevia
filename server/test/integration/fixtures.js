// Helpers for the real-MySQL integration tests. Creates its own users + a far-future showtime, and removes them afterwards.
process.env.JWT_SECRET = process.env.JWT_SECRET || "t".repeat(40);
const config = require("../../config");

// Safety: these tests WRITE rows. Refuse to run against anything that is not an obvious test database.
if (/aivencloud/i.test(config.db.host) || !/bench|test/i.test(config.db.database || "")) {
  throw new Error(`Refusing to run integration tests against host="${config.db.host}" db="${config.db.database}". ` +
    "Point DB_HOST/DB_NAME at your local throw-away database (the database name must contain 'bench' or 'test').");
}
if (!config.db.password) throw new Error("DB_PASSWORD is not set. Set the local-database variables first (see instructions).");

const db = require("../../db/database");
const { toMysqlUtc } = require("../../utils/time");

const runId = Math.random().toString(36).slice(2, 8);
let counter = 0;

async function createUsers(count) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const k = ++counter;
    const [r] = await db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [`it_${runId}_${k}`, `it_${runId}_${k}@example.com`, "not-a-real-hash"]);
    ids.push(r.insertId);
  }
  return ids;
}

// A showtime far in the future on the first seeded screen (unique start time, so it never collides with real shows).
async function createShow() {
  const [[screen]] = await db.query("SELECT id FROM rs_screens ORDER BY id LIMIT 1");
  const [[movie]] = await db.query("SELECT id FROM rs_movies ORDER BY id LIMIT 1");
  if (!screen || !movie) throw new Error("No screens/movies found. Run `npm run migrate` and `npm run seed` on the test database first.");
  const startsAt = new Date(Date.UTC(2035, 0, 1) + Math.floor(Math.random() * 1e6) * 60000);
  const [r] = await db.query(
    "INSERT INTO rs_showtimes (movie_id, screen_id, starts_at, base_price_paise) VALUES (?, ?, ?, 25000)",
    [movie.id, screen.id, toMysqlUtc(startsAt)]);
  return { showId: r.insertId, screenId: screen.id };
}

async function cleanup({ showIds = [], userIds = [] }) {
  if (showIds.length) {
    await db.query("DELETE FROM rs_booking_seats WHERE showtime_id IN (?)", [showIds]);
    await db.query("DELETE FROM rs_bookings WHERE showtime_id IN (?)", [showIds]);
    await db.query("DELETE FROM rs_showtimes WHERE id IN (?)", [showIds]);
  }
  if (userIds.length) await db.query("DELETE FROM users WHERE id IN (?)", [userIds]);
}

// Seats of a show that are currently sold, as labels like "A1".
async function soldLabels(showId) {
  const [rows] = await db.query(
    `SELECT ss.row_label, ss.seat_number FROM rs_booking_seats bs JOIN rs_screen_seats ss ON ss.id = bs.seat_id
      WHERE bs.showtime_id = ? AND bs.active_key = 1 ORDER BY ss.row_label, ss.seat_number`, [showId]);
  return rows.map((r) => `${r.row_label}${r.seat_number}`);
}

// Must always be empty. The unique key makes it impossible, this proves it.
async function duplicateActiveSeats(showId) {
  const [rows] = await db.query(
    "SELECT seat_id, COUNT(*) c FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1 GROUP BY seat_id HAVING c > 1", [showId]);
  return rows;
}

async function count(sql, params) { const [[r]] = await db.query(sql, params); return Number(Object.values(r)[0]); }

module.exports = { db, config, createUsers, createShow, cleanup, soldLabels, duplicateActiveSeats, count };