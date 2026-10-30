import {Link} from 'react-router-dom';import {Star} from 'lucide-react';
export default function MovieCard({movie}){return(<Link to={`/movie/${movie.id}`} className="card"><div className="poster" style={{background:movie.poster}}><span>{movie.title}</span>{movie.rating>0&&<b className="badge"><Star size={12} fill="currentColor"/>{movie.rating}</b>}</div>
<h3>{movie.title}</h3><p>{movie.language}, {movie.genres.join('/')}</p>{movie.releaseDate&&<p className="muted">Releases {movie.releaseDate}</p>}</Link>)}
