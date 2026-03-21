import { useState } from "react";
import { initials } from "../utils";

function createGuestForm() {
  return {
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    side: "bride",
    phone: "",
    rsvp: "pending",
    guestCount: 1,
  };
}

function GuestsScreen({ guests, setGuests }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [form, setForm] = useState(createGuestForm());
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("all");

  const getGuestCount = (guest) => {
    const parsed = Number(guest?.guestCount);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.round(parsed);
  };

  const totalInvited = guests.reduce((sum, guest) => sum + getGuestCount(guest), 0);
  const yes = guests.filter(g=>g.rsvp==="yes").reduce((sum, guest) => sum + getGuestCount(guest), 0);
  const no = guests.filter(g=>g.rsvp==="no").reduce((sum, guest) => sum + getGuestCount(guest), 0);
  const pending = guests.filter(g=>g.rsvp==="pending").reduce((sum, guest) => sum + getGuestCount(guest), 0);

  const getDisplayName = (guest) => {
    const fullName = [guest?.title, guest?.firstName, guest?.middleName, guest?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return fullName || guest?.name || "";
  };

  const getSortableLastName = (guest) => {
    if (guest?.lastName) {
      return guest.lastName.trim();
    }
    const fallback = (guest?.name || "").trim().split(/\s+/).filter(Boolean);
    return fallback.length ? fallback[fallback.length - 1] : "";
  };

  function openAddGuest() {
    setEditingGuestId(null);
    setForm(createGuestForm());
    setShowEditor(true);
  }

  function openEditGuest(guest) {
    setEditingGuestId(guest.id);
    setForm({
      title: guest.title || "",
      firstName: guest.firstName || "",
      middleName: guest.middleName || "",
      lastName: guest.lastName || "",
      side: guest.side || "bride",
      phone: guest.phone || "",
      rsvp: guest.rsvp || "pending",
      guestCount: getGuestCount(guest),
    });
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingGuestId(null);
    setForm(createGuestForm());
  }

  function saveGuest() {
    if(!form.firstName || !form.lastName) return;
    const guestCount = Math.max(1, parseInt(form.guestCount, 10) || 1);
    const nextGuest = {
      ...form,
      id: editingGuestId ?? Date.now(),
      guestCount,
      name: [form.title, form.firstName, form.middleName, form.lastName].filter(Boolean).join(" "),
    };

    if (editingGuestId !== null) {
      setGuests(current => current.map(guest => guest.id === editingGuestId ? nextGuest : guest));
    } else {
      setGuests(current => [...current, nextGuest]);
    }

    closeEditor();
  }

  function deleteGuest(id) {
    setGuests(current => current.filter(guest => guest.id !== id));
  }

  function sendWhatsAppReminder(guest) {
    const phone = String(guest?.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;

    const guestName = getDisplayName(guest) || "there";
    const message = encodeURIComponent(`Hi ${guestName}, this is a friendly reminder for our wedding events. Please share your RSVP update. Thank you!`);
    const url = `https://api.whatsapp.com/send/?phone=${phone}&text=${message}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function cycleRSVP(id) {
    setGuests(gs=>gs.map(g=>g.id===id?{...g,rsvp:g.rsvp==="pending"?"yes":g.rsvp==="yes"?"no":"pending"}:g));
  }

  const filtered = guests
    .filter(g=>getDisplayName(g).toLowerCase().includes(search.toLowerCase()))
    .filter(g=>sideFilter === "all" ? true : g.side === sideFilter)
    .sort((a, b) => {
      const aLast = getSortableLastName(a);
      const bLast = getSortableLastName(b);
      const byLast = aLast.localeCompare(bLast, undefined, { sensitivity: "base" });
      if (byLast !== 0) {
        return byLast;
      }
      return getDisplayName(a).localeCompare(getDisplayName(b), undefined, { sensitivity: "base" });
    });

  return (
    <div>
      {/* Stats */}
      <div className="guest-stats">
        <div className="guest-stat">
          <div className="guest-stat-num" style={{color:"var(--color-crimson)"}}>{totalInvited}</div>
          <div className="guest-stat-label">Invited</div>
        </div>
        <div className="guest-stat">
          <div className="guest-stat-num" style={{color:"#2E7D32"}}>{yes}</div>
          <div className="guest-stat-label">Confirmed</div>
        </div>
        <div className="guest-stat">
          <div className="guest-stat-num" style={{color:"#C62828"}}>{no}</div>
          <div className="guest-stat-label">Declined</div>
        </div>
        <div className="guest-stat">
          <div className="guest-stat-num" style={{color:"#F57F17"}}>{pending}</div>
          <div className="guest-stat-label">Pending</div>
        </div>
      </div>

      {/* Search */}
      <div style={{padding:"0 16px 12px"}}>
        <input
          className="input-field"
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="🔍  Search guests..."
          style={{borderRadius:24}}
        />
      </div>

      <div className="section-head" style={{paddingTop:0}}>
        <div className="section-title">Guest List</div>
        <button className="section-action guest-section-add" onClick={openAddGuest}>+ Add</button>
      </div>

      <div className="vendor-tabs" style={{paddingBottom:12}}>
        {[
          { id: "all", label: "All" },
          { id: "bride", label: "Bride Side" },
          { id: "groom", label: "Groom Side" },
        ].map(option => (
          <button
            key={option.id}
            className={`vendor-tab${sideFilter===option.id?" active":""}`}
            onClick={() => setSideFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{background:"var(--color-white)",borderRadius:16,margin:"0 16px",border:"1px solid rgba(212,175,55,0.15)"}}>
        {filtered.length === 0 ? (
          <div style={{textAlign:"center",padding:"30px",color:"var(--color-light-text)",fontSize:13}}>
            {guests.length===0?"No guests added yet.":"No results found."}
          </div>
        ) : filtered.map(g=>(
          <div className="guest-item" key={g.id} onClick={() => openEditGuest(g)}>
            <div className="guest-avatar">{initials(getDisplayName(g))}</div>
            <div className="guest-info">
              <div className="guest-name">{getDisplayName(g)}</div>
              <div className="guest-side">
                {g.side==="bride"?"Bride's side":"Groom's side"}
                {` · ${getGuestCount(g)} guest${getGuestCount(g) > 1 ? "s" : ""}`}
                {g.phone?` · ${g.phone}`:""}
              </div>
            </div>
            <div className="guest-actions">
              {g.phone && (
                <button
                  type="button"
                  className="whatsapp-reminder-btn"
                  aria-label="Send WhatsApp reminder"
                  title="Send WhatsApp reminder"
                  onClick={(event) => {
                    event.stopPropagation();
                    sendWhatsAppReminder(g);
                  }}
                >
                  <svg viewBox="0 0 32 32" className="whatsapp-icon" aria-hidden="true" focusable="false">
                    <path fill="currentColor" d="M16.004 3.2a12.8 12.8 0 0 0-10.93 19.45L3.2 28.8l6.31-1.84A12.8 12.8 0 1 0 16.004 3.2Zm0 23.39a10.54 10.54 0 0 1-5.36-1.47l-.38-.22-3.75 1.09 1.1-3.65-.25-.38a10.59 10.59 0 1 1 8.65 4.62Zm5.8-7.93c-.32-.16-1.89-.93-2.18-1.03-.29-.11-.5-.16-.71.16-.2.32-.79 1.03-.97 1.25-.18.21-.36.24-.68.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.6-1.9-1.79-2.23-.19-.32-.02-.49.14-.65.14-.14.32-.36.48-.53.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.98-2.34-.26-.62-.52-.54-.71-.55h-.61c-.21 0-.55.08-.84.4-.29.32-1.1 1.07-1.1 2.61 0 1.54 1.12 3.02 1.27 3.23.16.21 2.2 3.36 5.34 4.71.75.32 1.33.51 1.79.66.75.24 1.43.21 1.97.12.6-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"/>
                  </svg>
                </button>
              )}
              <div className={`rsvp-badge rsvp-${g.rsvp}`} onClick={(event)=>{event.stopPropagation(); cycleRSVP(g.id);}} style={{cursor:"pointer"}}>
                {g.rsvp==="yes"?"✓ Yes":g.rsvp==="no"?"✗ No":"Pending"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showEditor && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{editingGuestId !== null ? "Edit Guest 👤" : "Add Guest 👥"}</div>
            <div className="input-group">
              <div className="input-label">Name Details</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr 1.2fr 1.4fr",gap:8}}>
                <input className="input-field" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title"/>
                <input className="input-field" value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})} placeholder="First"/>
                <input className="input-field" value={form.middleName} onChange={e=>setForm({...form,middleName:e.target.value})} placeholder="Middle"/>
                <input className="input-field" value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})} placeholder="Last"/>
              </div>
            </div>
            <div className="input-group">
              <div className="input-label">Side</div>
              <select className="select-field" value={form.side} onChange={e=>setForm({...form,side:e.target.value})}>
                <option value="bride">Bride's Side</option>
                <option value="groom">Groom's Side</option>
              </select>
            </div>
            <div className="input-group">
              <div className="input-label">No. of Guests</div>
              <input
                className="input-field"
                type="number"
                min="1"
                value={form.guestCount}
                onChange={e=>setForm({...form,guestCount:e.target.value})}
                placeholder="1"
              />
            </div>
            <div className="input-group">
              <div className="input-label">Phone (optional)</div>
              <input className="input-field" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+91..."/>
            </div>
            <div className="input-group">
              <div className="input-label">RSVP Status</div>
              <select className="select-field" value={form.rsvp} onChange={e=>setForm({...form,rsvp:e.target.value})}>
                <option value="pending">Pending</option>
                <option value="yes">Confirmed</option>
                <option value="no">Declined</option>
              </select>
            </div>
            {editingGuestId !== null && form.phone && (
              <button
                className="btn-primary btn-gold"
                onClick={() => sendWhatsAppReminder({ ...form, id: editingGuestId, name: [form.title, form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ") })}
              >
                Send WhatsApp Reminder
              </button>
            )}
            {editingGuestId !== null && (
              <button className="btn-secondary-danger" onClick={() => { deleteGuest(editingGuestId); closeEditor(); }}>
                Delete Guest
              </button>
            )}
            <button className="btn-primary" onClick={saveGuest}>{editingGuestId !== null ? "Save Guest" : "Add Guest"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestsScreen;