import {Navigate,Outlet,useLocation} from 'react-router-dom';import {useAuth} from '../context/AuthContext.jsx';
export default function ProtectedRoute(){const {isAuthed}=useAuth();const l=useLocation();return isAuthed?<Outlet/>:<Navigate to="/login" state={{from:l.pathname+l.search}} replace/>}
