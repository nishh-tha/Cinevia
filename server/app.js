const express = require("express");
const cors = require("cors");
const config = require("./config");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api", require("./routes/catalogRoutes"));
  app.use("/api", require("./routes/bookingRoutes"));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
