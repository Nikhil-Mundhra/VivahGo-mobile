import { useState } from "react";
import { initials } from "../utils";

function GuestsScreen({ guests, setGuests }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:"",side:"bride",phone:"",rsvp:"pending"});
  const [search, setSearch] = useState("");

  const yes = guests.filter(g=>g.rsvp==="yes").length;
  const no = guests.filter(g=>g.rsvp==="no").length;
  const pending = guests.filter(g=>g.rsvp==="pending").length;

  function add() {
    if(!form.name) return;
    setGuests(g=>[...g,{...form,id:Date.now()}]);
    setForm({name:"",side:"bride",phone:"",rsvp:"pending"});
    setShowAdd(false);
  }

  function cycleRSVP(id) {
    setGuests(gs=>gs.map(g=>g.id===id?{...g,rsvp:g.rsvp==="pending"?"yes":g.rsvp==="yes"?"no":"pending"}:g));
  }

  const filtered = guests.filter(g=>g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {/* Stats */}
      <div className="guest-stats">
        <div className="guest-stat">
          <div className="guest-stat-num" style={{color:"var(--color-crimson)"}}>{guests.length}</div>
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
        <button className="section-action" onClick={()=>setShowAdd(true)}>+ Add</button>
      </div>

      <div style={{background:"var(--color-white)",borderRadius:16,margin:"0 16px",border:"1px solid rgba(212,175,55,0.15)"}}>
        {filtered.length === 0 ? (
          <div style={{textAlign:"center",padding:"30px",color:"var(--color-light-text)",fontSize:13}}>
            {guests.length===0?"No guests added yet.":"No results found."}
          </div>
        ) : filtered.map(g=>(
          <div className="guest-item" key={g.id}>
            <div className="guest-avatar">{initials(g.name)}</div>
            <div className="guest-info">
              <div className="guest-name">{g.name}</div>
              <div className="guest-side">{g.side==="bride"?"Bride's side":"Groom's side"}{g.phone?` · ${g.phone}`:""}</div>
            </div>
            <div className={`rsvp-badge rsvp-${g.rsvp}`} onClick={()=>cycleRSVP(g.id)} style={{cursor:"pointer"}}>
              {g.rsvp==="yes"?"✓ Yes":g.rsvp==="no"?"✗ No":"Pending"}
            </div>
          </div>
        ))}
      </div>

      <button className="fab" onClick={()=>setShowAdd(true)}>+</button>

      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Add Guest 👥</div>
            <div className="input-group">
              <div className="input-label">Name</div>
              <input className="input-field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/>
            </div>
            <div className="input-group">
              <div className="input-label">Side</div>
              <select className="select-field" value={form.side} onChange={e=>setForm({...form,side:e.target.value})}>
                <option value="bride">Bride's Side</option>
                <option value="groom">Groom's Side</option>
              </select>
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
            <button className="btn-primary" onClick={add}>Add Guest</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GuestsScreen;