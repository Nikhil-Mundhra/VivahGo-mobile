import { useState } from "react";
import { VENDOR_TYPES } from "../constants";
import { DEFAULT_VENDORS } from "../data";

function VendorsScreen({ vendors, setVendors }) {
  const [activeTab, setActiveTab] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({name:"",type:"Photography",emoji:"📸",rating:5,price:"",city:"",booked:false});

  function toggleBooked(id) { setVendors(vs=>vs.map(v=>v.id===id?{...v,booked:!v.booked}:v)); }

  const filtered = activeTab==="All" ? vendors : vendors.filter(v=>v.type===activeTab);

  const EMOJI_MAP = {"Photography":"📸","Catering":"🍽️","Decoration":"🌺","Music":"🎵","Pandit":"🪔","Venue":"🏛️"};

  function add() {
    if(!form.name||!form.price) return;
    setVendors(vs=>[...vs,{...form,id:Date.now(),emoji:EMOJI_MAP[form.type]||"✨",rating:Number(form.rating)}]);
    setForm({name:"",type:"Photography",rating:5,price:"",city:"",booked:false});
    setShowAdd(false);
  }

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Vendor Directory</div>
        <button className="section-action" onClick={()=>setShowAdd(true)}>+ Add</button>
      </div>
      <div className="vendor-tabs">
        {VENDOR_TYPES.map(t=>(
          <div key={t} className={`vendor-tab${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)}>{t}</div>
        ))}
      </div>
      {filtered.map(v=>(
        <div className="vendor-card" key={v.id}>
          <div className="vendor-top">
            <div className="vendor-icon">{v.emoji}</div>
            <div className="vendor-info">
              <div className="vendor-name">{v.name}</div>
              <div className="vendor-type">{v.type} · {v.city}</div>
              <div className="vendor-stars">{"★".repeat(v.rating)}{"☆".repeat(5-v.rating)} <span style={{color:"var(--color-light-text)",fontSize:11}}>{v.rating}.0</span></div>
            </div>
            {v.booked && <div style={{background:"#E8F5E9",color:"#2E7D32",padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:600,alignSelf:"flex-start"}}>Booked ✓</div>}
          </div>
          <div className="vendor-bottom">
            <div className="vendor-price">{v.price}</div>
            <button className={`vendor-btn${v.booked?" vendor-booked":""}`} onClick={()=>toggleBooked(v.id)}>
              {v.booked?"Booked ✓":"Book Now"}
            </button>
          </div>
        </div>
      ))}

      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div className="modal-title">Add Vendor 🛍️</div>
            <div className="input-group">
              <div className="input-label">Vendor Name</div>
              <input className="input-field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Studio Memories"/>
            </div>
            <div className="input-group">
              <div className="input-label">Category</div>
              <select className="select-field" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                {VENDOR_TYPES.slice(1).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="input-group">
              <div className="input-label">Price / Quote</div>
              <input className="input-field" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="e.g. ₹75,000"/>
            </div>
            <div className="input-group">
              <div className="input-label">City</div>
              <input className="input-field" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="e.g. Delhi"/>
            </div>
            <div className="input-group">
              <div className="input-label">Rating (1-5)</div>
              <select className="select-field" value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}>
                {[5,4,3,2,1].map(r=><option key={r} value={r}>{"★".repeat(r)} {r}/5</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={add}>Add Vendor</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorsScreen;