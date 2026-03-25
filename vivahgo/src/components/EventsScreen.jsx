import { useState } from "react";
import { EVENT_COLORS } from "../constants";
import { DEFAULT_EVENTS } from "../data";
import { fmt } from "../utils";
import { useSwipeDown } from "../hooks/useSwipeDown";
import { useBackButtonClose } from "../hooks/useBackButtonClose";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEARS  = Array.from({length: 8}, (_, i) => 2025 + i);
const HOURS  = Array.from({length:12}, (_, i) => String(i + 1).padStart(2, "0"));
const MINS   = ["00","05","10","15","20","25","30","35","40","45","50","55"];

function parseDateStr(str) {
  const [day="", month="", year=""] = (str||"").split(" ");
  return { day, month, year };
}
function formatDateStr({ day, month, year }) {
  if (!day || !month || !year) return [day, month, year].filter(Boolean).join(" ");
  return `${day} ${month} ${year}`;
}
function parseTimeParts(str) {
  const m = (str||"").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) return { timeH: m[1].padStart(2,"0"), timeM: m[2], timeP: m[3].toUpperCase() };
  return { timeH: "", timeM: "", timeP: "AM" };
}
function buildTimeStr(timeH, timeM, timeP) {
  return timeH && timeM ? timeH + ":" + timeM + " " + timeP : "";
}

