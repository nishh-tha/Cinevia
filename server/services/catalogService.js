const db = require("../db/database");
const config = require("../config");
const { HttpError } = require("../utils/errors");
const { positiveInt, fail } = require("../utils/validation");
const { isValidDateString, dayRangeUtc, todayString, formatTime, formatDate, toMysqlUtc } = require("../utils/time");
const { seatPaise, paiseToRupees } = require("../utils/pricing");

const TZ = config.booking.timezone;

const duration = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : null);
const poster = (color) => `linear-gradient(160deg,${color},#1a1a1d)`;
const list = (s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);
const label = (row, n) => `${row}${n}`;
const CATEGORY = { STANDARD: "Standard", PREMIUM: "Premium", RECLINER: "Recliner" };

const movieView = (m) => ({
  id: m.id,
  title: m.title,
  language: m.language,
  genres: list(m.genres),
  rating: Number(m.score) || 0,          // audience score, as used by the UI
  certificate: m.rating,                  // U / UA / A
  duration: duration(m.duration_min),
  durationMin: m.duration_min,
  status: m.release_status === "SOON" ? "soon" : "now",
  releaseDate: m.release_date
    ? new Date(m.release_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : undefined,
  color: m.color,
  poster: poster(m.color),
  synopsis: m.synopsis,
  cast: list(m.cast_list),
  trailer: m.trailer_url,
});

async function listCities() {
  const [rows] = await db.query("SELECT id, name, state FROM rs_cities WHERE is_active = 1 ORDER BY name");
  return rows;
}

async function listMovies({ status, q } = {}) {
  const where = [], params = [];
  if (status) {
    const s = String(status).toLowerCase();
    if (!["now", "soon"].includes(s)) throw fail("status must be 'now' or 'soon'.");
    where.push("release_status = ?"); params.push(s.toUpperCase());
  }
  if (q) { where.push("title LIKE ?"); params.push(`%${String(q).slice(0, 100).replace(/[%_\\]/g, "\\$&")}%`); }
  const [rows] = await db.query(
    `SELECT * FROM rs_movies ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY release_status, id`, params);
  return rows.map(movieView);
}

async function getMovie(id) {
  const [rows] = await db.query("SELECT * FROM rs_movies WHERE id = ?", [positiveInt(id, "Movie id")]);
  if (!rows[0]) throw new HttpError(404, "MOVIE_NOT_FOUND", "Movie not found.");
  return movieView(rows[0]);
}

// Showtimes of one movie on one calendar day (in the cinemas' timezone), grouped by cinema.
async function getMovieShows(movieId, { date, city } = {}) {
  const id = positiveInt(movieId, "Movie id");
  const day = date || todayString(TZ);
  if (!isValidDateString(day)) throw fail("date must be in YYYY-MM-DD format.");
  const [from, to] = dayRangeUtc(day, TZ);

  const params = [id, toMysqlUtc(from), toMysqlUtc(to)];
  let cityClause = "";
  if (city) {
    cityClause = /^\d+$/.test(String(city)) ? "AND ci.id = ?" : "AND ci.name = ?";
    params.push(/^\d+$/.test(String(city)) ? Number(city) : String(city));
  }
  const [rows] = await db.query(
    `SELECT s.id show_id, s.starts_at, s.base_price_paise, sc.name screen_name,
            c.id cinema_id, c.name cinema_name, c.address, ci.id city_id, ci.name city_name
       FROM rs_showtimes s
       JOIN rs_screens sc ON sc.id = s.screen_id
       JOIN rs_cinemas c ON c.id = sc.cinema_id
       JOIN rs_cities ci ON ci.id = c.city_id
      WHERE s.movie_id = ? AND s.status = 'ACTIVE'
        AND s.starts_at >= ? AND s.starts_at < ? AND s.starts_at > UTC_TIMESTAMP() ${cityClause}
      ORDER BY c.name, s.starts_at`, params);

  const byCinema = new Map();
  for (const r of rows) {
    if (!byCinema.has(r.cinema_id))
      byCinema.set(r.cinema_id, { cinema: { id: r.cinema_id, name: r.cinema_name, address: r.address, city: r.city_name }, shows: [] });
    byCinema.get(r.cinema_id).shows.push({
      id: r.show_id,
      time: formatTime(new Date(r.starts_at), TZ),
      startsAt: new Date(r.starts_at).toISOString(),
      screen: r.screen_name,
      price: paiseToRupees(r.base_price_paise),   // starting price
    });
  }
  return [...byCinema.values()];
}

async function loadShow(showId) {
  const [rows] = await db.query(
    `SELECT s.id, s.screen_id, s.starts_at, s.base_price_paise, s.status,
            sc.name screen_name, m.id movie_id, m.title, m.color, c.id cinema_id, c.name cinema_name, c.address, ci.name city_name
       FROM rs_showtimes s
       JOIN rs_screens sc ON sc.id = s.screen_id
       JOIN rs_cinemas c ON c.id = sc.cinema_id
       JOIN rs_cities ci ON ci.id = c.city_id
       JOIN rs_movies m ON m.id = s.movie_id
      WHERE s.id = ?`, [positiveInt(showId, "Show id")]);
  if (!rows[0]) throw new HttpError(404, "SHOW_NOT_FOUND", "Show not found.");
  return rows[0];
}

const isBookable = (show, now = new Date()) => show.status === "ACTIVE" && new Date(show.starts_at) > now;

const showView = (s) => {
  const startsAt = new Date(s.starts_at);
  return {
    id: s.id,
    movie: { id: s.movie_id, title: s.title, poster: poster(s.color) },
    cinema: { id: s.cinema_id, name: s.cinema_name, address: s.address, city: s.city_name },
    screen: s.screen_name,
    startsAt: startsAt.toISOString(),
    date: formatDate(startsAt, TZ),
    time: formatTime(startsAt, TZ),
    bookable: isBookable(s),
  };
};

const getShow = async (showId) => showView(await loadShow(showId));

async function loadScreenSeats(screenId) {
  const [rows] = await db.query(
    "SELECT id, row_label, seat_number, category, price_multiplier FROM rs_screen_seats WHERE screen_id = ? ORDER BY row_label, seat_number",
    [screenId]);
  return rows;
}

const seatBase = (show, s) => {
  const paise = seatPaise(show.base_price_paise, s.price_multiplier);
  return { id: label(s.row_label, s.seat_number), seatId: s.id, row: s.row_label, number: s.seat_number,
    category: CATEGORY[s.category], price: paiseToRupees(paise), pricePaise: paise };
};

module.exports = {
  listCities, listMovies, getMovie, getMovieShows, loadShow, getShow, showView, isBookable, loadScreenSeats, seatBase, label, poster, CATEGORY, TZ,
};
