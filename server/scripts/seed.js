/* Demo data: the same movies/cities/cinemas as the original mock data, now in MySQL.
   Fictional sample data (data_source = 'SAMPLE'); no external APIs. Idempotent: safe to re-run,
   and re-running tops up showtimes for the coming days.   Usage: npm run seed */
const config = require("../config");
const db = require("../db/database");
const { zonedToUtc, todayString, toMysqlUtc } = require("../utils/time");

const TZ = config.booking.timezone;
const DAYS_AHEAD = 7;
const BASE_PRICE_PAISE = 25000;       // Rs 250 standard
const ROWS = "ABCDEFGH".split("");    // A-B premium (x1.4 = Rs 350), C-H standard
const SEATS_PER_ROW = 12;

const CITIES = [["Kadapa", "Andhra Pradesh"], ["Hyderabad", "Telangana"], ["Bengaluru", "Karnataka"], ["Chennai", "Tamil Nadu"], ["Mumbai", "Maharashtra"]];

// title, language, duration_min, certificate, genres, score, release_status, release_date, color, synopsis, cast
const MOVIES = [
  ["Midnight Harbour", "English", 134, "UA", "Thriller,Drama", 8.4, "NOW", null, "#7a1e1e", "A dock inspector uncovers a smuggling ring operating under the city's oldest port authority.", "A. Rowe,M. Silva,K. Tan"],
  ["Paper Monsoon", "Hindi", 151, "U", "Romance,Drama", 7.9, "NOW", null, "#274b6d", "Two letter-writers in Mumbai fall for each other without ever meeting.", "R. Kapoor,N. Iyer"],
  ["Iron Orchard", "Telugu", 165, "UA", "Action", 8.1, "NOW", null, "#5b3a1a", "A retired soldier defends his village from land grabbers.", "V. Reddy,S. Rao"],
  ["The Last Cartographer", "English", 125, "U", "Adventure,Fantasy", 7.6, "NOW", null, "#2c5a46", "A mapmaker follows a chart that redraws itself.", "E. Hale,J. Park"],
  ["Static", "Tamil", 118, "UA", "Sci-Fi,Thriller", 0, "SOON", "2026-11-14", "#4a2a63", "A radio operator hears broadcasts from tomorrow.", "D. Kumar"],
  ["Saffron Road", "Hindi", 130, "U", "Comedy", 0, "SOON", "2026-11-28", "#8a5a12", "A food-truck road trip across Rajasthan goes wrong, deliciously.", "P. Shah"],
];

const DEFAULT_TIMES = ["10:30", "13:45", "17:15", "21:00"];
const cinemasFor = (city) => city === "Kadapa"
  ? [{ name: "PVR Kadapa Central", times: DEFAULT_TIMES }, { name: "Sri Venkateswara Cinemas", times: ["11:00", "14:30", "18:00", "21:30"] }]
  : [{ name: `${city} Central Cinema`, times: DEFAULT_TIMES }, { name: `${city} Galaxy Multiplex`, times: ["11:00", "14:30", "18:00", "21:30"] }];

(async () => {
  config.assertReady();

  for (const [name, state] of CITIES)
    await db.query("INSERT IGNORE INTO rs_cities (name, state) VALUES (?, ?)", [name, state]);

  for (const m of MOVIES) {
    await db.query(
      `INSERT INTO rs_movies (title, language, duration_min, rating, genres, score, release_status, release_date, color, synopsis, cast_list, trailer_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'https://www.youtube.com/')
       ON DUPLICATE KEY UPDATE language=VALUES(language), duration_min=VALUES(duration_min), rating=VALUES(rating), genres=VALUES(genres),
         score=VALUES(score), release_status=VALUES(release_status), release_date=VALUES(release_date), color=VALUES(color),
         synopsis=VALUES(synopsis), cast_list=VALUES(cast_list)`, m);
  }
  const [nowMovies] = await db.query("SELECT id FROM rs_movies WHERE release_status='NOW' ORDER BY id");

  const [cities] = await db.query("SELECT id, name FROM rs_cities");
  const today = todayString(TZ);
  const [ty, tm, td] = today.split("-").map(Number);
  let shows = 0;

  for (const city of cities) {
    for (const cin of cinemasFor(city.name)) {
      await db.query("INSERT IGNORE INTO rs_cinemas (city_id, name, address, data_source) VALUES (?,?,?, 'SAMPLE')",
        [city.id, cin.name, `Sample address, ${city.name}`]);
      const [[cinema]] = await db.query("SELECT id FROM rs_cinemas WHERE city_id=? AND name=?", [city.id, cin.name]);

      for (let s = 0; s < 2; s++) {
        await db.query("INSERT IGNORE INTO rs_screens (cinema_id, name) VALUES (?,?)", [cinema.id, `Screen ${s + 1}`]);
        const [[screen]] = await db.query("SELECT id FROM rs_screens WHERE cinema_id=? AND name=?", [cinema.id, `Screen ${s + 1}`]);

        const seatRows = [];
        for (const [r, row] of ROWS.entries()) {
          const premium = r >= 6;
          for (let n = 1; n <= SEATS_PER_ROW; n++)
            seatRows.push([screen.id, row, n, premium ? "PREMIUM" : "STANDARD", premium ? 1.4 : 1.0]);
        }
        await db.query("INSERT IGNORE INTO rs_screen_seats (screen_id,row_label,seat_number,category,price_multiplier) VALUES ?", [seatRows]);

        const showRows = [];
        for (let day = 0; day < DAYS_AHEAD; day++) {
          const d = new Date(Date.UTC(ty, tm - 1, td + day));
          for (const [t, time] of cin.times.entries()) {
            const [h, mi] = time.split(":").map(Number);
            const startsAt = zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, mi, TZ);
            const movie = nowMovies[(t + 2 * s) % nowMovies.length];
            showRows.push([movie.id, screen.id, toMysqlUtc(startsAt), BASE_PRICE_PAISE]);
          }
        }
        const [r] = await db.query("INSERT IGNORE INTO rs_showtimes (movie_id, screen_id, starts_at, base_price_paise) VALUES ?", [showRows]);
        shows += r.affectedRows;
      }
    }
  }
  console.log(`Seed complete: ${CITIES.length} cities, ${MOVIES.length} movies, ${shows} new showtimes (sample data).`);
  await db.end();
})().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
