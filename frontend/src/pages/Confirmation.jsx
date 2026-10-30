import { useParams, Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { getBooking } from '../services/bookingService.js';
import useAsync from '../hooks/useAsync.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { draft, money } from '../utils/format.js';
export default function Confirmation() {
  const { bookingId } = useParams(); const { data: b, loading, error, retry } = useAsync(() => getBooking(bookingId), [bookingId]);
  if (loading) return <LoadingSpinner label="Loading your booking"/>;
  if (error) return <div className="state">{error}<button className="btn" onClick={retry}>Try again</button></div>;
  draft.clear();
  return <div className="authbox"><CheckCircle size={40} color="#e5383b"/><h1>{b.status === 'CANCELLED' ? 'Booking cancelled' : 'Booking confirmed'}</h1>
    <dl className="kv"><dt>Booking ID</dt><dd>{b.id}</dd><dt>Movie</dt><dd>{b.movie?.title}</dd><dt>Cinema</dt><dd>{b.cinema?.name}</dd><dt>Showtime</dt><dd>{b.showtime}</dd><dt>Seats</dt><dd>{(b.seats || []).map(s => s.id).join(', ')}</dd><dt>Total</dt><dd>{money(b.total || 0)}</dd><dt>Payment</dt><dd>{b.paymentStatus}</dd></dl>
    <p className="muted">{b.note || 'Demo booking. No payment was taken.'}</p><Link className="btn" to="/my-bookings">My bookings</Link>
  </div>;
}
