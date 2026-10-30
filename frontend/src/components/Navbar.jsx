import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Search, MapPin, User, Ticket, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getCities } from '../services/movieService.js';
const CITY_KEY = 'cinevia_city';
export const getSelectedCity = () => localStorage.getItem(CITY_KEY) || '';
export default function Navbar() {
  const { isAuthed, user, logout } = useAuth(); const nav = useNavigate();
  const [q, setQ] = useState(''); const [cities, setCities] = useState([]); const [city, setCity] = useState(getSelectedCity()); const [cityError, setCityError] = useState('');
  useEffect(() => { getCities().then(list => { setCities(list); if (!getSelectedCity() && list.length) { setCity(String(list[0].id)); localStorage.setItem(CITY_KEY, String(list[0].id)); } }).catch(e => setCityError(e.message)); }, []);
  const submit = e => { e.preventDefault(); nav(`/?q=${encodeURIComponent(q)}`); };
  const changeCity = e => { setCity(e.target.value); localStorage.setItem(CITY_KEY, e.target.value); window.dispatchEvent(new Event('cinevia-city-change')); };
  return <header className="nav"><Link to="/" className="logo">Cinevia</Link>
    <label className="city"><MapPin size={16} /><select value={city} onChange={changeCity} aria-label="City"><option value="">All cities</option>{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <form onSubmit={submit} className="search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search movies by title" aria-label="Search movies" /></form>
    {cityError && <span className="muted" title={cityError}>City list unavailable</span>}
    <nav className="navlinks"><NavLink to="/my-bookings"><Ticket size={16} /><span>My Bookings</span></NavLink>
      {isAuthed ? <button className="link" onClick={() => { logout(); nav('/'); }}><LogOut size={16} /><span>{user?.username || 'Logout'}</span></button> : <NavLink to="/login"><User size={16} /><span>Login</span></NavLink>}</nav></header>;
}
