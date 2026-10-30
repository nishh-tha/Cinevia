export const money=n=>`₹${Number(n).toLocaleString('en-IN')}`;
export const nextDays=(n=5)=>Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return{iso:d.toISOString().slice(0,10),day:d.toLocaleDateString('en-IN',{weekday:'short'}),date:d.getDate(),month:d.toLocaleDateString('en-IN',{month:'short'})};});
export const FEE_PER_TICKET=30;
export const HOLD_SECONDS=Number(import.meta.env.VITE_SEAT_HOLD_SECONDS)||300;
export const draft={get:()=>{try{return JSON.parse(sessionStorage.getItem('draft'))}catch{return null}},set:d=>sessionStorage.setItem('draft',JSON.stringify(d)),clear:()=>sessionStorage.removeItem('draft')};
