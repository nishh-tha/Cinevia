const db = require("../db/database");
const { HttpError } = require("../utils/errors");
const { fail } = require("../utils/validation");
const catalog = require("./catalogService");
const store = require("../cache/holdStore");

const LABEL_RE = /^([A-Za-z]{1,3})(\d{1,3})$/;

// Live seat map for one show: MySQL says what is booked, Redis says what is temporarily held.
// status: 'available' | 'held' (by someone else) | 'booked'.  heldByYou marks your own hold (still selectable).
async function listSeats(showId, userId) {
  const show = await catalog.loadShow(showId);
  if (!catalog.isBookable(show)) throw new HttpError(409, "SHOW_CLOSED", "This show is no longer open for booking.");

  const seats = await catalog.loadScreenSeats(show.screen_id);
  const [booked] = await db.query(
    "SELECT seat_id FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1", [show.id]);
  const bookedSet = new Set(booked.map((r) => r.seat_id));
  const heldBy = await store.ownersOrEmpty(seats.map((s) => store.seatKey(show.id, s.id)));

  return seats.map((s, i) => {
    const base = catalog.seatBase(show, s);
    let status = "available", heldByYou = false;
    if (bookedSet.has(s.id)) status = "booked";
    else if (heldBy[i]) {
      if (userId && heldBy[i].startsWith(`${userId}|`)) heldByYou = true;
      else status = "held";
    }
    return { id: base.id, seatId: base.seatId, row: base.row, number: base.number, category: base.category, price: base.price, status, heldByYou };
  });
}

// Accepts seat labels ("A1") or numeric seat ids; returns the matching DB seat rows for THIS show's screen.
async function resolveSeats(show, inputs) {
  const screenSeats = await catalog.loadScreenSeats(show.screen_id);
  const byLabel = new Map(screenSeats.map((s) => [catalog.label(s.row_label, s.seat_number).toUpperCase(), s]));
  const byId = new Map(screenSeats.map((s) => [s.id, s]));

  const picked = new Map();
  const invalid = [];
  for (const raw of inputs) {
    const str = String(raw).trim();
    const seat = /^\d+$/.test(str) ? byId.get(Number(str)) : LABEL_RE.test(str) ? byLabel.get(str.toUpperCase()) : undefined;
    if (!seat) invalid.push(str); else picked.set(seat.id, seat);
  }
  if (invalid.length) throw new HttpError(400, "INVALID_SEATS", "Some seats do not exist for this show.", { seats: invalid });
  if (!picked.size) throw fail("Select at least one seat.");
  return [...picked.values()];
}

module.exports = { listSeats, resolveSeats };
