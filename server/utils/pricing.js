// All money is integer paise and is computed ONLY on the server; client totals are never trusted.
const config = require("../config");

const seatPaise = (basePaise, multiplier) => Math.round(basePaise * Number(multiplier));
const paiseToRupees = (p) => p / 100;
const feeFor = (ticketCount) => ticketCount * config.booking.convenienceFeePaise;

function totals(seatPricesPaise) {
  const tickets = seatPricesPaise.reduce((a, b) => a + b, 0);
  const fee = feeFor(seatPricesPaise.length);
  return { ticketsPaise: tickets, feePaise: fee, totalPaise: tickets + fee };
}

const totalsView = (t) => ({
  ticketsTotal: paiseToRupees(t.ticketsPaise),
  convenienceFee: paiseToRupees(t.feePaise),
  total: paiseToRupees(t.totalPaise),
  currency: "INR",
});

module.exports = { seatPaise, paiseToRupees, feeFor, totals, totalsView };
