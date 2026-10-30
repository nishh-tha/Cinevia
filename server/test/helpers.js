// Test doubles for MySQL and Redis so the services' own logic can be tested without any server.
const path = require("path");

process.env.DB_PASSWORD = "test";
process.env.JWT_SECRET = "t".repeat(40);

function fakeRedis() {
  const store = new Map(); // key -> { v, exp }
  const live = (k) => {
    const e = store.get(k);
    if (!e) return null;
    if (e.exp !== null && e.exp <= Date.now()) { store.delete(k); return null; }
    return e;
  };
  const ttl = (opts) => (opts && opts.expiration ? Date.now() + opts.expiration.value : null);
  return {
    isOpen: true,
    store,
    async get(k) { const e = live(k); return e ? e.v : null; },
    async set(k, v, opts) { store.set(k, { v: String(v), exp: ttl(opts) }); return "OK"; },
    async del(k) { return store.delete(k) ? 1 : 0; },
    async mGet(keys) { return keys.map((k) => { const e = live(k); return e ? e.v : null; }); },
    // Mirrors the Lua scripts in cache/holdStore.js
    async eval(script, { keys, arguments: argv }) {
      if (script.includes("'SET'")) {                         // HOLD
        for (let i = 0; i < keys.length; i++) {
          const e = live(keys[i]);
          if (e && e.v.slice(0, argv[2].length) !== argv[2]) return i + 1;
        }
        keys.forEach((k) => store.set(k, { v: argv[0], exp: Date.now() + Number(argv[1]) }));
        return 0;
      }
      let n = 0;                                              // RELEASE
      for (const k of keys) { const e = live(k); if (e && e.v === argv[0]) { store.delete(k); n++; } }
      return n;
    },
  };
}

// One screen: rows A-B premium (35000 paise), C standard (25000), 4 seats each. Show 2 days ahead.
function fakeDb({ booked = [] } = {}) {
  const seats = [];
  let id = 1;
  for (const [row, mult] of [["A", "1.40"], ["B", "1.40"], ["C", "1.00"]])
    for (let n = 1; n <= 4; n++) seats.push({ id: id++, row_label: row, seat_number: n, category: mult === "1.40" ? "PREMIUM" : "STANDARD", price_multiplier: mult });
  const show = {
    id: 1, screen_id: 1, starts_at: new Date(Date.now() + 2 * 86400000), base_price_paise: 25000, status: "ACTIVE",
    screen_name: "Screen 1", movie_id: 1, title: "Midnight Harbour", color: "#7a1e1e",
    cinema_id: 1, cinema_name: "PVR Kadapa Central", address: "x", city_name: "Kadapa",
  };
  const bookedSeats = [...booked];
  return {
    seats, show, bookedSeats,
    async query(sql, params) {
      if (sql.includes("FROM rs_showtimes s") && sql.includes("WHERE s.id = ?")) return [params[0] === 1 ? [show] : []];
      if (sql.includes("FROM rs_screen_seats WHERE screen_id")) return [seats];
      if (sql.includes("active_key = 1 AND seat_id IN")) return [bookedSeats.filter((s) => params[1].includes(s)).map((seat_id) => ({ seat_id }))];
      if (sql.includes("FROM rs_booking_seats WHERE showtime_id = ? AND active_key = 1")) return [bookedSeats.map((seat_id) => ({ seat_id }))];
      throw new Error("Unexpected SQL in test: " + sql.slice(0, 80));
    },
  };
}

function inject(relPath, exports) {
  const file = require.resolve(path.join(__dirname, "..", relPath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] };
}

// Loads services with the fakes wired in. Call once per test file / scenario.
function loadServices({ booked } = {}) {
  const redis = fakeRedis(), db = fakeDb({ booked });
  inject("cache/redisClient.js", redis);
  inject("db/database.js", db);
  for (const m of ["utils/pricing", "services/catalogService", "services/seatService", "services/holdService", "cache/holdStore"]) {
    delete require.cache[require.resolve(path.join(__dirname, "..", m + ".js"))];
  }
  return {
    redis, db,
    holds: require("../services/holdService"),
    seatsvc: require("../services/seatService"),
  };
}

module.exports = { loadServices };
