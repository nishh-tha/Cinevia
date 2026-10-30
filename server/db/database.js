// MySQL pool (Aiven). Same host/port/user/database/SSL-certificate setup as before,
// now driven by environment variables. Exports a promise-based pool.
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");
const config = require("../config");

const { db } = config;

let ssl;
if (db.ssl) {
  const caPath = path.resolve(__dirname, "..", db.sslCaPath);
  if (!fs.existsSync(caPath)) {
    throw new Error(`SSL CA certificate not found at ${caPath}. Place Aiven's ca.pem there or set DB_SSL_CA_PATH.`);
  }
  ssl = { ca: fs.readFileSync(caPath) };
}

const pool = mysql.createPool({
  host: db.host,
  port: db.port,
  user: db.user,
  password: db.password,
  database: db.database,
  ssl,
  waitForConnections: true,
  connectionLimit: db.connectionLimit,
  queueLimit: 0,
  timezone: "Z",          // all DATETIME values are UTC
  dateStrings: false,
  multipleStatements: false,
});

module.exports = pool.promise();
