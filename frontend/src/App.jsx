import {Routes,Route} from 'react-router-dom';
import MainLayout from './layouts/MainLayout.jsx';import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';import MovieDetails from './pages/MovieDetails.jsx';
import {Login,Register,ForgotPassword,ResetPassword} from './pages/Auth.jsx';
import SeatSelection from './pages/SeatSelection.jsx';import Checkout from './pages/Checkout.jsx';
import Confirmation from './pages/Confirmation.jsx';import MyBookings from './pages/MyBookings.jsx';
export default function App(){return(<Routes><Route element={<MainLayout/>}>
<Route path="/" element={<Home/>}/><Route path="/movie/:id" element={<MovieDetails/>}/>
<Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
<Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/>
<Route element={<ProtectedRoute/>}><Route path="/seats/:showId" element={<SeatSelection/>}/><Route path="/checkout" element={<Checkout/>}/>
<Route path="/confirmation/:bookingId" element={<Confirmation/>}/><Route path="/my-bookings" element={<MyBookings/>}/></Route>
<Route path="*" element={<p className="state">Page not found.</p>}/></Route></Routes>)}
