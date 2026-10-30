import {useEffect,useState} from 'react';
export default function useCountdown(expiresAt){const calc=()=>expiresAt?Math.max(0,Math.floor((new Date(expiresAt)-Date.now())/1000)):null;
  const [s,set]=useState(calc);useEffect(()=>{set(calc());if(!expiresAt)return;const i=setInterval(()=>set(calc()),1000);return()=>clearInterval(i);},[expiresAt]);return s;}
