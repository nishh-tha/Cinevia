const config = require("./config");
config.assertReady();

const createApp = require("./app");
const db = require("./db/database");
const redis = require("./cache/redisClient");
const runSeed = require("./scripts/seed");

const app = createApp();

(async () => {
  redis.start();   // retries in the background; seat holds return 503 until Redis is reachable
  try {
    await db.query("SELECT 1");
    console.log("[db] connected");
  } catch (e) {
    console.error("[db] connection check failed:", e.message);
  }

  const server = app.listen(config.port, () => console.log(`Cinevia API listening on port ${config.port}`));
  const topUpShows = () => runSeed().catch((e) => console.error("[seed] failed:", e.message));
  topUpShows();                                  // runs every time the server starts
  setInterval(topUpShows, 12 * 60 * 60 * 1000);  // and again every 12 hours

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      try { await db.end(); } catch { /* ignore */ }
      try { if (redis.isOpen) await redis.quit(); } catch { /* ignore */ }
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
})();

process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => { console.error("Uncaught exception:", err); process.exit(1); });
