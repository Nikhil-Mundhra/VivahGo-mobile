import { useState } from "react";
import { EVENT_COLORS } from "../constants";

function EventsScreen({ events, setEvents }) {
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);

  function save() {
    setEvents(evs=>evs.map(e=>e.id===editing.id?editing:e));
    setEditing(null);
    setSelected(null);
  }

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Wedding Ceremonies</div>
      </div>
      <div className="event-grid">
        {events.map(ev=>(
          <div key={ev.id} className="event-card"
            style={{background:`linear-gradient(150deg, ${EVENT_COLORS[ev.colorIdx][0]}, ${EVENT_COLORS[ev.colorIdx][1]})`}}
            onClick={()=>{setSelected(ev);setEditing({...ev});}}>
            <div>
              <div className="event-emoji">{ev.emoji}</div>
              <div className="event-name">{ev.name}</div>
              <div className="event-date">{ev.date||"Date not set"}</div>
            </div>
            <div>
              <div className="event-status">{ev.status}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginTop:4}}>{ev.venue||"Venue TBD"}</div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={()=>setEditing(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{editing.emoji} {editing.name}</div>
            <div className="input-group">
              <div className="input-label">Date</div>
              <input className="input-field" value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})} placeholder="e.g. 25 Nov 2025"/>
            </div>
            <div className="input-group">
              <div className="input-label">Time</div>
              <input className="input-field" value={editing.time} onChange={e=>setEditing({...editing,time:e.target.value})} placeholder="e.g. 10:00 AM"/>
            </div>
            <div className="input-group">
              <div className="input-label">Venue</div>
              <input className="input-field" value={editing.venue} onChange={e=>setEditing({...editing,venue:e.target.value})} placeholder="Enter venue name"/>
            </div>
            <div className="input-group">
              <div className="input-label">Status</div>
              <select className="select-field" value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>
                <option value="upcoming">Upcoming</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="input-group">
              <div className="input-label">Notes</div>
              <input className="input-field" value={editing.note} onChange={e=>setEditing({...editing,note:e.target.value})} placeholder="Any special notes..."/>
            </div>
            <button className="btn-primary" onClick={save}>Save Ceremony Details</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsScreen;