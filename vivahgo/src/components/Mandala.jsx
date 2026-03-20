function Mandala({ size=400, style={} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={style} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="190" stroke="#D4AF37" strokeWidth="1" strokeDasharray="6 4"/>
      <circle cx="200" cy="200" r="150" stroke="#D4AF37" strokeWidth="1" strokeDasharray="4 6"/>
      <circle cx="200" cy="200" r="110" stroke="#D4AF37" strokeWidth="1"/>
      <circle cx="200" cy="200" r="70" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="2 4"/>
      <circle cx="200" cy="200" r="30" stroke="#D4AF37" strokeWidth="2"/>
      {[...Array(16)].map((_,i)=>{
        const a=i*(360/16)*Math.PI/180;
        const x=200+190*Math.sin(a), y=200-190*Math.cos(a);
        return <circle key={i} cx={x} cy={y} r="4" fill="#D4AF37"/>;
      })}
      {[...Array(8)].map((_,i)=>{
        const a=i*(360/8)*Math.PI/180;
        const x1=200+70*Math.sin(a), y1=200-70*Math.cos(a);
        const x2=200+150*Math.sin(a), y2=200-150*Math.cos(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="3 3"/>;
      })}
      {[...Array(12)].map((_,i)=>{
        const a=i*(360/12)*Math.PI/180;
        const x=200+110*Math.sin(a), y=200-110*Math.cos(a);
        return <polygon key={i} points={`${x},${y-6} ${x+5},${y+5} ${x-5},${y+5}`} fill="#D4AF37" opacity="0.7" transform={`rotate(${i*30},${x},${y})`}/>;
      })}
    </svg>
  );
}

export default Mandala;