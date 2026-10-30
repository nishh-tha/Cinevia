const jwt = require("jsonwebtoken");
const config = require("../config");
const { HttpError } = require("../utils/errors");

function userIdFromRequest(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return { id: null, reason: "missing" };
  try {
    const payload = jwt.verify(m[1], config.jwt.secret);
    const id = Number(payload.id);
    return Number.isInteger(id) && id > 0 ? { id } : { id: null, reason: "invalid" };
  } catch {
    return { id: null, reason: "invalid" };
  }
}

// Protects user-specific routes. Sets req.user = { id }.
const authenticateToken = (req, _res, next) => {
  const { id, reason } = userIdFromRequest(req);
  if (!id) {
    return next(new HttpError(401, "UNAUTHENTICATED",
      reason === "missing" ? "Please log in to continue." : "Your session is invalid or has expired. Please log in again."));
  }
  req.user = { id };
  next();
};

// For public routes that behave slightly differently for logged-in users (e.g. "your held seats").
const optionalAuth = (req, _res, next) => {
  req.user = null;
  const { id } = userIdFromRequest(req);
  if (id) req.user = { id };
  next();
};

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.optionalAuth = optionalAuth;
