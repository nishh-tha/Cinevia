import { api } from './api.js';
export const holdSeats = (showId, seatIds) => api('/holds', { method: 'POST', body: { showId, seatIds } });
export const getHold = holdId => api(`/holds/${encodeURIComponent(holdId)}`);
export const releaseHold = holdId => api(`/holds/${encodeURIComponent(holdId)}`, { method: 'DELETE' });
// The backend confirms demo bookings immediately. No payment provider is involved.
export const confirmBooking = holdId => api('/checkout', { method: 'POST', body: { holdId } });
export const getBooking = id => api(`/bookings/${encodeURIComponent(id)}`);
export const getMyBookings = () => api('/bookings/mine');
export const cancelBooking = id => api(`/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
