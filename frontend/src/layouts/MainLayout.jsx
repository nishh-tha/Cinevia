import {Outlet} from 'react-router-dom';import Navbar from '../components/Navbar.jsx';
export default function MainLayout(){return(<><Navbar/><main><Outlet/></main><footer className="foot">Cinevia. Showtimes and prices are subject to cinema confirmation.</footer></>)}
