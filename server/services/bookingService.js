const db = require("../db/database");
const { HttpError } = require("../utils/errors");
const { positiveInt } = require("../utils/validation");
const catalog = require("./catalogService");
const holdService = require("./holdService");
const store = require("../cache/holdStore");
const { totals, totalsView, paiseToRupees } = require("../utils/pricing");
const { formatTime, formatDate } = require("../utils/time");

const DEMO_NOTE = "Demo booking: no payment was taken or is required.";

const BOOKING_SQL = `
  SELECT b.id, b.user_id, b.showtime_id, b.status, b.total_paise, b.fee_paise, b.created_at, b.cancelled_at,
         s.starts_at, s.status show_status, sc.name screen_name,
         m.id movie_id, m.title, m.language, m.color,
         c.id cinema_id, c.name cinema_name, c.address, ci.name city_name
    FROM rs_bookings b
    JOIN rs_showtimes s ON s.id = b.showtime_id
    JOIN rs_screens sc ON sc.id = s.screen_id
    JOIN rs_cinemas c ON c.id = sc.cinema_id
    JOIN rs_cities ci ON ci.id = c.city_id
    JOIN rs_movies m ON m.id = s.movie_id`;

async function loadViews(whereSql, params, limit = 50) {
  const [rows] = await db.query(`${BOOKING_SQL} WHERE ${whereSql} ORDER BY b.id DESC LIMIT ${Number(limit)}`, params);
  if (!rows.length) return [];
  const [seatRows] = await db.query(
    `SELECT bs.booking_id, bs.price_paise, ss.row_label, ss.seat_number, ss.category
       FROM rs_booking_seats bs JOIN rs_screen_seats ss ON ss.id = bs.seat_id
      WHERE bs.booking_id IN (?) ORDER BY ss.row_label, ss.seat_number`, [rows.map((r) => r.id)]);
  const seatsBy = new Map();
  for (const r of seatRows) {
    if (!seatsBy.has(r.booking_id)) seatsBy.set(r.booking_id, []);
    seatsBy.get(r.booking_id).push({
      id: catalog.label(r.row_label, r.seat_number), row: r.row_label, number: r.seat_number,
      category: catalog.CATEGORY[r.category], price: paiseToRupees(r.price_paise),
    });
  }
  return rows.map((r) => bookingView(r, seatsBy.get(r.id) || []));
}

function bookingView(r, seats) {
  const startsAt = new Date(r.starts_at);
  const date = formatDate(startsAt, catalog.TZ), time = formatTime(startsAt, catalog.TZ);
  const poster = catalog.poster(r.color);
  return {
    id: r.id,
    status: r.status,                         // CONFIRMED | CANCELLED
    paymentStatus: "No payment taken (demo)",
    demo: true,
    note: DEMO_NOTE,
    movie: { id: r.movie_id, title: r.title, language: r.language, poster },
    poster,
    cinema: { id: r.cinema_id, name: r.cinema_name, address: r.address, city: r.city_name },
    screen: r.screen_name,
    showId: r.showtime_id,
    startsAt: startsAt.toISOString(),
    date, time,
    showtime: `${date} ${time}`,
    seats,
    ...totalsView({ ticketsPaise: r.total_paise - r.fee_paise, feePaise: r.fee_paise, totalPaise: r.total_paise }),
    createdAt: new Date(r.created_at).toISOString(),
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
    cancellable: r.status === "CONFIRMED" && r.show_status === "ACTIVE" && startsAt > new Date(),
  };
}

async function getBooking(userId, bookingId) {
  const [b] = await loadViews("b.id = ? AND b.user_id = ?", [positiveInt(bookingId, "Booking id"), userId], 1);
  if (!b) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking not found.");   // also hides other users' bookings
  return b;
}

const myBookings = (userId) => loadViews("b.user_id = ?", [userId]);

async function findByHold(userId, holdId) {
  const [rows] = await db.query("SELECT id, user_id FROM rs_bookings WHERE hold_id = ?", [holdId]);
  if (!rows[0]) return null;
  if (rows[0].user_id !== userId) throw new HttpError(404, "HOLD_NOT_FOUND", "Hold not found.");
  return rows[0].id;
}

