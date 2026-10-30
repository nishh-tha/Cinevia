const express = require("express");
const holds = require("../services/holdService");
const bookings = require("../services/bookingService");
const { authenticateToken } = require("../middleware/authMiddleware");
const { HttpError } = require("../utils/errors");
const { fail } = require("../utils/validation");

const router = express.Router();
const auth = authenticateToken;   // every route in this file is user-specific

// ---- Temporary seat holds (Redis) ----
router.post("/holds", auth, async (req, res) => res.status(201).json(await holds.createHold(req.user.id, req.body)));
router.get("/holds/:holdId", auth, async (req, res) => res.json(await holds.getHold(req.user.id, req.params.holdId)));
router.delete("/holds/:holdId", auth, async (req, res) => res.json(await holds.releaseHold(req.user.id, req.params.holdId)));

// ---- Booking (demo: confirms immediately, no payment) ----
router.post("/checkout", auth, async (req, res) => {
  if (!req.body?.holdId) throw fail("holdId is required.");
  const booking = await bookings.confirmBooking(req.user.id, req.body.holdId);
  res.status(booking.alreadyConfirmed ? 200 : 201).json({ bookingId: booking.id, ...booking });
});

router.get("/bookings/mine", auth, async (req, res) => res.json({ bookings: await bookings.myBookings(req.user.id) }));
router.get("/bookings/:id", auth, async (req, res) => res.json(await bookings.getBooking(req.user.id, req.params.id)));
router.post("/bookings/:id/cancel", auth, async (req, res) => res.json(await bookings.cancelBooking(req.user.id, req.params.id)));

// Compatibility with the existing frontend call GET /my-bookings/:userId.
// You can only ever read your own bookings (the id in the URL must match your token).
router.get("/my-bookings/:userId", auth, async (req, res) => {
  if (String(req.user.id) !== String(req.params.userId))
    throw new HttpError(403, "FORBIDDEN", "You can only view your own bookings.");
  res.json({ bookings: await bookings.myBookings(req.user.id) });
});

module.exports = router;
