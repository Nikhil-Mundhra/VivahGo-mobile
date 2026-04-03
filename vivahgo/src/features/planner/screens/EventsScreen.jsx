import { useState } from "react";
import { EVENT_COLORS } from "../../../constants";
import { DEFAULT_EVENTS } from "../../../data";
import { WEDDING_WEBSITE_THEMES } from "../../../plannerDefaults";
import { fmt } from "../../../shared/lib/core.js";
import { useSwipeDown } from "../../../shared/hooks/useSwipeDown.js";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";

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

const OTHER_VENUE_VALUE = "__other__";

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="website-toggle-row">
      <div style={{ flex: 1 }}>
        <div className="website-toggle-label">{label}</div>
        {description ? <div className="website-toggle-description">{description}</div> : null}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="website-toggle-input" />
      <span className="website-toggle-switch" aria-hidden="true">
        <span className="website-toggle-knob" />
      </span>
    </label>
  );
}

function EventsScreen({ events, setEvents, expenses, setExpenses, onOpenBudget, initialEditingEventId, planId, websitePath = "/wedding", websiteSettings, subscriptionTier = "starter", onSaveWebsiteSettings, defaultVenue = "", presetVenues = [] }) {
  const [editing, setEditing] = useState(() => {
    const initialEvent = events.find(event => String(event.id) === String(initialEditingEventId));
    return initialEvent ? { isPublicWebsiteVisible: true, ...initialEvent, ...parseTimeParts(initialEvent.time) } : null;
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showWebsiteModal, setShowWebsiteModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({ name: "", emoji: "✨", date: "", timeH: "", timeM: "", timeP: "AM", venue: defaultVenue || "", status: "upcoming", note: "", isPublicWebsiteVisible: true });
  const [websiteForm, setWebsiteForm] = useState(() => ({
    isActive: websiteSettings?.isActive !== false,
    showCountdown: websiteSettings?.showCountdown !== false,
    showCalendar: websiteSettings?.showCalendar !== false,
    theme: websiteSettings?.theme || "royal-maroon",
    heroTagline: websiteSettings?.heroTagline || "You are invited to celebrate",
    welcomeMessage: websiteSettings?.welcomeMessage || "",
    scheduleTitle: websiteSettings?.scheduleTitle || "Wedding Calendar",
  }));
  const editingSwipe = useSwipeDown(() => { setEditing(null); setConfirmDelete(false); });
  const websiteSwipe = useSwipeDown(() => setShowWebsiteModal(false));

  function resetAddForm() {
    setForm({ name: "", emoji: "✨", date: "", timeH: "", timeM: "", timeP: "AM", venue: defaultVenue || "", status: "upcoming", note: "", isPublicWebsiteVisible: true });
  }

  function closeAddModal() {
    setShowAdd(false);
    setSelectedPreset("");
    resetAddForm();
  }

  const addSwipe = useSwipeDown(() => closeAddModal());
  function closeWebsiteModal() {
    setShowWebsiteModal(false);
    setWebsiteForm({
      isActive: websiteSettings?.isActive !== false,
      showCountdown: websiteSettings?.showCountdown !== false,
      showCalendar: websiteSettings?.showCalendar !== false,
      theme: websiteSettings?.theme || "royal-maroon",
      heroTagline: websiteSettings?.heroTagline || "You are invited to celebrate",
      welcomeMessage: websiteSettings?.welcomeMessage || "",
      scheduleTitle: websiteSettings?.scheduleTitle || "Wedding Calendar",
    });
  }

  useBackButtonClose(Boolean(editing), () => { setEditing(null); setConfirmDelete(false); });
  useBackButtonClose(showAdd, closeAddModal);
  useBackButtonClose(showWebsiteModal, closeWebsiteModal);

  function openWebsiteModal() {
    setWebsiteForm({
      isActive: websiteSettings?.isActive !== false,
      showCountdown: websiteSettings?.showCountdown !== false,
      showCalendar: websiteSettings?.showCalendar !== false,
      theme: websiteSettings?.theme || "royal-maroon",
      heroTagline: websiteSettings?.heroTagline || "You are invited to celebrate",
      welcomeMessage: websiteSettings?.welcomeMessage || "",
      scheduleTitle: websiteSettings?.scheduleTitle || "Wedding Calendar",
    });
    setShowWebsiteModal(true);
  }

  function applyWebsiteSetting(nextPartial) {
    const next = { ...websiteForm, ...nextPartial };
    setWebsiteForm(next);
    onSaveWebsiteSettings?.(next);
  }

  const usedNames = new Set(events.map(e => e.name));
  const availablePresets = DEFAULT_EVENTS.filter(e => !usedNames.has(e.name));
  const canPersonalizeWebsite = subscriptionTier === "premium" || subscriptionTier === "studio";
  const venueOptions = Array.from(new Set([defaultVenue, ...presetVenues].filter(Boolean)));
  const addVenueSelection = venueOptions.includes(form.venue) ? form.venue : (form.venue ? OTHER_VENUE_VALUE : (defaultVenue || ""));
  const editingVenueSelection = venueOptions.includes(editing?.venue) ? editing?.venue : (editing?.venue ? OTHER_VENUE_VALUE : (defaultVenue || ""));

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
        <div className="event-section-actions">
          <button className="section-action event-section-button event-section-button-website" onClick={openWebsiteModal} title="Configure your public wedding website">Website</button>
          <button className="section-action event-section-button event-section-button-add" onClick={() => setShowAdd(true)}>+ Add</button>
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
              onClick={()=>setEditing({isPublicWebsiteVisible:true, ...ev, ...parseTimeParts(ev.time)})}>  
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
              <select
                className="select-field"
                value={editingVenueSelection}
                onChange={e=>setEditing({
                  ...editing,
                  venue: e.target.value === OTHER_VENUE_VALUE ? "" : e.target.value,
                })}
              >
                <option value="">Select location</option>
                {venueOptions.map(venue => <option key={venue} value={venue}>{venue}</option>)}
                <option value={OTHER_VENUE_VALUE}>Other</option>
              </select>
              {editingVenueSelection === OTHER_VENUE_VALUE && (
                <input
                  className="input-field"
                  value={editing.venue}
                  onChange={e=>setEditing({ ...editing, venue: e.target.value })}
                  placeholder="Enter custom location"
                  style={{ marginTop: 8 }}
                />
              )}
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
            <div className="input-group">
              <div className="input-label">Visibility</div>
              <ToggleRow
                label="Show on wedding website"
                description="Only public ceremonies appear in the website calendar."
                checked={editing.isPublicWebsiteVisible !== false}
                onChange={e=>setEditing({...editing,isPublicWebsiteVisible:e.target.checked})}
              />
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
                  <select
                    className="select-field"
                    value={addVenueSelection}
                    onChange={e => setForm({ ...form, venue: e.target.value === OTHER_VENUE_VALUE ? "" : e.target.value })}
                  >
                    <option value="">Select location</option>
                    {venueOptions.map(venue => <option key={venue} value={venue}>{venue}</option>)}
                    <option value={OTHER_VENUE_VALUE}>Other</option>
                  </select>
                  {addVenueSelection === OTHER_VENUE_VALUE && (
                    <input
                      className="input-field"
                      value={form.venue}
                      onChange={e => setForm({ ...form, venue: e.target.value })}
                      placeholder="Enter custom location"
                      style={{ marginTop: 8 }}
                    />
                  )}
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
                <div className="input-group">
                  <div className="input-label">Visibility</div>
                  <ToggleRow
                    label="Show on wedding website"
                    description="Public ceremonies appear in the website calendar."
                    checked={form.isPublicWebsiteVisible !== false}
                    onChange={e => setForm({ ...form, isPublicWebsiteVisible: e.target.checked })}
                  />
                </div>
                <button className="btn-secondary" onClick={closeAddModal}>Cancel</button>
                <button className="btn-primary" onClick={addEvent}>Add Ceremony</button>
              </>
            )}
          </div>
        </div>
      )}

      {showWebsiteModal && (
        <div className="modal-overlay" onClick={closeWebsiteModal}>
          <div className="modal" {...websiteSwipe.modalProps} onClick={e => e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Wedding Website</div>
            <div className="website-settings-card">
              <div className="website-settings-path">{websitePath}</div>
              <div className="website-settings-note">
                {websiteForm.isActive
                  ? "This public page can be opened by guests with or without login. Changes here autosave."
                  : "This website is inactive and hidden from guests right now."}
              </div>
            </div>
            <div className="input-group">
              <div className="input-label">Status</div>
              <div className="website-status-toggle" role="tablist" aria-label="Website status">
                <button
                  type="button"
                  className={`website-status-option ${websiteForm.isActive ? "active" : ""}`}
                  onClick={() => applyWebsiteSetting({ isActive: true })}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`website-status-option ${!websiteForm.isActive ? "active" : ""}`}
                  onClick={() => applyWebsiteSetting({ isActive: false })}
                >
                  Inactive
                </button>
              </div>
            </div>
            <div className="input-group">
              <div className="input-label">What to Show</div>
              <ToggleRow
                label="Countdown"
                description="Show the days remaining until the wedding date."
                checked={websiteForm.showCountdown}
                onChange={e => applyWebsiteSetting({ showCountdown: e.target.checked })}
              />
              <ToggleRow
                label="Wedding calendar"
                description="Show only ceremonies marked public in your Events list."
                checked={websiteForm.showCalendar}
                onChange={e => applyWebsiteSetting({ showCalendar: e.target.checked })}
              />
            </div>
            <div className="input-group">
              <div className="input-label">Personalization</div>
              {canPersonalizeWebsite ? (
                <>
                  <div className="website-settings-note" style={{ marginBottom: 10 }}>
                    Premium lets you personalize the guest-facing website with your own theme and copy.
                  </div>
                  <select
                    className="select-field"
                    value={websiteForm.theme}
                    onChange={e => applyWebsiteSetting({ theme: e.target.value })}
                  >
                    {WEDDING_WEBSITE_THEMES.map(theme => (
                      <option key={theme.id} value={theme.id}>{theme.name}</option>
                    ))}
                  </select>
                  <input
                    className="input-field"
                    value={websiteForm.heroTagline}
                    onChange={e => applyWebsiteSetting({ heroTagline: e.target.value })}
                    placeholder="Hero tagline"
                  />
                  <input
                    className="input-field"
                    value={websiteForm.scheduleTitle}
                    onChange={e => applyWebsiteSetting({ scheduleTitle: e.target.value })}
                    placeholder="Schedule heading"
                  />
                  <textarea
                    className="input-field"
                    value={websiteForm.welcomeMessage}
                    onChange={e => applyWebsiteSetting({ welcomeMessage: e.target.value })}
                    placeholder="Add a welcome note for your guests"
                    rows={4}
                    style={{ resize: "vertical", minHeight: 110 }}
                  />
                </>
              ) : (
                <div className="website-settings-note">
                  Upgrade to Premium to personalize your wedding website with custom messaging, section titles, and color themes.
                </div>
              )}
            </div>
            <button className="btn-secondary" onClick={closeWebsiteModal}>Cancel</button>
            {websiteForm.isActive ? (
              <button className="btn-primary" onClick={() => window.open(websitePath, "_blank", "noopener,noreferrer")}>Open</button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsScreen;
