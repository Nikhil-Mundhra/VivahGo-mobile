import { useEffect, useState } from "react";
import NavIcon from "../../../components/NavIcon";
import { EVENT_COLORS } from "../../../constants";
import { BUDGET_CATEGORIES } from "../../../data";
import { daysUntil, fmt } from "../../../shared/lib/core.js";

const MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function parseCalendarDate(rawDate) {
  if (!rawDate) return null;
  const trimmed = String(rawDate).trim();
  if (!trimmed) return null;

  const native = new Date(trimmed);
  if (!Number.isNaN(native.getTime())) {
    return native;
  }

  const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthKey = match[2].slice(0, 3).toLowerCase();
  const month = MONTH_INDEX[monthKey];
  const year = Number(match[3]);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCalendarTime(rawTime) {
  if (!rawTime) return null;
  const match = String(rawTime).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  return Number.isNaN(hour) || Number.isNaN(minute) ? null : hour * 60 + minute;
}

function Dashboard({ wedding, events, expenses, guests, onTabChange, onEditEvent }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const days = daysUntil(wedding.date);
  const totalSpent = expenses.reduce((s,e)=>s+Number(e.amount||0), 0);
  const totalBudget = Number((wedding.budget||"0").replace(/[^0-9]/g,""));
  const getGuestCount = (guest) => {
    const parsed = Number(guest?.guestCount);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.round(parsed);
  };
  const totalInvited = guests.reduce((sum, guest) => sum + getGuestCount(guest), 0);
  const yesCount = guests.filter(g=>g.rsvp==="yes").reduce((sum, guest) => sum + getGuestCount(guest), 0);

  const weddingCalendar = events
    .map((event, index) => ({
      ...event,
      calendarDate: parseCalendarDate(event.date),
      calendarTime: parseCalendarTime(event.time),
      originalIndex: index,
    }))
    .sort((a, b) => {
      if (a.calendarDate && b.calendarDate) {
        const dayDiff = a.calendarDate.getTime() - b.calendarDate.getTime();
        if (dayDiff !== 0) return dayDiff;

        if (a.calendarTime !== null && b.calendarTime !== null) {
          return a.calendarTime - b.calendarTime;
        }
        if (a.calendarTime !== null) return -1;
        if (b.calendarTime !== null) return 1;
      }

      if (a.calendarDate && !b.calendarDate) return -1;
      if (!a.calendarDate && b.calendarDate) return 1;
      return a.originalIndex - b.originalIndex;
    });

  const daysLeft = Math.max(days ?? 0, 0);

  return (
    <div>
      {/* Countdown */}
      {days !== null && (
        <div className="dash-countdown">
          <div className="countdown-unit"><div className="countdown-num">{daysLeft}</div><div className="countdown-label">Days</div></div>
          <div className="countdown-meta">
            <div className="countdown-kicker">Until</div>
            <div className="countdown-title">Your Big Day</div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px"}}>
        {[
          {label:"Budget Used",value:`${totalBudget?Math.round(totalSpent/totalBudget*100):0}%`,sub:fmt(totalSpent)+" spent",icon:"budget",tab:"budget"},
          {label:"Guests Confirmed",value:yesCount,sub:`of ${totalInvited} invited`,icon:"guests",tab:"guests"},
        ].map((s,i)=>(
          (() => {
            const isPercentValue = typeof s.value === "string" && s.value.endsWith("%");
            const valueText = isPercentValue ? s.value.slice(0, -1) : s.value;
            const valueLift = s.tab === "budget" ? "translateY(-0.28em)" : "none";

            return (
          <button
            key={i}
            type="button"
            onClick={() => onTabChange?.(s.tab)}
            style={{background:"var(--color-white)",borderRadius:16,padding:"14px 12px",border:"1px solid rgba(212,175,55,0.15)",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",textAlign:"left",cursor:"pointer"}}
          >
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:22,height:22,color:"var(--color-crimson)",flexShrink:0}}>
                <NavIcon name={s.icon} size={22} />
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:"var(--color-crimson)",lineHeight:1,transform:valueLift}}>
                {isPercentValue ? (
                  <span style={{display:"inline-flex",alignItems:"baseline",lineHeight:1}}>
                    <span>{valueText}</span>
                    <span style={{lineHeight:1,display:"inline-block",transform:"translateY(0.12em)"}}>%</span>
                  </span>
                ) : (
                  s.value
                )}
              </div>
            </div>
            <div style={{fontSize:11,color:"var(--color-light-text)",marginTop:2}}>{s.label}</div>
            <div style={{fontSize:10.5,color:"var(--color-gold)",fontWeight:600,marginTop:1}}>{s.sub}</div>
          </button>
            );
          })()
        ))}
      </div>

      {/* Wedding Calendar */}
      <div className="section-head" style={{marginTop:20}}>
        <div className="section-title">Wedding Calendar</div>
      </div>
      {weddingCalendar.length === 0 ? (
        <div style={{textAlign:"center",padding:"8px 16px 0",color:"var(--color-light-text)",fontSize:13}}>No ceremonies scheduled yet.</div>
      ) : (
        <div className="card" style={{padding:"6px 0"}}>
          {weddingCalendar.map((event, i) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onEditEvent?.(event.id)}
              style={{display:"flex",gap:12,padding:"12px 16px",borderBottom:i===weddingCalendar.length-1?"none":"1px solid rgba(212,175,55,0.12)",width:"100%",background:"transparent",borderLeft:"none",borderRight:"none",borderTop:"none",textAlign:"left",cursor:"pointer"}}
            >
              <div style={{width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:"rgba(212,175,55,0.14)",flexShrink:0}}>{event.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"baseline"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:700,color:"var(--color-crimson)",lineHeight:1.1}}>{event.name}</div>
                  <div style={{fontSize:11,color:"var(--color-light-text)",whiteSpace:"nowrap"}}>{event.status}</div>
                </div>
                <div style={{fontSize:12,color:"var(--color-mid-text)",marginTop:3}}>
                  {event.date || "Date TBD"}{event.time ? ` · ${event.time}` : ""}
                </div>
                <div style={{fontSize:11,color:"var(--color-light-text)",marginTop:2}}>{event.venue || "Venue TBD"}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Recent Expenses */}
      <div className="section-head" style={{marginTop:20}}>
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
