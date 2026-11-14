// Real-MySQL tests for the DB-only mechanism (POST /api/db/bookings -> dbLockService.createDirectBooking).
// Run from server/ with the local test database variables set:   npm run test:db
const test = require("node:test");
const assert = require("node:assert/strict");
const fx = require("./fixtures");
const dbLock = require("../../services/dbLockService");
const bookings = require("../../services/bookingService");

// The DB-only path must never use Redis: make every Redis call blow up.
const redis = require("../../cache/redisClient");
for (const m of ["get", "set", "del", "mGet", "eval"]) redis[m] = () => { throw new Error("Redis was used by the DB-only path!"); };

const created = { showIds: [], userIds: [] };
const newShow = async () => { const s = await fx.createShow(); created.showIds.push(s.showId); return s; };
const newUsers = async (n) => { const u = await fx.createUsers(n); created.userIds.push(...u); return u; };
const book = (userId, showId, seatIds) => dbLock.createDirectBooking(userId, { showId, seatIds });
const settle = (ps) => Promise.allSettled(ps);
const ok = (rs) => rs.filter((r) => r.status === "fulfilled");
const bad = (rs) => rs.filter((r) => r.status === "rejected").map((r) => r.reason);

test.after(async () => { await fx.cleanup(created); await fx.db.end(); });

for (const N of [10, 50]) {
  test(`same seat, ${N} simultaneous requests: exactly one wins`, async () => {
    const { showId } = await newShow();
    const users = await newUsers(N);
    const rs = await settle(users.map((u) => book(u, showId, ["A1"])));
    assert.equal(ok(rs).length, 1, "exactly one booking must succeed");
    for (const e of bad(rs)) {
      assert.equal(e.status, 409); assert.equal(e.code, "SEATS_UNAVAILABLE");
      assert.equal(e.details.via, "lock-check", "losers must be stopped by the lock + check, not by the unique-key safety net");
    }
    assert.deepEqual(await fx.soldLabels(showId), ["A1"]);
    assert.equal(await fx.count("SELECT COUNT(*) FROM rs_bookings WHERE showtime_id = ?", [showId]), 1);
    assert.deepEqual(await fx.duplicateActiveSeats(showId), []);
  });
}

test("multiple seats: all-or-nothing, correct totals, max seats enforced", async () => {
  const { showId } = await newShow();
  const [u1, u2] = await newUsers(2);
  const r = await book(u1, showId, ["A1", "A2", "A3"]);
  assert.equal(r.booking.status, "CONFIRMED");
  assert.equal(r.booking.seats.length, 3);
  assert.equal(r.booking.convenienceFee, (3 * fx.config.booking.convenienceFeePaise) / 100);
  assert.deepEqual(await fx.soldLabels(showId), ["A1", "A2", "A3"]);

  // A3 is taken, so A4 must NOT be booked as a side effect.
  await assert.rejects(book(u2, showId, ["A3", "A4"]), (e) => e.status === 409 && e.code === "SEATS_UNAVAILABLE");
  assert.deepEqual(await fx.soldLabels(showId), ["A1", "A2", "A3"]);

  const nine = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"];
  await assert.rejects(book(u2, showId, nine), (e) => e.code === "TOO_MANY_SEATS" && e.status === 400);
});

test("overlapping seat sets (incl. reversed order): no seat sold twice, no 500s, no deadlock failures", async () => {
  const { showId } = await newShow();
  const sets = [["A1", "A2", "A3"], ["A3", "A2", "A1"], ["A3", "A4"], ["A5", "A6"], ["A2", "A5"], ["A6", "A7", "A1"]];
  const reqs = [];
  for (let i = 0; i < 24; i++) reqs.push(sets[i % sets.length]);
  const users = await newUsers(reqs.length);
  const rs = await settle(reqs.map((s, i) => book(users[i], showId, s)));

  for (const e of bad(rs)) { assert.equal(e.status, 409, `unexpected failure: ${e.status} ${e.code} ${e.message}`); assert.equal(e.code, "SEATS_UNAVAILABLE"); assert.equal(e.details.via, "lock-check"); }
  assert.deepEqual(await fx.duplicateActiveSeats(showId), []);

  // every successful booking owns exactly the seats it asked for, and nothing else is sold
  let expectedSeats = 0;
  rs.forEach((r, i) => { if (r.status === "fulfilled") expectedSeats += new Set(reqs[i]).size; });
  assert.ok(ok(rs).length >= 1);
  assert.equal((await fx.soldLabels(showId)).length, expectedSeats);
  for (const r of ok(rs)) {
    const n = await fx.count("SELECT COUNT(*) FROM rs_booking_seats WHERE booking_id = ?", [r.value.booking.id]);
    assert.equal(n, r.value.booking.seats.length);
  }
});

test("rollback: unknown user rolls everything back and releases the locks", async () => {
  const { showId } = await newShow();
  const [u] = await newUsers(1);
  await assert.rejects(book(999999999, showId, ["B1", "B2"]), (e) => e.status === 401);
  assert.equal(await fx.count("SELECT COUNT(*) FROM rs_bookings WHERE showtime_id = ?", [showId]), 0);
  assert.deepEqual(await fx.soldLabels(showId), []);
  const t0 = Date.now();
  await book(u, showId, ["B1", "B2"]);                 // same seats work immediately: nothing is left locked
  assert.ok(Date.now() - t0 < 3000, "lock was not released after rollback");
});

test("rollback: unique-key safety net fires after the booking row was inserted, and everything is undone", async () => {
  const { showId } = await newShow();
  const [u, other] = await newUsers(2);
  const [[seat]] = await fx.db.query(
    "SELECT ss.id FROM rs_showtimes s JOIN rs_screen_seats ss ON ss.screen_id = s.screen_id WHERE s.id = ? AND ss.row_label = 'C' AND ss.seat_number = 1", [showId]);

  // A rival writer that does NOT take our seat lock (FK checks off), and has not committed yet.
  const rival = await fx.db.getConnection();
  await rival.query("SET SESSION foreign_key_checks = 0");
  await rival.beginTransaction();
  const [rb] = await rival.query(
    "INSERT INTO rs_bookings (user_id, showtime_id, hold_id, status, total_paise, fee_paise) VALUES (?, ?, UUID(), 'CONFIRMED', 1, 0)", [other, showId]);
  await rival.query("INSERT INTO rs_booking_seats (booking_id, showtime_id, seat_id, price_paise, active_key) VALUES (?, ?, ?, 1, 1)", [rb.insertId, showId, seat.id]);

  const mine = book(u, showId, ["C1"]).then((v) => ({ v }), (e) => ({ e }));
  await new Promise((r) => setTimeout(r, 400));        // let our request reach its INSERT and wait on the rival's uncommitted row
  await rival.commit();
  await rival.query("SET SESSION foreign_key_checks = 1");
  rival.release();

  const res = await mine;
  assert.ok(res.e, "our booking must fail");
  assert.equal(res.e.status, 409);
  assert.equal(res.e.details.via, "unique-key");
  assert.equal(await fx.count("SELECT COUNT(*) FROM rs_bookings WHERE showtime_id = ? AND user_id = ?", [showId, u]), 0, "our booking row must be rolled back");
  assert.equal(await fx.count("SELECT COUNT(*) FROM rs_bookings WHERE showtime_id = ?", [showId]), 1, "only the rival's booking remains");
  assert.deepEqual(await fx.duplicateActiveSeats(showId), []);
});

test("duplicate prevention: same seat twice is refused; after cancel it can be booked again", async () => {
  const { showId } = await newShow();
  const [u1, u2, u3] = await newUsers(3);
  const first = await book(u1, showId, ["D1"]);
  await assert.rejects(book(u1, showId, ["D1"]), (e) => e.code === "SEATS_UNAVAILABLE");   // same user, same seat
  await assert.rejects(book(u2, showId, ["D1"]), (e) => e.code === "SEATS_UNAVAILABLE");   // different user

  const cancelled = await bookings.cancelBooking(u1, first.booking.id);                    // existing, untouched code path
  assert.equal(cancelled.status, "CANCELLED");
  const again = await book(u3, showId, ["D1"]);
  assert.equal(again.booking.status, "CONFIRMED");
  assert.deepEqual(await fx.soldLabels(showId), ["D1"]);
  assert.deepEqual(await fx.duplicateActiveSeats(showId), []);
});