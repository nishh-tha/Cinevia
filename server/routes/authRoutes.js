const express = require("express");
const auth = require("../services/authService");
const { authenticateToken } = require("../middleware/authMiddleware");
const { HttpError } = require("../utils/errors");

const router = express.Router();

router.post("/register", async (req, res) => res.status(201).json(await auth.register(req.body)));
router.post("/login", async (req, res) => res.json(await auth.login(req.body)));
router.get("/me", authenticateToken, async (req, res) => res.json(await auth.me(req.user.id)));

// The UI has these screens, but password reset needs email delivery, which is out of scope for this demo.
const notSupported = () => { throw new HttpError(501, "NOT_SUPPORTED", "Password reset by email is not available in this demo."); };
router.post("/forgot-password", notSupported);
router.post("/reset-password", notSupported);

module.exports = router;
