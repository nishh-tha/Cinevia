/* Applies migrations/*.sql in order and records them in schema_migrations.
   Usage: npm run migrate   (safe to re-run) */
const fs = require("fs");
const path = require("path");
const config = require("../config");
const db = require("../db/database");

const DIR = path.join(__dirname, "..", "migrations");

const statementsOf = (sql) =>
  sql.split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n")
    .split(";").map((s) => s.trim()).filter(Boolean);

(async () => {
  config.assertReady();
  const conn = await db.getConnection();
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK('cinevia_migrate', 30) AS ok");
    if (lock.ok !== 1) throw new Error("Another migration is running (could not get lock).");

    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(150) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [done] = await conn.query("SELECT name FROM schema_migrations");
    const applied = new Set(done.map((r) => r.name));

    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) { console.log(`skip   ${file}`); continue; }
      console.log(`apply  ${file}`);
      for (const stmt of statementsOf(fs.readFileSync(path.join(DIR, file), "utf8"))) await conn.query(stmt);
      await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
      ran++;
    }
    await conn.query("SELECT RELEASE_LOCK('cinevia_migrate')");
    console.log(ran ? `Done: ${ran} migration(s) applied.` : "Database is up to date.");
  } finally {
    conn.release();
    await db.end();
  }
})().catch((e) => { console.error("Migration failed:", e.message); process.exit(1); });
