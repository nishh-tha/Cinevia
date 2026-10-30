const { randomUUID } = require("crypto");
const db = require("../db/database");
const config = require("../config");
const { HttpError } = require("../utils/errors");
const { positiveInt, fail } = require("../utils/validation");
const catalog = require("./catalogService");
const seatService = require("./seatService");
const store = require("../cache/holdStore");
const { totals, totalsView } = require("../utils/pricing");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const expired = () => new HttpError(410, "HOLD_EXPIRED", "Your seat hold has expired. Please select your seats again.");
const holdIdOf = (v) => {
  const s = String(v ?? "");
  if (!UUID_RE.test(s)) throw fail("holdId is invalid.");
  return s;
};

const holdView = (rec, show, seats) => {
  const t = totals(seats.map((s) => s.pricePaise));
  return {
    holdId: rec.holdId,
    showId: rec.showId,
    seatIds: seats.map((s) => s.id),
    seats: seats.map(({ id, row, number, category, price }) => ({ id, row, number, category, price })),
    expiresAt: new Date(rec.expiresAt).toISOString(),
    secondsLeft: Math.max(0, Math.round((rec.expiresAt - Date.now()) / 1000)),
    holdSeconds: config.booking.holdSeconds,
    show: { date: show.date, time: show.time },
    ...totalsView(t),
  };
};

// Holds the chosen seats for SEAT_HOLD_SECONDS. A user has one active hold per show:
// holding again replaces the previous selection and frees the seats that were dropped.
async function createHold(userId, body = {}) {
  const showId = positiveInt(body.showId ?? body.showtimeId, "showId");
  const inputs = body.seatIds;
  if (!Array.isArray(inputs) || inputs.length === 0) throw fail("Select at least one seat.");
  if (inputs.length > config.booking.maxSeatsPerBooking)
    throw new HttpError(400, "TOO_MANY_SEATS", `You can select up to ${config.booking.maxSeatsPerBooking} seats.`);
  if (inputs.some((x) => typeof x !== "string" && typeof x !== "number")) throw fail("seatIds must be seat labels like \"A1\".");

  const row = await catalog.loadShow(showId);
  if (!catalog.isBookable(row)) throw new HttpError(409, "SHOW_CLOSED", "This show is no longer open for booking.");
  const dbSeats = await seatService.resolveSeats(row, inputs);
  const seats = dbSeats.map((s) => catalog.seatBase(row, s));
  const labelOf = new Map(seats.map((s) => [s.seatId, s.id]));

  // Already sold (MySQL is the source of truth for confirmed bookings).
  const [booked] = await db.query(
    "SELECT seat_id FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1 AND seat_id IN (?)",
    [showId, seats.map((s) => s.seatId)]);
  if (booked.length)
    throw new HttpError(409, "SEATS_UNAVAILABLE", "Some of those seats were just booked. Please choose different seats.",
      { seats: booked.map((r) => labelOf.get(r.seat_id)) });

  const prevId = await store.activeHoldIdFor(showId, userId);
  const prev = prevId ? await store.readHold(prevId) : null;

  const holdId = randomUUID();
  const ttlMs = config.booking.holdSeconds * 1000;
  const keys = seats.map((s) => store.seatKey(showId, s.seatId));
  const conflict = await store.tryHold(keys, userId, holdId, ttlMs);
  if (conflict) {
    throw new HttpError(409, "SEATS_UNAVAILABLE", "Some of those seats are being held by another customer. Please choose different seats.",
      { seats: [seats[conflict - 1].id] });
  }

  const rec = { holdId, userId, showId, seatIds: seats.map((s) => s.seatId), expiresAt: Date.now() + ttlMs };
  await store.saveHold(rec, ttlMs);

  if (prev && prev.userId === userId) {   // free seats from the previous selection that were dropped
    await store.releaseKeys(prev.seatIds.map((id) => store.seatKey(showId, id)), userId, prev.holdId);
    await store.deleteHoldRecord(prev);
  }
  return holdView(rec, catalog.showView(row), seats);
}

// Returns the hold only if it is yours, has not expired, and every seat is still claimed by it.
async function requireActiveHold(userId, holdIdInput) {
  const holdId = holdIdOf(holdIdInput);
  const rec = await store.readHold(holdId);
  if (!rec) throw expired();
  if (rec.userId !== userId) throw new HttpError(404, "HOLD_NOT_FOUND", "Hold not found.");
  if (rec.expiresAt <= Date.now()) throw expired();
  const vals = await store.owners(rec.seatIds.map((id) => store.seatKey(rec.showId, id)));
  const mine = store.owner(userId, rec.holdId);
  if (vals.some((v) => v !== mine)) throw expired();
  return rec;
}

async function getHold(userId, holdId) {
  const rec = await requireActiveHold(userId, holdId);
  const show = await catalog.loadShow(rec.showId);
  const dbSeats = await catalog.loadScreenSeats(show.screen_id);
  const seats = dbSeats.filter((s) => rec.seatIds.includes(s.id)).map((s) => catalog.seatBase(show, s));
  return holdView(rec, catalog.showView(show), seats);
}

// Idempotent: releasing an expired/unknown hold succeeds.
async function releaseHold(userId, holdIdInput) {
  const holdId = holdIdOf(holdIdInput);
  const rec = await store.readHold(holdId);
  if (!rec) return { released: 0 };
  if (rec.userId !== userId) throw new HttpError(404, "HOLD_NOT_FOUND", "Hold not found.");
  const n = await store.releaseKeys(rec.seatIds.map((id) => store.seatKey(rec.showId, id)), userId, rec.holdId);
  await store.deleteHoldRecord(rec);
  return { released: n };
}

module.exports = { createHold, getHold, releaseHold, requireActiveHold };
