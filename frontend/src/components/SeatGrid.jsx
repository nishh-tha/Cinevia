export default function SeatGrid({seats,selected,onToggle}){const rows=[...new Set(seats.map(s=>s.row))];
return(<div className="seatwrap"><div className="screen">Screen this way</div>{rows.map(r=><div key={r} className="seatrow"><span className="rl">{r}</span>{seats.filter(s=>s.row===r).map(s=>{const sel=selected.includes(s.id);const st=sel?'selected':s.status;
return <button key={s.id} className={`seat ${st} ${s.category==='Premium'?'prem':''}`} aria-label={`${s.id} ${s.category} ${st}`} aria-pressed={sel} onClick={()=>onToggle(s)}>{s.number}</button>})}</div>)}
<div className="legend">{['available','selected','held','booked'].map(l=><span key={l}><i className={`seat ${l}`}/>{l}</span>)}</div></div>)}
