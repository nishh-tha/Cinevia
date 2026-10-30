import {useEffect,useState} from 'react';import {useParams,useNavigate} from 'react-router-dom';import {Play,Clock,Star} from 'lucide-react';
import {getMovie,getShows} from '../services/movieService.js';import useAsync from '../hooks/useAsync.js';import ShowtimeSelector from '../components/ShowtimeSelector.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';import {nextDays,draft} from '../utils/format.js';import {getSelectedCity} from '../components/Navbar.jsx';
export default function MovieDetails(){const {id}=useParams();const nav=useNavigate();const days=nextDays();const [date,setDate]=useState(days[0].iso);
const m=useAsync(()=>getMovie(id),[id]);const [city,setCity]=useState(getSelectedCity());useEffect(()=>{const update=()=>setCity(getSelectedCity());window.addEventListener('cinevia-city-change',update);return()=>window.removeEventListener('cinevia-city-change',update);},[]);const s=useAsync(()=>getShows(id,date,city),[id,date,city]);
if(m.loading)return <LoadingSpinner/>;if(m.error)return <p className="state">{m.error}</p>;const mv=m.data;
const pick=(cinema,show)=>{draft.set({movie:{id:mv.id,title:mv.title},cinema,showtime:show.time,date,showId:show.id});nav(`/seats/${show.id}`);};
return(<><section className="backdrop" style={{background:mv.poster}}><div className="detail"><div className="poster big" style={{background:mv.poster}}><span>{mv.title}</span></div>
<div><h1>{mv.title}</h1><p className="meta"><Star size={14}/>{mv.rating||'New'} <Clock size={14}/>{mv.duration} {mv.language}, {mv.genres.join('/')}</p><p className="lede">{mv.synopsis}</p><p className="muted">Cast: {mv.cast.join(', ')}</p>
<a className="btn ghost" href={mv.trailer} target="_blank" rel="noreferrer"><Play size={16}/>Watch trailer</a></div></div></section>
<section className="sec"><h2>Showtimes</h2>{mv.status==='soon'?<p className="muted">Bookings open closer to {mv.releaseDate}.</p>:s.error?<p className="state">{s.error}</p>:<ShowtimeSelector days={days} date={date} onDate={setDate} listings={s.data||[]} loading={s.loading} onPick={pick}/>}</section></>)}
