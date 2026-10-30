const test = require("node:test");
const assert = require("node:assert/strict");
require("./helpers");
const { zonedToUtc, dayRangeUtc, isValidDateString, formatTime, todayString } = require("../utils/time");
const { validateRegister, validateLogin } = require("../utils/validation");
const { seatPaise, totals } = require("../utils/pricing");
const jwt = require("jsonwebtoken");
const { authenticateToken, optionalAuth } = require("../middleware/authMiddleware");

test("IST wall-clock times convert to UTC and back", () => {
  const d = zonedToUtc(2026, 11, 2, 18, 30, "Asia/Kolkata");
  assert.equal(d.toISOString(), "2026-11-02T13:00:00.000Z");
  assert.equal(formatTime(d, "Asia/Kolkata"), "18:30");
  const [from, to] = dayRangeUtc("2026-11-02", "Asia/Kolkata");
  assert.equal(from.toISOString(), "2026-11-01T18:30:00.000Z");
  assert.equal(to.toISOString(), "2026-11-02T18:30:00.000Z");
  assert.equal(todayString("Asia/Kolkata", new Date("2026-11-01T19:00:00Z")), "2026-11-02"); // already tomorrow in IST
});

test("date validation", () => {
  assert.ok(isValidDateString("2026-02-28"));
  assert.ok(!isValidDateString("2026-02-30"));
  assert.ok(!isValidDateString("02-11-2026"));
});

test("register/login validation", () => {
  assert.throws(() => validateRegister({ username: "ab", email: "x", password: "short" }), (e) => e.status === 400);
  const ok = validateRegister({ username: " Asha ", email: " Asha@Example.COM ", password: "longenough1" });
  assert.deepEqual(ok, { username: "Asha", email: "asha@example.com", password: "longenough1" });
  assert.throws(() => validateLogin({ email: "a@b.co" }), (e) => e.status === 400);
});

test("pricing is integer paise and includes the per-ticket fee", () => {
  assert.equal(seatPaise(25000, "1.40"), 35000);
  assert.deepEqual(totals([35000, 25000]), { ticketsPaise: 60000, feePaise: 6000, totalPaise: 66000 });
});

test("auth middleware accepts valid tokens only", () => {
  const run = (mw, header) => { const req = { headers: header ? { authorization: header } : {} }; let err; mw(req, {}, (e) => { err = e; }); return { req, err }; };
  const good = jwt.sign({ id: 5 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.equal(run(authenticateToken, `Bearer ${good}`).req.user.id, 5);
  assert.equal(run(authenticateToken).err.status, 401);
  assert.equal(run(authenticateToken, "Bearer nonsense").err.status, 401);
  const wrongSecret = jwt.sign({ id: 5 }, "x".repeat(40));
  assert.equal(run(authenticateToken, `Bearer ${wrongSecret}`).err.status, 401);
  assert.equal(run(optionalAuth, "Bearer nonsense").req.user, null);
});
