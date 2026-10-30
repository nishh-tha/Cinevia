// The ONE Redis client for the whole app. Configure with REDIS_URL.
const { createClient } = require("redis");
const config = require("../config");

const client = createClient({
  url: config.redisUrl,
  // Fail fast when Redis is down instead of letting requests hang in an offline queue.
  disableOfflineQueue: true,
  socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 3000) },
});

client.on("error", (err) => console.error("[redis]", err.message));
client.on("ready", () => console.log("[redis] connected"));

let connecting = null;
client.start = () => {
  if (!connecting) {
    connecting = client.connect().catch((err) => {
      connecting = null;
      console.error("[redis] initial connection failed:", err.message);
    });
  }
  return connecting;
};

module.exports = client;
