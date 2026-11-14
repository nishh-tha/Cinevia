// DB-only seat locking: MySQL InnoDB transaction + SELECT ... FOR UPDATE.
// Never touches Redis (cache/holdStore) - it is the alternative to the Redis hold flow.
const { randomUUID } = require("crypto");
const db = require("../db/database");
const config = require("../config");
const { HttpError } = require("../utils/errors");
const { positiveInt, fail } = require("../utils/validation");
const catalog = require("./catalogService");
const seatService = require("./seatService");
const bookings = require("./bookingService");
const { totals } = require("../utils/pricing");

const MAX_RETRIES = 2;                                        // extra attempts after a deadlock / lock-wait timeout
const RETRYABLE = new Set(["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readInput(body = {}) {
  const showId = positiveInt(body.showId ?? body.showtimeId, "showId");
  const inputs = body.seatIds;
  if (!Array.isArray(inputs) || inputs.length === 0) throw fail("Select at least one seat.");
  if (inputs.length > config.booking.maxSeatsPerBooking)
    throw new HttpError(400, "TOO_MANY_SEATS", `You can select up to ${config.booking.maxSeatsPerBooking} seats.`);
  if (inputs.some((x) => typeof x !== "string" && typeof x !== "number")) throw fail("seatIds must be seat labels like \"A1\".");
  return { showId, inputs };
}

// One request -> one transaction: lock seat rows, check they are free, insert booking, commit.
async function createDirectBooking(userId, body) {
  const { showId, inputs } = readInput(body);

  // Same validation/pricing work the Redis flow does, so the comparison is fair.
  const show = await catalog.loadShow(showId);
  if (!catalog.isBookable(show)) throw new HttpError(409, "SHOW_CLOSED", "This show is no longer open for booking.");
  const dbSeats = await seatService.resolveSeats(show, inputs);
  const seats = dbSeats.map((s) => catalog.seatBase(show, s));
  const labelOf = new Map(seats.map((s) => [s.seatId, s.id]));
  const seatIds = seats.map((s) => s.seatId).sort((a, b) => a - b);   // sorted = same lock order for everyone
  const t = totals(seats.map((s) => s.pricePaise));
  const bookingToken = randomUUID();   // rs_bookings.hold_id is NOT NULL UNIQUE; direct bookings have no hold, so store a fresh UUID

  let bookingId, lockWaitMs = 0, retries = 0;
  for (let attempt = 0; ; attempt++) {
    const conn = await db.getConnection();
    let retry = false;
    try {
      await conn.beginTransaction();

      // 1) LOCK: primary-key lookup only (record locks, no gap locks). Waits here if another request holds these seats.
      const t0 = Date.now();
      await conn.query("SELECT id FROM rs_screen_seats WHERE id IN (?) ORDER BY id FOR UPDATE", [seatIds]);
      lockWaitMs += Date.now() - t0;

      // 2) CHECK: plain read (no FOR UPDATE on rs_booking_seats, to avoid gap locks). The snapshot is taken after the lock.
      const [sold] = await conn.query(
        "SELECT seat_id FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1 AND seat_id IN (?)", [show.id, seatIds]);
      if (sold.length)
        throw new HttpError(409, "SEATS_UNAVAILABLE", "Some of those seats were just booked. Please choose different seats.",
          { seats: sold.map((r) => labelOf.get(r.seat_id)), via: "lock-check" });

      // 3) WRITE
      const [r] = await conn.query(
        "INSERT INTO rs_bookings (user_id, showtime_id, hold_id, status, total_paise, fee_paise) VALUES (?, ?, ?, 'CONFIRMED', ?, ?)",
        [userId, show.id, bookingToken, t.totalPaise, t.feePaise]);
      bookingId = r.insertId;
      await conn.query(
        "INSERT INTO rs_booking_seats (booking_id, showtime_id, seat_id, price_paise, active_key) VALUES ?",
        [seats.map((s) => [bookingId, show.id, s.seatId, s.pricePaise, 1])]);

      await conn.commit();   // releases the seat locks
      break;
    } catch (e) {
      try { await conn.rollback(); } catch { /* connection already gone */ }
      if (e instanceof HttpError) throw e;
      if (RETRYABLE.has(e.code)) {
        if (attempt >= MAX_RETRIES) throw new HttpError(503, "BOOKING_BUSY", "Too many people are booking these seats. Please try again.");
        retry = true;
      } else if (e.code === "ER_DUP_ENTRY") {   // safety net: the unique key caught what the lock check did not
        throw new HttpError(409, "SEATS_UNAVAILABLE", "Some of those seats were just booked by someone else. Please choose different seats.", { via: "unique-key" });
      } else if (e.code === "ER_NO_REFERENCED_ROW_2") {
        throw new HttpError(401, "UNAUTHENTICATED", "Your account no longer exists. Please log in again.");
      } else {
        throw e;
      }
    } finally {
      conn.release();
    }
    if (retry) { retries++; await sleep(5 + Math.random() * 20 * (attempt + 1)); }
  }

  const booking = await bookings.getBooking(userId, bookingId);
  return { booking, lockWaitMs, retries };
}

module.exports = { createDirectBooking };