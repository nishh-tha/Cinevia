import {useEffect,useState,useCallback} from 'react';
export default function useAsync(fn,deps){const [s,set]=useState({data:null,loading:true,error:null});
  const run=useCallback(()=>{let on=true;set(x=>({...x,loading:true,error:null}));fn().then(d=>on&&set({data:d,loading:false,error:null})).catch(e=>on&&set({data:null,loading:false,error:e.message}));return()=>{on=false};},deps);
  useEffect(run,[run]);return {...s,retry:run};}
