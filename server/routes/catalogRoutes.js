const express = require("express");
const catalog = require("../services/catalogService");
const seats = require("../services/seatService");
const { optionalAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/cities", async (_req, res) => res.json({ cities: await catalog.listCities() }));

router.get("/movies", async (req, res) => res.json(await catalog.listMovies({ status: req.query.status, q: req.query.q })));
router.get("/movies/:id", async (req, res) => res.json(await catalog.getMovie(req.params.id)));
// [{ cinema, shows:[{ id, time, startsAt, screen, price }] }]   ?date=YYYY-MM-DD&city=<name|id>
router.get("/movies/:id/shows", async (req, res) =>
  res.json(await catalog.getMovieShows(req.params.id, { date: req.query.date, city: req.query.city })));

router.get("/shows/:id", async (req, res) => res.json(await catalog.getShow(req.params.id)));
// Live seat map: [{ id:"A1", row, number, category, price, status:"available|held|booked", heldByYou }]
router.get("/shows/:id/seats", optionalAuth, async (req, res) => res.json(await seats.listSeats(req.params.id, req.user?.id)));

module.exports = router;
