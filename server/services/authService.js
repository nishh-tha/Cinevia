const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const config = require("../config");
const { HttpError } = require("../utils/errors");
const { validateRegister, validateLogin } = require("../utils/validation");

const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email });

async function register(body) {
  const { username, email, password } = validateRegister(body);
  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length) throw new HttpError(409, "EMAIL_TAKEN", "Email already registered.");
  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await db.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hash]);
    return { message: "User registered successfully", user: { id: r.insertId, username, email } };
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") throw new HttpError(409, "EMAIL_TAKEN", "Email already registered.");
    throw e;
  }
}

// Same message for unknown email and wrong password, so accounts can't be probed.
async function login(body) {
  const { email, password } = validateLogin(body);
  const [rows] = await db.query("SELECT id, username, email, password FROM users WHERE email = ?", [email]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  const token = jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  return { message: "Login successful", token, user: publicUser(user) };
}

async function me(userId) {
  const [rows] = await db.query("SELECT id, username, email FROM users WHERE id = ?", [userId]);
  if (!rows[0]) throw new HttpError(401, "UNAUTHENTICATED", "Account no longer exists.");
  return { user: publicUser(rows[0]) };
}

module.exports = { register, login, me };
