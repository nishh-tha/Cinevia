// Timezone helpers without extra dependencies. Showtimes are stored in UTC; cinemas live in
// APP_TIMEZONE (default Asia/Kolkata), so "today" and "18:30" are interpreted in that zone.
const parts = (date, timeZone) => {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
};

const offsetMs = (date, timeZone) => {
  const p = parts(date, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
};

// Wall-clock time in `timeZone` -> UTC Date.
function zonedToUtc(y, mo, d, h, mi, timeZone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - offsetMs(new Date(guess), timeZone);
  t = guess - offsetMs(new Date(t), timeZone); // second pass handles DST edges
  return new Date(t);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isValidDateString(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// 'YYYY-MM-DD' (a calendar day in timeZone) -> [startUtc, endUtc)
function dayRangeUtc(dateStr, timeZone) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const start = zonedToUtc(y, mo, d, 0, 0, timeZone);
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const end = zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone);
  return [start, end];
}

const todayString = (timeZone, now = new Date()) => {
  const p = parts(now, timeZone);
  return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
};

const formatTime = (date, timeZone) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

const formatDate = (date, timeZone) => todayString(timeZone, date);

// mysql2 gives Date objects (timezone 'Z'); this converts to MySQL DATETIME text in UTC.
const toMysqlUtc = (date) => date.toISOString().slice(0, 19).replace("T", " ");

module.exports = { zonedToUtc, isValidDateString, dayRangeUtc, todayString, formatTime, formatDate, toMysqlUtc };
