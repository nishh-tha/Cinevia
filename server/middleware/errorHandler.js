const { HttpError } = require("../utils/errors");

const notFound = (req, _res, next) =>
  next(new HttpError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.path}`));

// Response shape: { message, code, details? }   (the frontend reads `message`)
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body is not valid JSON.", code: "BAD_JSON" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large.", code: "PAYLOAD_TOO_LARGE" });
  }
  // Database unreachable / pool exhausted
  if (err && ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "PROTOCOL_CONNECTION_LOST", "ER_CON_COUNT_ERROR"].includes(err.code)) {
    console.error("[db]", err.code, err.message);
    return res.status(503).json({ message: "The database is temporarily unavailable. Please try again.", code: "DB_UNAVAILABLE" });
  }
  console.error("[error]", err && err.stack ? err.stack : err); // never echo internals to the client
  res.status(500).json({ message: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" });
};

module.exports = { notFound, errorHandler };