// Turns your active hold into a CONFIRMED booking. No payment is involved (demo flow).
// Double-booking is impossible even if holds are lost: rs_booking_seats has a UNIQUE key on
// (showtime, seat, active_key), so a second INSERT for a sold seat fails and the whole booking rolls back.
async function confirmBooking(userId, holdIdInput) {
  const holdId = String(holdIdInput ?? "");
  // Retried/double-clicked request for a hold that already became a booking: return that booking.
  const already = await findByHold(userId, holdId);
  if (already) return { ...(await getBooking(userId, already)), alreadyConfirmed: true };

  const rec = await holdService.requireActiveHold(userId, holdId);
  const show = await catalog.loadShow(rec.showId);
  if (!catalog.isBookable(show)) throw new HttpError(409, "SHOW_CLOSED", "This show is no longer open for booking.");

  const dbSeats = (await catalog.loadScreenSeats(show.screen_id)).filter((s) => rec.seatIds.includes(s.id));
  if (dbSeats.length !== rec.seatIds.length) throw new HttpError(409, "INVALID_SEATS", "Seat selection is no longer valid.");
  const priced = dbSeats.map((s) => catalog.seatBase(show, s));
  const t = totals(priced.map((s) => s.pricePaise));

  const conn = await db.getConnection();
  let bookingId;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO rs_bookings (user_id, showtime_id, hold_id, status, total_paise, fee_paise) VALUES (?, ?, ?, 'CONFIRMED', ?, ?)",
      [userId, show.id, holdId, t.totalPaise, t.feePaise]);
    bookingId = r.insertId;
    await conn.query(
      "INSERT INTO rs_booking_seats (booking_id, showtime_id, seat_id, price_paise, active_key) VALUES ?",
      [priced.map((s) => [bookingId, show.id, s.seatId, s.pricePaise, 1])]);
    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch { /* connection already gone */ }
    if (e.code === "ER_DUP_ENTRY") {
      const raced = await findByHold(userId, holdId);          // same hold confirmed concurrently
      if (raced) return { ...(await getBooking(userId, raced)), alreadyConfirmed: true };
      throw new HttpError(409, "SEATS_UNAVAILABLE", "Some of those seats were just booked by someone else. Please choose different seats.");
    }
    if (e.code === "ER_NO_REFERENCED_ROW_2") throw new HttpError(401, "UNAUTHENTICATED", "Your account no longer exists. Please log in again.");
    throw e;
  } finally {
    conn.release();
  }

  // Booked seats now live in MySQL; drop the temporary Redis claims (best effort, they expire anyway).
  try {
    await store.releaseKeys(rec.seatIds.map((id) => store.seatKey(rec.showId, id)), userId, rec.holdId);
    await store.deleteHoldRecord(rec);
  } catch (e) { console.error("[hold cleanup]", e.message); }

  return getBooking(userId, bookingId);
}

// Cancels your own CONFIRMED booking before the show starts and frees the seats. No refund logic (no payments).
async function cancelBooking(userId, bookingIdInput) {
  const bookingId = positiveInt(bookingIdInput, "Booking id");
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT b.id, b.status, s.starts_at FROM rs_bookings b JOIN rs_showtimes s ON s.id = b.showtime_id
        WHERE b.id = ? AND b.user_id = ? FOR UPDATE`, [bookingId, userId]);
    const b = rows[0];
    if (!b) throw new HttpError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    if (b.status === "CANCELLED") { await conn.rollback(); return getBooking(userId, bookingId); }   // idempotent
    if (new Date(b.starts_at) <= new Date())
      throw new HttpError(409, "SHOW_STARTED", "This show has already started, so the booking can no longer be cancelled.");
    await conn.query("UPDATE rs_bookings SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP() WHERE id = ?", [bookingId]);
    await conn.query("UPDATE rs_booking_seats SET active_key = NULL WHERE booking_id = ?", [bookingId]);
    await conn.commit();
  } catch (e) {
    try { await conn.rollback(); } catch { /* ignore */ }
    throw e;
  } finally {
    conn.release();
  }
  return getBooking(userId, bookingId);
}

module.exports = { confirmBooking, cancelBooking, getBooking, myBookings };
