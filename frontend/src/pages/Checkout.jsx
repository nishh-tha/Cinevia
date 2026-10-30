import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { confirmBooking, releaseHold } from '../services/bookingService.js';
import useCountdown from '../hooks/useCountdown.js';
import BookingSummary from '../components/BookingSummary.jsx';
import { draft } from '../utils/format.js';
export default function Checkout() {
  const d = draft.get(); const nav = useNavigate(); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const left = useCountdown(d?.hold?.expiresAt);
  if (!d?.hold) return <Navigate to="/" replace/>;
  const confirm = async () => {
    setBusy(true); setMsg('');
    try { const result = await confirmBooking(d.hold.holdId); nav(`/confirmation/${result.bookingId || result.id}`, { replace: true }); }
    catch (e) { setMsg(e.message); setBusy(false); }
  };
  const cancel = async () => { try { await releaseHold(d.hold.holdId); } catch {} draft.clear(); nav('/'); };
  const expired = left === 0;
  return <div className="split"><div><h2>Confirm your booking</h2>
    {left != null && <p className={expired ? 'err' : 'timer'}>{expired ? 'Your hold expired. Select seats again.' : `Seats held for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</p>}
    {msg && <p className="err" role="alert">{msg}</p>}
    <p className="muted">This is a demo booking. No payment will be collected.</p>
  </div><div><BookingSummary {...d} seats={d.seats || d.hold.seats || []}/>
    <button className="btn full" disabled={busy || expired} onClick={confirm}>{busy ? 'Confirming booking' : 'Confirm booking'}</button>
    <button className="btn ghost full" disabled={busy} onClick={cancel}>Release seats</button>
  </div></div>;
}
