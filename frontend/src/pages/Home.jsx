import {useSearchParams,Link} from 'react-router-dom';import {getMovies} from '../services/movieService.js';import useAsync from '../hooks/useAsync.js';
import MovieCard from '../components/MovieCard.jsx';import MovieCarousel from '../components/MovieCarousel.jsx';import LoadingSpinner from '../components/LoadingSpinner.jsx';
export default function Home(){const [p]=useSearchParams();const q=(p.get('q')||'').toLowerCase();const {data,loading,error,retry}=useAsync(getMovies,[]);
if(loading)return <LoadingSpinner label="Loading movies"/>;
if(error)return <div className="state">{error}<button className="btn" onClick={retry}>Try again</button></div>;
const list=data.filter(m=>m.title.toLowerCase().includes(q));const now=list.filter(m=>m.status==='now'),soon=list.filter(m=>m.status==='soon');const f=data.find(m=>m.status==='now');
return(<>{!q&&f&&<section className="hero" style={{background:f.poster}}><div><p className="muted">Now showing in {f.language}</p><h1>{f.title}</h1><p className="lede">{f.synopsis}</p><Link className="btn" to={`/movie/${f.id}`}>Book tickets</Link></div></section>}
{!list.length&&<p className="state">No movies match "{q}". Try another title.</p>}
{now.length>0&&<MovieCarousel title="Now showing">{now.map(m=><MovieCard key={m.id} movie={m}/>)}</MovieCarousel>}
{soon.length>0&&<MovieCarousel title="Coming soon">{soon.map(m=><MovieCard key={m.id} movie={m}/>)}</MovieCarousel>}</>)}
