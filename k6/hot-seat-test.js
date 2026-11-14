import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const BASE = 'http://localhost:3000/api';
const MODE = __ENV.MODE || 'db';                 // 'db' or 'redis'
const VUS = Number(__ENV.VUS || 10);
const SHOW_ID = Number(__ENV.SHOW_ID || 2047);

export const options = {
  scenarios: {
    hot_seat: { executor: 'shared-iterations', vus: VUS, iterations: VUS, maxDuration: '2m' },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

http.setResponseCallback(http.expectedStatuses(200, 201, 409));

const success = new Counter('bookings_success');
const conflict = new Counter('bookings_conflict');
const other = new Counter('bookings_other');
const bookingMs = new Trend('booking_ms', true);   // full booking time only
const lockWait = new Trend('lock_wait_ms');

const jsonHeaders = { 'Content-Type': 'application/json' };

export function setup() {
  const tokens = [];
  for (let i = 1; i <= VUS; i++) {
    const body = { username: `k6user${i}`, email: `k6user${i}@example.com`, password: 'Test@12345' };
    http.post(`${BASE}/auth/register`, JSON.stringify(body), { headers: jsonHeaders });
    const r = http.post(`${BASE}/auth/login`,
      JSON.stringify({ email: body.email, password: body.password }), { headers: jsonHeaders });
    tokens.push(r.json('token'));
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const headers = { ...jsonHeaders, Authorization: `Bearer ${token}` };
  const payload = JSON.stringify({ showId: SHOW_ID, seatIds: ['A1'] });
  const start = Date.now();
  let outcome;

  if (MODE === 'db') {
    const res = http.post(`${BASE}/db/bookings`, payload, { headers });
    outcome = res.status;
    const lw = res.headers['X-Lock-Wait-Ms'];
    if (lw !== undefined) lockWait.add(Number(lw));
  } else {
    const hold = http.post(`${BASE}/holds`, payload, { headers });
    outcome = hold.status;
    if (hold.status === 201) {
      const co = http.post(`${BASE}/checkout`, JSON.stringify({ holdId: hold.json('holdId') }), { headers });
      outcome = co.status;
    }
  }

  bookingMs.add(Date.now() - start);
  if (outcome === 201) success.add(1);
  else if (outcome === 409) conflict.add(1);
  else other.add(1);
}