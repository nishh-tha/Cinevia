import { api } from './api.js';
export const getCities = async () => (await api('/cities', { auth: false })).cities || [];
export const getMovies = () => api('/movies', { auth: false });
export const getMovie = id => api(`/movies/${encodeURIComponent(id)}`, { auth: false });
export const getShows = (movieId, date, city) => {
  const params = new URLSearchParams({ date });
  if (city) params.set('city', city);
  return api(`/movies/${encodeURIComponent(movieId)}/shows?${params}`, { auth: false });
};
export const getSeats = showId => api(`/shows/${encodeURIComponent(showId)}/seats`);
