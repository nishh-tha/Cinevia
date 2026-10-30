import { useState } from 'react'; import { useNavigate } from 'react-router-dom'; import { getSeats } from '../services/movieService.js'; import { holdSeats } from '../services/bookingService.js';
import useAsync from '../hooks/useAsync.js'; import SeatGrid from '../components/SeatGrid.jsx'; import BookingSummary from '../components/BookingSummary.jsx'; import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { draft, HOLD_SECONDS } from '../utils/format.js';
export default function SeatSelection() {
  const d = draft.get(); const nav = useNavigate(); const [sel, setSel] = useState([]); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const { data, loading, error, retry } = useAsync(() => d ? getSeats(d.showId) : Promise.reject(new Error('Choose a showtime first.')), []);
  if (loading) return <LoadingSpinner label="Loading seats" />; if (error) return <div className="state">{error}<button className="btn" onClick={retry}>Try again</button></div>;
  const chosen = data.filter(s => sel.includes(s.id));
  const toggle = s => {
    if (s.status !== 'available') return setMsg(`Seat ${s.id} is ${s.status === 'held' ? 'being held by another customer' : 'already booked'}. Choose another seat.`); setMsg('');
    if (sel.includes(s.id)) return setSel(sel.filter(x => x !== s.id)); if (sel.length >= 8) return setMsg('You can select up to 8 seats.'); setSel([...sel, s.id]);
  };
  const cont = async () => { setBusy(true); setMsg(''); try { const h = await holdSeats(d.showId, sel); draft.set({ ...d, seats: chosen, hold: h }); nav('/checkout'); } catch (e) { setMsg(`Could not hold seats: ${e.message}`); } finally { setBusy(false); } };
  return (<div className="split"><div><h2>Select seats</h2><p className="muted">Standard rows A-F ₹250. Premium rows G-H ₹350. Seats are held for {Math.round(HOLD_SECONDS / 60)} min once the server confirms your hold.</p>
    <SeatGrid seats={data} selected={sel} onToggle={toggle} />{msg && <p className="err" role="alert">{msg}</p>}</div>
    <div><BookingSummary {...d} seats={chosen} /><button className="btn full" disabled={!sel.length || busy} onClick={cont}>{busy ? 'Holding seats' : 'Continue to checkout'}</button></div></div>)
}
