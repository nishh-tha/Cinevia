import { useState } from 'react';
import { getMyBookings, cancelBooking } from '../services/bookingService.js';
import useAsync from '../hooks/useAsync.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { Link, useNavigate } from 'react-router-dom';
export default function MyBookings() {
  const { data, loading, error, retry } = useAsync(getMyBookings, []); const [busyId, setBusyId] = useState(null); const [message, setMessage] = useState(''); const nav = useNavigate();
  if (loading) return <LoadingSpinner label="Loading bookings"/>;
  if (error) return <div className="state">{error}<button className="btn" onClick={retry}>Try again</button></div>;
  const list = Array.isArray(data) ? data : data.bookings || [];
  if (!list.length) return <div className="state">No bookings yet.<Link className="btn" to="/">Browse movies</Link></div>;
  const cancel = async id => { setBusyId(id); setMessage(''); try { const updated = await cancelBooking(id); nav(`/confirmation/${updated.id}`); } catch (e) { setMessage(e.message); setBusyId(null); } };
  return <section className="sec"><h2>My bookings</h2>{message && <p className="err" role="alert">{message}</p>}<div className="blist">{list.map((b, i) => <article key={b.id || i} className="bk"><div className="poster sm" style={{ background: b.poster || 'linear-gradient(160deg,#7a1e1e,#1a1a1d)' }}/><div><h3>{b.movie?.title || 'Booking'}</h3><p className="muted">ID {b.id}, seats {(b.seats || []).map(s => s.id).join(', ') || '-'}</p><p className="muted">{b.cinema?.name} · {b.showtime}</p><span className={`chip ${b.status === 'CONFIRMED' ? 'on' : ''}`}>{b.status}</span>
    {b.cancellable && <p><button className="btn ghost" disabled={busyId === b.id} onClick={() => cancel(b.id)}>{busyId === b.id ? 'Cancelling…' : 'Cancel booking'}</button></p>}</div></article>)}</div></section>;
}
