import {useState} from 'react';import {Link,useNavigate,useLocation,useSearchParams} from 'react-router-dom';import {Eye,EyeOff} from 'lucide-react';
import {useAuth} from '../context/AuthContext.jsx';import * as auth from '../services/authService.js';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function Field({label,type='text',value,onChange,error,pw}){const [show,setShow]=useState(false);return(<label className="field">{label}<span className="inp"><input type={pw&&!show?'password':type} value={value} onChange={e=>onChange(e.target.value)} autoComplete={pw?'current-password':'on'}/>{pw&&<button type="button" className="link" aria-label="Toggle password visibility" onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button>}</span>{error&&<em>{error}</em>}</label>)}
function Form({title,fields,validate,onSubmit,cta,footer,okMsg}){const [v,setV]=useState({});const [err,setErr]=useState({});const [msg,setMsg]=useState('');const [ok,setOk]=useState('');const [busy,setBusy]=useState(false);
const go=async e=>{e.preventDefault();const er=validate(v);setErr(er);if(Object.keys(er).length)return;setBusy(true);setMsg('');try{await onSubmit(v);if(okMsg)setOk(okMsg);}catch(x){setMsg(x.message);}finally{setBusy(false);}};
return(<form className="authbox" onSubmit={go} noValidate><h1>{title}</h1>{fields.map(([k,l,t,pw])=><Field key={k} label={l} type={t} pw={pw} value={v[k]||''} onChange={x=>setV({...v,[k]:x})} error={err[k]}/>)}
{msg&&<p className="err" role="alert">{msg}</p>}{ok&&<p className="ok" role="status">{ok}</p>}<button className="btn" disabled={busy}>{busy?'Please wait':cta}</button><p className="muted">{footer}</p></form>)}
export function Login(){const {login}=useAuth();const nav=useNavigate();const l=useLocation();
return <Form title="Log in" cta="Log in" fields={[['email','Email','email'],['password','Password','password',true]]}
validate={v=>({...(!EMAIL.test(v.email||'')&&{email:'Enter a valid email.'}),...(!v.password&&{password:'Enter your password.'})})}
onSubmit={async v=>{await login(v.email,v.password);nav(l.state?.from||'/',{replace:true});}}
footer={<><Link to="/register">Create account</Link> or <Link to="/forgot-password">reset password</Link></>}/>}
export function Register(){const nav=useNavigate();
return <Form title="Create account" cta="Create account" fields={[['username','Username'],['email','Email','email'],['password','Password','password',true]]}
validate={v=>({...((v.username||'').length<3&&{username:'Use at least 3 characters.'}),...(!EMAIL.test(v.email||'')&&{email:'Enter a valid email.'}),...((v.password||'').length<8&&{password:'Use at least 8 characters.'})})}
onSubmit={async v=>{await auth.register(v.username,v.email,v.password);nav('/login');}} footer={<>Already registered? <Link to="/login">Log in</Link></>}/>}
export function ForgotPassword(){return <Form title="Forgot password" cta="Send reset link" okMsg="If that email is registered, a reset link has been sent." fields={[['email','Email','email']]}
validate={v=>EMAIL.test(v.email||'')?{}:{email:'Enter a valid email.'}} onSubmit={v=>auth.forgotPassword(v.email)} footer={<Link to="/login">Back to login</Link>}/>}
export function ResetPassword(){const [p]=useSearchParams();const nav=useNavigate();
return <Form title="Reset password" cta="Save new password" fields={[['password','New password','password',true],['confirm','Confirm password','password',true]]}
validate={v=>({...((v.password||'').length<8&&{password:'Use at least 8 characters.'}),...(v.password!==v.confirm&&{confirm:'Passwords do not match.'})})}
onSubmit={async v=>{await auth.resetPassword(p.get('token'),v.password);nav('/login');}} footer={<Link to="/login">Back to login</Link>}/>}
