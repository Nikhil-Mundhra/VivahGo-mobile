import { EVENT_COLORS } from "../constants";
import { BUDGET_CATEGORIES } from "../data";
import { daysUntil, fmt } from "../utils";

function Dashboard({ wedding, events, expenses, guests, budget }) {
  const days = daysUntil(wedding.date);
  const totalSpent = expenses.reduce((s,e)=>s+Number(e.amount||0), 0);
  const totalBudget = Number((wedding.budget||"0").replace(/[^0-9]/g,""));
  const remaining = totalBudget - totalSpent;
  const yesCount = guests.filter(g=>g.rsvp==="yes").length;

  let d=0,h=0,m=0;
  if(days>0){d=days; h=0; m=0;}

  return (
    <div>
      {/* Countdown */}
      {days !== null && (
        <div className="dash-countdown">
          <div className="countdown-unit"><div className="countdown-num">{d}</div><div className="countdown-label">Days</div></div>
          <div className="countdown-sep">:</div>
          <div className="countdown-unit"><div className="countdown-num">{h.toString().padStart(2,"0")}</div><div className="countdown-label">Hours</div></div>
          <div className="countdown-sep">:</div>
          <div className="countdown-unit"><div className="countdown-num">{m.toString().padStart(2,"0")}</div><div className="countdown-label">Mins</div></div>
          <div style={{position:"absolute",top:16,right:20,textAlign:"right"}}>
            <div style={{color:"rgba(255,255,255,0.5)",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Until</div>
            <div style={{color:"var(--color-gold-light)",fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700}}>Your Big Day</div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"16px 16px 0"}}>
        {[
          {label:"Budget Used",value:`${totalBudget?Math.round(totalSpent/totalBudget*100):0}%`,sub:fmt(totalSpent)+" spent",emoji:"💰"},
          {label:"Guests Confirmed",value:yesCount,sub:`of ${guests.length} invited`,emoji:"👥"},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--color-white)",borderRadius:16,padding:"14px 12px",border:"1px solid rgba(212,175,55,0.15)",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontSize:24,marginBottom:4}}>{s.emoji}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"var(--color-crimson)",lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--color-light-text)",marginTop:2}}>{s.label}</div>
            <div style={{fontSize:10.5,color:"var(--color-gold)",fontWeight:600,marginTop:1}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Upcoming Events */}
      <div className="section-head" style={{marginTop:8}}>
        <div className="section-title">Ceremonies</div>
      </div>
      <div className="scroll-h">
        {events.map((ev,i)=>(
          <div key={ev.id} className="mini-event-card" style={{background:`linear-gradient(135deg, ${EVENT_COLORS[ev.colorIdx][0]}, ${EVENT_COLORS[ev.colorIdx][1]})`}}>
            <div style={{fontSize:28}}>{ev.emoji}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700,color:"white",marginTop:6}}>{ev.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:2}}>{ev.date||"Date TBD"}</div>
            <div style={{display:"inline-block",background:"rgba(255,255,255,0.2)",borderRadius:8,padding:"2px 8px",fontSize:10,color:"white",marginTop:6,fontWeight:600}}>{ev.venue||"Venue TBD"}</div>
          </div>
        ))}
      </div>

      {/* Recent Expenses */}
      <div className="section-head" style={{marginTop:4}}>
        <div className="section-title">Recent Expenses</div>
      </div>
      {expenses.length === 0 ? (
        <div style={{textAlign:"center",padding:"20px 0",color:"var(--color-light-text)",fontSize:13}}>No expenses added yet.</div>
      ) : (
        <div className="card">
          {expenses.slice(-3).reverse().map((e,i)=>{
            const cat = BUDGET_CATEGORIES.find(c=>c.id===e.category)||BUDGET_CATEGORIES[9];
            return (
              <div className="expense-item" key={i}>
                <div className="expense-cat-dot" style={{background:cat.color+"22"}}>{cat.emoji}</div>
                <div className="expense-info">
                  <div className="expense-name">{e.name}</div>
                  <div className="expense-cat">{cat.label}</div>
                </div>
                <div className="expense-amount">{fmt(e.amount)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dashboard;