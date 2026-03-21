import { useMemo, useState } from "react";
import { VENDOR_TYPES } from "../constants";
import { DEFAULT_VENDORS } from "../data";

function VendorsScreen({ vendors, setVendors }) {
  const [activeTab, setActiveTab] = useState("All");
  const [locationFilter, setLocationFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("none");

  function parsePriceValue(priceText = "") {
    if (!priceText) {
      return Number.POSITIVE_INFINITY;
    }
    const cleaned = String(priceText).replace(/[^0-9.]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
  }

  const bookedById = useMemo(
    () => new Map((Array.isArray(vendors) ? vendors : []).map(v => [v.id, Boolean(v.booked)])),
    [vendors]
  );

  const universalVendors = useMemo(
    () => DEFAULT_VENDORS.map(v => ({ ...v, booked: bookedById.get(v.id) ?? Boolean(v.booked) })),
    [bookedById]
  );

  const availableCities = useMemo(
    () => Array.from(new Set(universalVendors.map(v => v.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [universalVendors]
  );

  function toggleBooked(id) {
    setVendors(vs => {
      const current = Array.isArray(vs) ? vs : [];
      const currentMap = new Map(current.map(v => [v.id, Boolean(v.booked)]));
      const nextBooked = !(currentMap.get(id) ?? false);
      currentMap.set(id, nextBooked);

      // Persist only booking state against known directory IDs.
      return DEFAULT_VENDORS.map(v => ({ id: v.id, booked: currentMap.get(v.id) ?? Boolean(v.booked) }));
    });
  }

  const filtered = universalVendors
    .filter(v => activeTab === "All" ? true : v.type === activeTab)
    .filter(v => locationFilter === "all" ? true : v.city === locationFilter)
    .filter(v => ratingFilter === "all" ? true : Number(v.rating) >= Number(ratingFilter))
    .sort((a, b) => {
      if (priceSort !== "low-high") {
        return 0;
      }
      return parsePriceValue(a.price) - parsePriceValue(b.price);
    });

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Vendor Directory</div>
        <div className="section-action" style={{cursor:"default"}}>Curated by VivahGo</div>
      </div>
      <div className="vendor-tabs">
        {VENDOR_TYPES.map(t=>(
          <div key={t} className={`vendor-tab${activeTab===t?" active":""}`} onClick={()=>setActiveTab(t)}>{t}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"0 16px 12px"}}>
        <select className="select-field" value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}>
          <option value="all">All Locations</option>
          {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
        <select className="select-field" value={ratingFilter} onChange={e=>setRatingFilter(e.target.value)}>
          <option value="all">Any Rating</option>
          <option value="5">5★ & up</option>
          <option value="4">4★ & up</option>
          <option value="3">3★ & up</option>
        </select>
        <select className="select-field" value={priceSort} onChange={e=>setPriceSort(e.target.value)}>
          <option value="none">Default Order</option>
          <option value="low-high">Price: Low to High</option>
        </select>
      </div>
      {filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"8px 16px 14px",color:"var(--color-light-text)",fontSize:13}}>
          No vendors found for selected filters.
        </div>
      )}
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
    </div>
  );
}

export default VendorsScreen;