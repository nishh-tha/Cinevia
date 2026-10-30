// Single source of configuration. Everything comes from environment variables (see .env.example).
require("dotenv").config({ quiet: true });

const int = (v, d) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
};

const config = {
  env: process.env.NODE_ENV || "development",
  port: int(process.env.PORT, 3000),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",").map((s) => s.trim()).filter(Boolean),

  db: {
    host: process.env.DB_HOST || "mysql-3b97caf0-seatbooking-database.b.aivencloud.com",
    port: int(process.env.DB_PORT, 26245),
    user: process.env.DB_USER || "avnadmin",
    password: process.env.DB_PASSWORD, // never hardcoded
    database: process.env.DB_NAME || "defaultdb",
    ssl: process.env.DB_SSL !== "false",
    sslCaPath: process.env.DB_SSL_CA_PATH || "certs/ca.pem", // relative to server/
    connectionLimit: int(process.env.DB_POOL_SIZE, 10),
  },

  redisUrl: process.env.REDIS_URL || "redis://localhost:9000",

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  },

  booking: {
    holdSeconds: int(process.env.SEAT_HOLD_SECONDS, 300),
    maxSeatsPerBooking: int(process.env.MAX_SEATS_PER_BOOKING, 8),
    convenienceFeePaise: Number.isInteger(Number(process.env.CONVENIENCE_FEE_PAISE))
      ? Number(process.env.CONVENIENCE_FEE_PAISE) : 3000, // Rs 30 per ticket, matches the UI
    timezone: process.env.APP_TIMEZONE || "Asia/Kolkata", // timezone of the cinemas
  },
};

// Fail fast on missing secrets instead of failing on the first request.
config.assertReady = () => {
  const missing = [];
  if (!config.db.password) missing.push("DB_PASSWORD");
  if (!config.jwt.secret) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`);
  }
  if (config.jwt.secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
};

module.exports = config;
