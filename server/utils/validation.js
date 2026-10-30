const { HttpError } = require("./errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (message, details) => new HttpError(400, "VALIDATION_ERROR", message, details);

function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw fail(`${name} must be a positive integer.`);
  return n;
}

function validateRegister(body = {}) {
  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const errors = {};
  if (username.length < 3 || username.length > 50) errors.username = "Username must be 3-50 characters.";
  if (!EMAIL_RE.test(email) || email.length > 255) errors.email = "Enter a valid email address.";
  if (password.length < 8 || password.length > 72) errors.password = "Password must be 8-72 characters.";
  if (Object.keys(errors).length) throw fail(Object.values(errors)[0], errors);
  return { username, email, password };
}

function validateLogin(body = {}) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email) || !password) throw fail("Email and password are required.");
  return { email, password };
}

module.exports = { positiveInt, validateRegister, validateLogin, fail };