function EventsScreen({ events, setEvents, expenses, setExpenses, onOpenBudget, initialEditingEventId, planId }) {
  const [editing, setEditing] = useState(() => {
    const initialEvent = events.find(event => String(event.id) === String(initialEditingEventId));
    return initialEvent ? { ...initialEvent, ...parseTimeParts(initialEvent.time) } : null;
  });
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "✨", date: "", timeH: "", timeM: "", timeP: "AM", venue: "", status: "upcoming", note: "" });
  const editingSwipe = useSwipeDown(() => { setEditing(null); setConfirmDelete(false); });

  function resetAddForm() {
    setForm({ name: "", emoji: "✨", date: "", timeH: "", timeM: "", timeP: "AM", venue: "", status: "upcoming", note: "" });
  }

  function closeAddModal() {
    setShowAdd(false);
    setSelectedPreset("");
    resetAddForm();
  }

  const addSwipe = useSwipeDown(() => closeAddModal());

  useBackButtonClose(Boolean(editing), () => { setEditing(null); setConfirmDelete(false); });
  useBackButtonClose(showAdd, closeAddModal);

  const usedNames = new Set(events.map(e => e.name));
  const availablePresets = DEFAULT_EVENTS.filter(e => !usedNames.has(e.name));

  function handlePresetChange(val) {
    setSelectedPreset(val);
    if (val === "__other__") {
      setForm(f => ({ ...f, name: "", emoji: "✨" }));
    } else if (val) {
      const preset = DEFAULT_EVENTS.find(e => e.name === val);
      if (preset) setForm(f => ({ ...f, name: preset.name, emoji: preset.emoji }));
    } else {
      setForm(f => ({ ...f, name: "", emoji: "✨" }));
    }
  }

  function save() {
    const { timeH, timeM, timeP, ...rest } = editing;
    setEvents(evs => evs.map(e => e.id === editing.id ? { ...rest, time: buildTimeStr(timeH, timeM, timeP) } : e));
    setEditing(null);
  }

  function deleteEvent(id) {
    setEvents(evs => evs.filter(e => e.id !== id));
    if (setExpenses) {
      setExpenses(exps => exps.filter(ex => !(ex.area === "ceremony" && String(ex.eventId) === String(id))));
    }
    setEditing(null);
    setConfirmDelete(false);
  }

  function handleDeleteClick() {
    if (getEventSpend(editing.id) > 0) {
      setConfirmDelete(true);
    } else {
      deleteEvent(editing.id);
    }
  }

  function addEvent() {
    if (!form.name.trim()) {
      return;
    }

    const preset = DEFAULT_EVENTS.find(e => e.name === form.name);
    const { timeH, timeM, timeP, ...rest } = form;
    setEvents(evs => [
      ...evs,
      {
        ...rest,
        time: buildTimeStr(timeH, timeM, timeP),
        id: Date.now(),
        planId,
        colorIdx: preset ? preset.colorIdx : evs.length % EVENT_COLORS.length,
      },
    ]);
    resetAddForm();
    setSelectedPreset("");
    setShowAdd(false);
  }

  function getEventSpend(eventId) {
    return expenses
      .filter(expense => expense.area === "ceremony" && String(expense.eventId) === String(eventId))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  }

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Wedding Ceremonies</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="section-action" onClick={onOpenBudget}>Budget</button>
          <button className="section-action" style={{color:"var(--color-gold-dark)"}} onClick={() => window.open("/wedding", "_blank", "noopener,noreferrer")} title="Preview your wedding website">🌐 Website</button>
          <button className="section-action guest-section-add" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </div>
      {events.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
          <div className="card-title" style={{ marginBottom: 8 }}>No ceremonies yet</div>
          <div className="card-sub" style={{ marginBottom: 16 }}>Add your first event to start building the wedding timeline.</div>
          <button className="btn-primary" style={{ width: "auto", padding: "10px 22px", marginTop: 0 }} onClick={() => setShowAdd(true)}>
            Add Ceremony
          </button>
        </div>
      ) : (
        <div className="event-grid">
          {events.map(ev=>{
            const eventSpend = getEventSpend(ev.id);
            return (
            <div key={ev.id} className="event-card"
              style={{background:`linear-gradient(150deg, ${EVENT_COLORS[ev.colorIdx % EVENT_COLORS.length][0]}, ${EVENT_COLORS[ev.colorIdx % EVENT_COLORS.length][1]})`}}
              onClick={()=>setEditing({...ev, ...parseTimeParts(ev.time)})}>  
              <div>
                <div className="event-emoji">{ev.emoji}</div>
                <div className="event-name">{ev.name}</div>
                <div className="event-date">{ev.date||"Date not set"}</div>
                <div className="event-spend">{eventSpend ? `${fmt(eventSpend)} linked` : "No linked expenses"}</div>
              </div>
              <div>
                <div className="event-status">{ev.status}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.65)",marginTop:4}}>{ev.venue||"Venue TBD"}</div>
              </div>
            </div>
          );})}
        </div>
      )}
      {editing && (
        <div className="modal-overlay" onClick={()=>setEditing(null)}>
          <div className="modal" {...editingSwipe.modalProps} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{editing.emoji} {editing.name}</div>
            <div style={{marginBottom:16,padding:"10px 12px",background:"rgba(139,26,26,0.05)",borderRadius:12,color:"var(--color-mid-text)",fontSize:13}}>
              Linked ceremony spend: <strong style={{color:"var(--color-crimson)"}}>{fmt(getEventSpend(editing.id))}</strong>
            </div>
            <div className="input-group">
              <div className="input-label">Date</div>
              <div style={{display:"flex",gap:6}}>
                {(()=>{ const p=parseDateStr(editing.date); return (<>
                  <select className="select-field" style={{flex:1}} value={p.day} onChange={e=>setEditing({...editing,date:formatDateStr({...p,day:e.target.value})})}>
                    <option value="">Day</option>
                    {Array.from({length:31},(_,i)=>String(i+1)).map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                  <select className="select-field" style={{flex:2}} value={p.month} onChange={e=>setEditing({...editing,date:formatDateStr({...p,month:e.target.value})})}>
                    <option value="">Month</option>
                    {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="select-field" style={{flex:2}} value={p.year} onChange={e=>setEditing({...editing,date:formatDateStr({...p,year:e.target.value})})}>
                    <option value="">Year</option>
                    {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </>); })()}
              </div>
            </div>
            <div className="input-group">
              <div className="input-label">Time</div>
              <div style={{display:"flex",gap:6}}>
                <select className="select-field" style={{flex:2}} value={editing.timeH||""} onChange={e=>setEditing({...editing,timeH:e.target.value})}>
                  <option value="">Hour</option>
                  {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
                <select className="select-field" style={{flex:2}} value={editing.timeM||""} onChange={e=>setEditing({...editing,timeM:e.target.value})}>
                  <option value="">Min</option>
                  {MINS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                <select className="select-field" style={{flex:1}} value={editing.timeP||"AM"} onChange={e=>setEditing({...editing,timeP:e.target.value})}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
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
            <button className="btn-primary btn-gold" onClick={onOpenBudget}>View Linked Budget</button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save Ceremony Details</button>
            {!confirmDelete ? (
              <button
                className="btn-secondary-danger"
                onClick={handleDeleteClick}
                style={{ marginTop: 6 }}
              >
                Delete Event
              </button>
            ) : (
              <div style={{
                marginTop: 8,
                background: "rgba(185,28,28,0.06)",
                border: "1.5px solid rgba(185,28,28,0.25)",
                borderRadius: 12,
                padding: "14px 16px",
              }}>
                <p style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5, marginTop: 0, marginBottom: 14 }}>
                  This event has <strong>{fmt(getEventSpend(editing.id))}</strong> in linked expenses. Deleting it will also remove those expense records. This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 9,
                      border: "1px solid rgba(139,26,26,0.2)",
                      background: "transparent",
                      color: "var(--color-light-text)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Keep Event
                  </button>
                  <button
                    onClick={() => deleteEvent(editing.id)}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 9,
                      border: "none",
                      background: "#b91c1c",
                      color: "white",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal" {...addSwipe.modalProps} onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Add Ceremony ✨</div>
            <div className="input-group">
              <div className="input-label">Ceremony</div>
              <select className="select-field" value={selectedPreset} onChange={e => handlePresetChange(e.target.value)}>
                <option value="">Select ceremony…</option>
                {availablePresets.map(p => (
                  <option key={p.id} value={p.name}>{p.emoji} {p.name}</option>
                ))}
                <option value="__other__">Other…</option>
              </select>
            </div>
            {selectedPreset === "__other__" && (
              <>
                <div className="input-group">
                  <div className="input-label">Name</div>
                  <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engagement" />
                </div>
                <div className="input-group">
                  <div className="input-label">Emoji</div>
                  <input className="input-field" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value || '✨' })} placeholder="e.g. 💍" />
                </div>
              </>
            )}
            {selectedPreset && (
              <>
                <div className="input-group">
                  <div className="input-label">Date</div>
                  <div style={{display:"flex",gap:6}}>
                    {(()=>{ const p=parseDateStr(form.date); return (<>
                      <select className="select-field" style={{flex:1}} value={p.day} onChange={e=>setForm({...form,date:formatDateStr({...p,day:e.target.value})})}>
                        <option value="">Day</option>
                        {Array.from({length:31},(_,i)=>String(i+1)).map(d=><option key={d} value={d}>{d}</option>)}
                      </select>
                      <select className="select-field" style={{flex:2}} value={p.month} onChange={e=>setForm({...form,date:formatDateStr({...p,month:e.target.value})})}>
                        <option value="">Month</option>
                        {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
                      </select>
                      <select className="select-field" style={{flex:2}} value={p.year} onChange={e=>setForm({...form,date:formatDateStr({...p,year:e.target.value})})}>
                        <option value="">Year</option>
                        {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                      </select>
                    </>); })()}
                  </div>
                </div>
                <div className="input-group">
                  <div className="input-label">Time</div>
                  <div style={{display:"flex",gap:6}}>
                    <select className="select-field" style={{flex:2}} value={form.timeH} onChange={e=>setForm({...form,timeH:e.target.value})}>
                      <option value="">Hour</option>
                      {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                    <select className="select-field" style={{flex:2}} value={form.timeM} onChange={e=>setForm({...form,timeM:e.target.value})}>
                      <option value="">Min</option>
                      {MINS.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className="select-field" style={{flex:1}} value={form.timeP} onChange={e=>setForm({...form,timeP:e.target.value})}>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <div className="input-label">Venue</div>
                  <input className="input-field" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} placeholder="Enter venue" />
                </div>
                <div className="input-group">
                  <div className="input-label">Status</div>
                  <select className="select-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="upcoming">Upcoming</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="input-group">
                  <div className="input-label">Notes</div>
                  <input className="input-field" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Special notes" />
                </div>
                <button className="btn-secondary" onClick={closeAddModal}>Cancel</button>
                <button className="btn-primary" onClick={addEvent}>Add Ceremony</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsScreen;