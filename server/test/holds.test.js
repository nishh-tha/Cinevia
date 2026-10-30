const test = require("node:test");
const assert = require("node:assert/strict");
const { loadServices } = require("./helpers");

const A = 1, B = 2;
const rejects = (p, code, status) => assert.rejects(p, (e) => { assert.equal(e.code, code); if (status) assert.equal(e.status, status); return true; });

test("holding seats returns server-computed totals (premium Rs350 x2 + Rs30 fee each)", async () => {
  const { holds } = loadServices();
  const h = await holds.createHold(A, { showId: 1, seatIds: ["A1", "A2"] });
  assert.deepEqual(h.seatIds, ["A1", "A2"]);
  assert.equal(h.ticketsTotal, 700);
  assert.equal(h.convenienceFee, 60);
  assert.equal(h.total, 760);
  assert.ok(new Date(h.expiresAt) > new Date());
});

test("a second user cannot hold seats that are already held", async () => {
  const { holds } = loadServices();
  await holds.createHold(A, { showId: 1, seatIds: ["A1", "A2"] });
  await assert.rejects(holds.createHold(B, { showId: 1, seatIds: ["A2", "A3"] }), (e) => {
    assert.equal(e.status, 409); assert.equal(e.code, "SEATS_UNAVAILABLE"); assert.deepEqual(e.details.seats, ["A2"]); return true;
  });
  // all-or-nothing: A3 must not have been claimed by the failed attempt
  const ok = await holds.createHold(B, { showId: 1, seatIds: ["A3"] });
  assert.deepEqual(ok.seatIds, ["A3"]);
});

test("re-holding replaces the previous selection and frees dropped seats", async () => {
  const { holds, redis } = loadServices();
  const first = await holds.createHold(A, { showId: 1, seatIds: ["A1", "A2"] });
  const second = await holds.createHold(A, { showId: 1, seatIds: ["A2", "A3"] });
  assert.notEqual(first.holdId, second.holdId);
  const free = await holds.createHold(B, { showId: 1, seatIds: ["A1"] });      // A1 was dropped
  assert.deepEqual(free.seatIds, ["A1"]);
  await rejects(holds.getHold(A, first.holdId), "HOLD_EXPIRED", 410);          // old hold record is gone
  assert.equal((await holds.getHold(A, second.holdId)).seatIds.length, 2);
  assert.ok(redis.store.size > 0);
});

test("expired holds are rejected and their seats become available again", async () => {
  const realNow = Date.now;
  try {
    const { holds } = loadServices();
    const h = await holds.createHold(A, { showId: 1, seatIds: ["B1"] });
    assert.ok((await holds.getHold(A, h.holdId)).secondsLeft > 0);
    const t = realNow() + 301 * 1000;                                           // default hold is 300s
    Date.now = () => t;
    await rejects(holds.requireActiveHold(A, h.holdId), "HOLD_EXPIRED", 410);
    const taken = await holds.createHold(B, { showId: 1, seatIds: ["B1"] });
    assert.deepEqual(taken.seatIds, ["B1"]);
  } finally { Date.now = realNow; }
});

test("holds are private: another user cannot read or release them", async () => {
  const { holds } = loadServices();
  const h = await holds.createHold(A, { showId: 1, seatIds: ["C1"] });
  await rejects(holds.getHold(B, h.holdId), "HOLD_NOT_FOUND", 404);
  await rejects(holds.releaseHold(B, h.holdId), "HOLD_NOT_FOUND", 404);
  assert.equal((await holds.releaseHold(A, h.holdId)).released, 1);
  assert.deepEqual(await holds.releaseHold(A, h.holdId), { released: 0 });       // idempotent
});

test("seats already booked in MySQL cannot be held", async () => {
  const { holds } = loadServices({ booked: [1] });                              // seat id 1 = A1
  await assert.rejects(holds.createHold(A, { showId: 1, seatIds: ["A1", "A2"] }), (e) => {
    assert.equal(e.code, "SEATS_UNAVAILABLE"); assert.deepEqual(e.details.seats, ["A1"]); return true;
  });
});

test("validation: unknown seats, unknown show, too many seats, duplicates", async () => {
  const { holds } = loadServices();
  await rejects(holds.createHold(A, { showId: 1, seatIds: ["Z9"] }), "INVALID_SEATS", 400);
  await rejects(holds.createHold(A, { showId: 99, seatIds: ["A1"] }), "SHOW_NOT_FOUND", 404);
  await rejects(holds.createHold(A, { showId: 1, seatIds: [] }), "VALIDATION_ERROR", 400);
  await rejects(holds.createHold(A, { showId: 1, seatIds: ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1"] }), "TOO_MANY_SEATS", 400);
  const dup = await holds.createHold(A, { showId: 1, seatIds: ["a1", "A1", 1] });   // label case + numeric id all mean seat A1
  assert.deepEqual(dup.seatIds, ["A1"]);
});

test("seat map shows booked / held / your own hold / available", async () => {
  const { holds, seatsvc } = loadServices({ booked: [3] });                     // A3 booked
  await holds.createHold(A, { showId: 1, seatIds: ["A1"] });
  const mine = await seatsvc.listSeats(1, A);
  const theirs = await seatsvc.listSeats(1, B);
  const get = (list, id) => list.find((s) => s.id === id);
  assert.equal(get(mine, "A3").status, "booked");
  assert.equal(get(mine, "A1").status, "available");
  assert.equal(get(mine, "A1").heldByYou, true);
  assert.equal(get(theirs, "A1").status, "held");
  assert.equal(get(theirs, "A2").status, "available");
  assert.equal(get(theirs, "A1").price, 350);
  assert.equal(get(theirs, "C1").price, 250);
});
