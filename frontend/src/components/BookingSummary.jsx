import {money,FEE_PER_TICKET} from '../utils/format.js';
export default function BookingSummary({movie,cinema,showtime,date,seats}){const t=seats.reduce((a,s)=>a+s.price,0),f=seats.length*FEE_PER_TICKET;
return(<aside className="summary"><h3>{movie?.title}</h3><p className="muted">{cinema?.name}<br/>{date} at {showtime}</p>
<dl><dt>Seats</dt><dd>{seats.length?seats.map(s=>s.id).join(', '):'None selected'}</dd><dt>Tickets</dt><dd>{money(t)}</dd><dt>Convenience fee</dt><dd>{money(f)}</dd><dt className="tot">Total</dt><dd className="tot">{money(t+f)}</dd></dl></aside>)}
