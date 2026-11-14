const express = require("express");
const dbLock = require("../services/dbLockService");
const { authenticateToken } = require("../middleware/authMiddleware");

const router = express.Router();

// ---- DB-only locking (MySQL transaction + SELECT ... FOR UPDATE). No Redis involved. ----
router.post("/bookings", authenticateToken, async (req, res) => {
  const { booking, lockWaitMs, retries } = await dbLock.createDirectBooking(req.user.id, req.body);
  res.set({ "X-Lock-Wait-Ms": String(lockWaitMs), "X-Retries": String(retries) });
  res.status(201).json({ bookingId: booking.id, ...booking });
});

module.exports = router;