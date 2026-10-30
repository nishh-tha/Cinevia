// Redis storage for temporary seat holds. Uses the shared client from cache/redisClient.js.
//   rs:hold:{showId}:{seatId}   -> "userId|holdId"   (one key per held seat, TTL = hold time)
//   rs:holdgroup:{holdId}       -> JSON record of the hold (TTL = hold time)
//   rs:userhold:{showId}:{userId} -> holdId          (a user keeps one active hold per show)
// Seat claims are made with a Lua script so "check all seats, then claim all seats" is atomic:
// two people can never both hold the same seat.
const redis = require("./redisClient");
const { HttpError } = require("../utils/errors");

const seatKey = (showId, seatId) => `rs:hold:${showId}:${seatId}`;
const groupKey = (holdId) => `rs:holdgroup:${holdId}`;
const userKey = (showId, userId) => `rs:userhold:${showId}:${userId}`;
const owner = (userId, holdId) => `${userId}|${holdId}`;

// Claim every key unless someone ELSE holds one. Returns 0, or the 1-based index of the first conflict.
const HOLD = `
for i=1,#KEYS do
  local cur = redis.call('GET', KEYS[i])
  if cur and string.sub(cur, 1, #ARGV[3]) ~= ARGV[3] then return i end
end
for i=1,#KEYS do redis.call('SET', KEYS[i], ARGV[1], 'PX', ARGV[2]) end
return 0`;

// Delete only keys that are still owned by ARGV[1]. Returns how many were deleted.
const RELEASE = `
local n = 0
for i=1,#KEYS do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]); n = n + 1 end
end
return n`;

// Redis problems must not become 500s or hangs: the seat-hold feature is simply unavailable.
async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error("[redis]", e.message);
    throw new HttpError(503, "HOLD_SERVICE_UNAVAILABLE", "Seat holding is temporarily unavailable. Please try again shortly.");
  }
}

const tryHold = (keys, userId, holdId, ttlMs) => guard(async () =>
  Number(await redis.eval(HOLD, { keys, arguments: [owner(userId, holdId), String(ttlMs), `${userId}|`] })));

const releaseKeys = (keys, userId, holdId) => guard(async () =>
  keys.length ? Number(await redis.eval(RELEASE, { keys, arguments: [owner(userId, holdId)] })) : 0);

const owners = (keys) => guard(async () => (keys.length ? redis.mGet(keys) : []));

// Used by the seat map: a Redis outage there should not take the whole page down.
const ownersOrEmpty = async (keys) => {
  try { return keys.length ? await redis.mGet(keys) : []; }
  catch (e) { console.error("[redis] seat map without holds:", e.message); return keys.map(() => null); }
};

const saveHold = (rec, ttlMs) => guard(async () => {
  await redis.set(groupKey(rec.holdId), JSON.stringify(rec), { expiration: { type: "PX", value: ttlMs } });
  await redis.set(userKey(rec.showId, rec.userId), rec.holdId, { expiration: { type: "PX", value: ttlMs } });
});

const readHold = (holdId) => guard(async () => {
  const raw = await redis.get(groupKey(holdId));
  return raw ? JSON.parse(raw) : null;
});

const activeHoldIdFor = (showId, userId) => guard(() => redis.get(userKey(showId, userId)));

const deleteHoldRecord = (rec) => guard(async () => {
  await redis.del(groupKey(rec.holdId));
  const cur = await redis.get(userKey(rec.showId, rec.userId));
  if (cur === rec.holdId) await redis.del(userKey(rec.showId, rec.userId));
});

module.exports = { seatKey, owner, tryHold, releaseKeys, owners, ownersOrEmpty, saveHold, readHold, activeHoldIdFor, deleteHoldRecord };
