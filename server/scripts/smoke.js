/* End-to-end check of the running API (real MySQL + Redis).
   Start the server first (npm start), then:  npm run smoke
   Creates two throw-away users and cancels the booking it makes. Override the target with API_URL. */
const BASE = process.env.API_URL || "http://localhost:3000/api";
let failures = 0;

const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`);
  if (!cond) failures++;
};

async function call(path, { method = "GET", body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function newUser(tag) {
  const email = `smoke_${tag}_${Date.now()}@example.com`, password = "SmokeTest#123";
  const reg = await call("/auth/register", { method: "POST", body: { username: `smoke_${tag}`, email, password } });
  check(`register ${tag}`, reg.status === 201, JSON.stringify(reg.data));
  const login = await call("/auth/login", { method: "POST", body: { email, password } });
  check(`login ${tag} returns token + user`, login.status === 200 && login.data.token && login.data.user?.id, JSON.stringify(login.data));
  return { token: login.data.token, id: login.data.user?.id };
}

(async () => {
  const health = await call("/health");
  check("health", health.status === 200);

  const bad = await call("/auth/login", { method: "POST", body: { email: "nobody@example.com", password: "wrongwrong" } });
  check("login with wrong credentials -> 401", bad.status === 401);
  check("holds need a token -> 401", (await call("/holds", { method: "POST", body: {} })).status === 401);

  const u1 = await newUser("a"), u2 = await newUser("b");

  const movies = await call("/movies");
  const movie = movies.data.find?.((m) => m.status === "now");
  check("movies come from the database", movies.status === 200 && !!movie, JSON.stringify(movies.data).slice(0, 200));
  if (!movie) return;
  check("movie details", (await call(`/movies/${movie.id}`)).data.title === movie.title);

  let show, listing;
  for (let i = 0; i < 7 && !show; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    listing = (await call(`/movies/${movie.id}/shows?date=${d}`)).data;
    show = listing[0]?.shows?.[0];
  }
  check("showtimes for a movie", !!show, "No showtimes found - did you run `npm run seed`?");
  if (!show) return;

  const seats = (await call(`/shows/${show.id}/seats`)).data;
  const free = seats.filter((s) => s.status === "available").slice(0, 2).map((s) => s.id);
  check("live seat map", Array.isArray(seats) && free.length === 2);

  const hold = await call("/holds", { method: "POST", token: u1.token, body: { showId: show.id, seatIds: free } });
  check("user A holds 2 seats", hold.status === 201 && hold.data.holdId, JSON.stringify(hold.data));

  const clash = await call("/holds", { method: "POST", token: u2.token, body: { showId: show.id, seatIds: [free[0]] } });
  check("user B cannot hold the same seat -> 409", clash.status === 409 && clash.data.code === "SEATS_UNAVAILABLE", JSON.stringify(clash.data));

  const mapB = (await call(`/shows/${show.id}/seats`, { token: u2.token })).data;
  check("seat shows as held for user B", mapB.find((s) => s.id === free[0])?.status === "held");

  const premature = await call("/checkout", { method: "POST", token: u2.token, body: { holdId: hold.data.holdId } });
  check("user B cannot confirm user A's hold", premature.status === 404, JSON.stringify(premature.data));

  const booking = await call("/checkout", { method: "POST", token: u1.token, body: { holdId: hold.data.holdId } });
  check("user A confirms booking (no payment)", booking.status === 201 && booking.data.status === "CONFIRMED", JSON.stringify(booking.data));
  const again = await call("/checkout", { method: "POST", token: u1.token, body: { holdId: hold.data.holdId } });
  check("confirming twice returns the same booking", again.data.id === booking.data.id && again.status === 200, JSON.stringify(again.data));

  const afterBook = await call("/holds", { method: "POST", token: u2.token, body: { showId: show.id, seatIds: [free[1]] } });
  check("booked seat cannot be held by anyone else", afterBook.status === 409, JSON.stringify(afterBook.data));

  const mine = await call("/bookings/mine", { token: u1.token });
  check("booking history lists the booking", mine.data.bookings?.some((b) => b.id === booking.data.id));
  check("legacy /my-bookings/:userId works for yourself", (await call(`/my-bookings/${u1.id}`, { token: u1.token })).status === 200);
  check("legacy /my-bookings/:userId blocks other users", (await call(`/my-bookings/${u1.id}`, { token: u2.token })).status === 403);
  check("user B cannot read A's booking", (await call(`/bookings/${booking.data.id}`, { token: u2.token })).status === 404);
  check("user B cannot cancel A's booking", (await call(`/bookings/${booking.data.id}/cancel`, { method: "POST", token: u2.token })).status === 404);

  const cancel = await call(`/bookings/${booking.data.id}/cancel`, { method: "POST", token: u1.token });
  check("user A cancels booking", cancel.status === 200 && cancel.data.status === "CANCELLED", JSON.stringify(cancel.data));

  const rebook = await call("/holds", { method: "POST", token: u2.token, body: { showId: show.id, seatIds: free } });
  check("cancelled seats are available again", rebook.status === 201, JSON.stringify(rebook.data));
  if (rebook.data.holdId) await call(`/holds/${rebook.data.holdId}`, { method: "DELETE", token: u2.token });

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("Smoke test crashed:", e.message); process.exit(1); });
