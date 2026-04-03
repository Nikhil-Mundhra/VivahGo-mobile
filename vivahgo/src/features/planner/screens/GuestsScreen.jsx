import { useState } from "react";
import { createGuestRsvpLink } from "../api.js";
import { initials } from "../../../shared/lib/core.js";
import { useSwipeDown } from "../../../shared/hooks/useSwipeDown.js";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";

const DEFAULT_BULK_MESSAGE = "Dear *{name}*,\n\nWe would be delighted to have you join us as we celebrate our wedding. Please kindly RSVP yourself and your family at your earliest convenience using the link below:\n\n{rsvp_link}\n\nWe look forward to celebrating with you!\n\n{couple}";


const GUEST_TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "shri", "smt", "km", "kum"]);

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
    groupMembers: [],
  };
}

function buildGroupMemberFields(guestCount, existingMembers = []) {
  const totalFields = Math.max(0, (parseInt(guestCount, 10) || 1) - 1);
  return Array.from({ length: totalFields }, (_, index) => String(existingMembers[index] || ""));
}

function normalizeGroupMembersForSave(groupMembers, guestCount) {
  return buildGroupMemberFields(guestCount, groupMembers)
    .map((member) => member.trim())
    .filter(Boolean);
}

function getGuestNameParts(guest) {
  const nameTokens = String(guest?.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let fallbackTitle = "";

  if (nameTokens.length) {
    const normalizedToken = nameTokens[0].replace(/\./g, "").toLowerCase();
    if (GUEST_TITLES.has(normalizedToken)) {
      fallbackTitle = nameTokens.shift();
    }
  }

  if (nameTokens.length === 0) {
    return { title: fallbackTitle, firstName: "", middleName: "", lastName: "" };
  }

  if (nameTokens.length === 1) {
    return { title: fallbackTitle, firstName: nameTokens[0], middleName: "", lastName: "" };
  }

  return {
    title: fallbackTitle,
    firstName: nameTokens[0],
    middleName: nameTokens.slice(1, -1).join(" "),
    lastName: nameTokens[nameTokens.length - 1],
  };
}

function GuestsScreen({ guests, setGuests, planId, authToken, plannerOwnerId }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [form, setForm] = useState(createGuestForm());
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("all");
  const [rsvpFilter, setRsvpFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState(DEFAULT_BULK_MESSAGE);
  const [bulkSentIds, setBulkSentIds] = useState(new Set());
  const [copySuccess, setCopySuccess] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState("");
  const [showGroupMembersForm, setShowGroupMembersForm] = useState(false);

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
    setFormError("");
    setShowGroupMembersForm(false);
    setShowEditor(true);
  }

  function openEditGuest(guest) {
    const parsedName = getGuestNameParts(guest);

    setEditingGuestId(guest.id);
    setForm({
      title: guest.title || parsedName.title,
      firstName: guest.firstName || parsedName.firstName,
      middleName: guest.middleName || parsedName.middleName,
      lastName: guest.lastName || parsedName.lastName,
      side: guest.side || "bride",
      phone: guest.phone || "",
      rsvp: guest.rsvp || "pending",
      guestCount: getGuestCount(guest),
      groupMembers: buildGroupMemberFields(getGuestCount(guest), guest.groupMembers),
    });
    setFormError("");
    setShowGroupMembersForm(Array.isArray(guest.groupMembers) && guest.groupMembers.some(Boolean));
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingGuestId(null);
    setForm(createGuestForm());
    setFormError("");
    setShowGroupMembersForm(false);
  }

  const guestSwipe = useSwipeDown(() => closeEditor());

  useBackButtonClose(showEditor, closeEditor);

  function saveGuest() {
    const title = form.title.trim();
    const firstName = form.firstName.trim();
    const middleName = form.middleName.trim();
    const lastName = form.lastName.trim();

    if (!firstName && !lastName) {
      setFormError("Please enter at least a first or last name.");
      return;
    }

    setFormError("");
    const guestCount = Math.max(1, parseInt(form.guestCount, 10) || 1);
    const nextGuest = {
      ...form,
      title,
      firstName,
      middleName,
      lastName,
      id: editingGuestId ?? Date.now(),
      guestCount,
      groupMembers: normalizeGroupMembersForSave(form.groupMembers, guestCount),
      planId,
      name: [title, firstName, middleName, lastName].filter(Boolean).join(" "),
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

  async function createRsvpLinkForGuest(guest) {
    if (!authToken) {
      throw new Error("Sign in is required to send RSVP links.");
    }

    const result = await createGuestRsvpLink(authToken, {
      guestId: guest.id,
      planId,
      plannerOwnerId,
    });

    return {
      rsvpUrl: result?.rsvpUrl || "",
      coupleName: result?.coupleName || "our wedding",
    };
  }

  async function sendWhatsAppReminder(guest) {
    const phone = String(guest?.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;

    try {
      setWhatsAppError("");
      const guestName = getDisplayName(guest) || "there";
      const { rsvpUrl, coupleName } = await createRsvpLinkForGuest(guest);
      const message = encodeURIComponent(`Dear *${guestName}*,\n\nWe would be delighted to have you join us as we celebrate our wedding. Please kindly RSVP yourself and your family at your earliest convenience using the link below:\n\n${rsvpUrl}\n\nWe look forward to celebrating with you!\n\n${coupleName}`);
      const url = `https://api.whatsapp.com/send/?phone=${phone}&text=${message}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setWhatsAppError(error.message || "Could not create an RSVP link for WhatsApp.");
    }
  }

  async function sendBulkWhatsApp(guest) {
    const phone = String(guest?.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return;
    try {
      setWhatsAppError("");
      const guestName = getDisplayName(guest) || "there";
      const { rsvpUrl, coupleName } = await createRsvpLinkForGuest(guest);
      const personalized = bulkMessage
        .replace(/\{name\}/gi, guestName)
        .replace(/\{couple\}/gi, coupleName)
        .replace(/\{rsvp_link\}/gi, rsvpUrl);
      const finalMessage = personalized.includes(rsvpUrl) ? personalized : `${personalized} ${rsvpUrl}`;
      const url = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(finalMessage)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setBulkSentIds(prev => new Set([...prev, guest.id]));
    } catch (error) {
      setWhatsAppError(error.message || "Could not create an RSVP link for WhatsApp.");
    }
  }

  function copyAllNumbers(pendingGuests) {
    const numbers = pendingGuests.map(g => String(g.phone || "").trim()).filter(Boolean).join(", ");
    if (!numbers) return;
    navigator.clipboard.writeText(numbers).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  function openBulkModal() {
    setBulkMessage(DEFAULT_BULK_MESSAGE);
    setBulkSentIds(new Set());
    setCopySuccess(false);
    setWhatsAppError("");
    setShowBulkModal(true);
  }

  function closeBulkModal() {
    setShowBulkModal(false);
    setBulkSentIds(new Set());
    setCopySuccess(false);
    setWhatsAppError("");
  }

  const bulkSwipe = useSwipeDown(() => closeBulkModal());

  useBackButtonClose(showBulkModal, closeBulkModal);

  function cycleRSVP(id) {
    setGuests(gs=>gs.map(g=>g.id===id?{...g,rsvp:g.rsvp==="pending"?"yes":g.rsvp==="yes"?"no":"pending"}:g));
  }

  function updateGuestCountInput(value) {
    setForm((current) => {
      const nextGuestCount = value;
      const nextGroupMembers = buildGroupMemberFields(nextGuestCount, current.groupMembers);
      return {
        ...current,
        guestCount: nextGuestCount,
        groupMembers: nextGroupMembers,
      };
    });

    if ((parseInt(value, 10) || 1) <= 1) {
      setShowGroupMembersForm(false);
    }
  }

  function updateGroupMemberName(index, value) {
    setForm((current) => ({
      ...current,
      groupMembers: current.groupMembers.map((member, memberIndex) => memberIndex === index ? value : member),
    }));
  }

  const filtered = guests
    .filter(g=>getDisplayName(g).toLowerCase().includes(search.toLowerCase()))
    .filter(g=>sideFilter === "all" ? true : g.side === sideFilter)
    .filter(g=>rsvpFilter === null ? true : rsvpFilter === "invited" ? true : g.rsvp === rsvpFilter)
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
        <div
          className="guest-stat"
          onClick={() => setRsvpFilter(f => f === "invited" ? null : "invited")}
          style={{cursor:"pointer", outline: rsvpFilter==="invited" ? "2px solid var(--color-crimson)" : "none", borderRadius:12}}
        >
          <div className="guest-stat-num" style={{color:"var(--color-crimson)"}}>{totalInvited}</div>
          <div className="guest-stat-label">Invited</div>
        </div>
        <div
          className="guest-stat"
          onClick={() => setRsvpFilter(f => f === "yes" ? null : "yes")}
          style={{cursor:"pointer", outline: rsvpFilter==="yes" ? "2px solid #2E7D32" : "none", borderRadius:12}}
        >
          <div className="guest-stat-num" style={{color:"#2E7D32"}}>{yes}</div>
          <div className="guest-stat-label">Confirmed</div>
        </div>
        <div
          className="guest-stat"
          onClick={() => setRsvpFilter(f => f === "no" ? null : "no")}
          style={{cursor:"pointer", outline: rsvpFilter==="no" ? "2px solid #C62828" : "none", borderRadius:12}}
        >
          <div className="guest-stat-num" style={{color:"#C62828"}}>{no}</div>
          <div className="guest-stat-label">Declined</div>
        </div>
        <div
          className="guest-stat"
          onClick={() => setRsvpFilter(f => f === "pending" ? null : "pending")}
          style={{cursor:"pointer", outline: rsvpFilter==="pending" ? "2px solid #F57F17" : "none", borderRadius:12}}
        >
          <div className="guest-stat-num" style={{color:"#F57F17"}}>{pending}</div>
          <div className="guest-stat-label">Pending</div>
        </div>
      </div>

      {/* Search */}
      <div style={{padding:"0 16px 12px"}}>
        {whatsAppError ? (
          <div style={{marginBottom:12,color:"#B3261E",fontSize:13,fontWeight:600}}>
            {whatsAppError}
          </div>
        ) : null}
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
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {guests.some(g => g.rsvp === "pending" && g.phone) && (
            <button
              className="section-action bulk-whatsapp-btn"
              onClick={openBulkModal}
              title="Send bulk WhatsApp reminders to pending guests"
            >
              📲 Bulk Message
            </button>
          )}
          <button className="section-action guest-section-add" onClick={openAddGuest}>+ Add</button>
        </div>
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
          <div className="modal" {...guestSwipe.modalProps} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">{editingGuestId !== null ? "Edit Guest 👤" : "Add Guest 👥"}</div>
            <div className="input-group">
              <div className="input-label">Name Details</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr 1.2fr 1.4fr",gap:8}}>
                <input className="input-field" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title"/>
                <input className="input-field" value={form.firstName} onChange={e=>{setForm({...form,firstName:e.target.value});setFormError("");}} placeholder="First"/>
                <input className="input-field" value={form.middleName} onChange={e=>setForm({...form,middleName:e.target.value})} placeholder="Middle"/>
                <input className="input-field" value={form.lastName} onChange={e=>{setForm({...form,lastName:e.target.value});setFormError("");}} placeholder="Last"/>
              </div>
              {formError && (
                <div style={{marginTop:6,padding:"8px 12px",background:"rgba(196,30,58,0.07)",border:"1px solid rgba(196,30,58,0.2)",borderRadius:10,color:"var(--color-bright-red)",fontSize:12.5}}>
                  {formError}
                </div>
              )}
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
                onChange={e=>updateGuestCountInput(e.target.value)}
                placeholder="1"
              />
            </div>
            {(parseInt(form.guestCount, 10) || 1) > 1 && (
              <div className="input-group" style={{ marginTop: -4 }}>
                <button
                  type="button"
                  onClick={() => setShowGroupMembersForm((current) => !current)}
                  aria-expanded={showGroupMembersForm}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    color: "var(--color-light-text)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{showGroupMembersForm ? "▾" : "▸"}</span>
                  <span>{showGroupMembersForm ? "Hide Additional Guest Names" : "Add Individual Guest Names"}</span>
                </button>
                {showGroupMembersForm && (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {form.groupMembers.map((member, index) => (
                      <input
                        key={`group-member-${index}`}
                        className="input-field"
                        value={member}
                        onChange={(event) => updateGroupMemberName(index, event.target.value)}
                        placeholder={`Guest ${index + 2} name`}
                      />
                    ))}
                    <div style={{ fontSize: 12, color: "var(--color-light-text)", lineHeight: 1.5 }}>
                      Add names for the rest of this guest group if you want to keep them on the invitation record.
                    </div>
                  </div>
                )}
              </div>
            )}
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
            <button className="btn-secondary" onClick={closeEditor}>Cancel</button>
            <button className="btn-primary" onClick={saveGuest}>{editingGuestId !== null ? "Save Guest" : "Add Guest"}</button>
          </div>
        </div>
      )}

      {showBulkModal && (() => {
        const pendingWithPhone = guests.filter(g => g.rsvp === "pending" && g.phone);
        const notPendingWithPhone = guests.filter(g => g.rsvp !== "pending" && g.phone);
        const allWithPhone = [...pendingWithPhone, ...notPendingWithPhone];
        return (
          <div className="modal-overlay" onClick={closeBulkModal}>
            <div className="modal" {...bulkSwipe.modalProps} onClick={e => e.stopPropagation()}>
              <div className="modal-handle"/>
              <div className="modal-title">📲 Bulk WhatsApp Message</div>
              <div style={{marginBottom:16,padding:"10px 14px",background:"rgba(37,211,102,0.07)",border:"1px solid rgba(37,211,102,0.25)",borderRadius:12,fontSize:12.5,color:"#1a6b35",lineHeight:1.5}}>
                Send personalized WhatsApp messages to your guests. Use <strong>{"{name}"}</strong> for the guest&apos;s name, <strong>{"{couple}"}</strong> for the couple&apos;s names, and <strong>{"{rsvp_link}"}</strong> for their RSVP link.
              </div>
              {whatsAppError ? (
                <div style={{marginBottom:12,color:"#B3261E",fontSize:13,fontWeight:600}}>
                  {whatsAppError}
                </div>
              ) : null}
              <div className="input-group">
                <div className="input-label">Message Template</div>
                <textarea
                  className="input-field"
                  rows={4}
                  value={bulkMessage}
                  onChange={e => setBulkMessage(e.target.value)}
                  style={{resize:"vertical",minHeight:90}}
                />
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:600,color:"var(--color-mid-text)",textTransform:"uppercase",letterSpacing:0.5}}>
                  {pendingWithPhone.length} pending · {allWithPhone.length - pendingWithPhone.length} others with phone
                </div>
                {allWithPhone.length > 0 && (
                  <button
                    className="bulk-copy-btn"
                    onClick={() => copyAllNumbers(allWithPhone)}
                  >
                    {copySuccess ? "✓ Copied!" : "Copy Numbers"}
                  </button>
                )}
              </div>
              {allWithPhone.length === 0 ? (
                <div style={{textAlign:"center",padding:"20px",color:"var(--color-light-text)",fontSize:13}}>
                  No guests with phone numbers found.
                </div>
              ) : (
                <div style={{maxHeight:280,overflowY:"auto",borderRadius:12,border:"1px solid rgba(212,175,55,0.15)"}}>
                  {pendingWithPhone.length > 0 && (
                    <div style={{padding:"8px 14px 4px",fontSize:11,fontWeight:700,color:"#F57F17",textTransform:"uppercase",letterSpacing:0.4,background:"rgba(245,127,23,0.05)"}}>
                      Pending RSVP
                    </div>
                  )}
                  {pendingWithPhone.map(g => (
                    <div key={g.id} className="bulk-guest-row">
                      <div className="guest-avatar" style={{width:34,height:34,fontSize:13}}>{initials(getDisplayName(g))}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:500,color:"var(--color-dark-text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{getDisplayName(g)}</div>
                        <div style={{fontSize:11.5,color:"var(--color-light-text)"}}>{g.phone}</div>
                      </div>
                      <button
                        className={`bulk-send-btn${bulkSentIds.has(g.id) ? " sent" : ""}`}
                        onClick={() => sendBulkWhatsApp(g)}
                      >
                        {bulkSentIds.has(g.id) ? "✓ Sent" : "Send"}
                      </button>
                    </div>
                  ))}
                  {notPendingWithPhone.length > 0 && pendingWithPhone.length > 0 && (
                    <div style={{padding:"8px 14px 4px",fontSize:11,fontWeight:700,color:"var(--color-light-text)",textTransform:"uppercase",letterSpacing:0.4,background:"rgba(0,0,0,0.02)"}}>
                      Other Guests
                    </div>
                  )}
                  {notPendingWithPhone.map(g => (
                    <div key={g.id} className="bulk-guest-row">
                      <div className="guest-avatar" style={{width:34,height:34,fontSize:13}}>{initials(getDisplayName(g))}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13.5,fontWeight:500,color:"var(--color-dark-text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{getDisplayName(g)}</div>
                        <div style={{fontSize:11.5,color:"var(--color-light-text)"}}>{g.phone} · <span className={`rsvp-badge rsvp-${g.rsvp}`} style={{padding:"1px 7px",fontSize:10}}>{g.rsvp==="yes"?"Confirmed":g.rsvp==="no"?"Declined":"Pending"}</span></div>
                      </div>
                      <button
                        className={`bulk-send-btn${bulkSentIds.has(g.id) ? " sent" : ""}`}
                        onClick={() => sendBulkWhatsApp(g)}
                      >
                        {bulkSentIds.has(g.id) ? "✓ Sent" : "Send"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-secondary" onClick={closeBulkModal} style={{marginTop:16}}>Close</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default GuestsScreen;
