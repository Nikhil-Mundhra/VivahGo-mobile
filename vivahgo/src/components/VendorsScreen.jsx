import { useEffect, useMemo, useState } from "react";
import { VENDOR_TYPES } from "../constants";
import { DEFAULT_VENDORS } from "../data";
import { formatVendorPriceTier, getVendorQuickFacts } from "../utils";
import VendorDetailScreen from "./VendorDetailScreen";
import { fetchApprovedVendors } from "../api";

function VendorsScreen({ vendors }) {
  const [activeTab, setActiveTab] = useState("All");
  const [locationFilter, setLocationFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("none");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [dbVendors, setDbVendors] = useState([]);

  useEffect(() => {
    fetchApprovedVendors()
      .then(data => { setDbVendors(Array.isArray(data?.vendors) ? data.vendors : []); })
      .catch(() => { /* Graceful degradation: fall back to static list only */ });
  }, []);

  const bookedById = useMemo(
    () => new Map((Array.isArray(vendors) ? vendors : []).map(v => [v.id, Boolean(v.booked)])),
    [vendors]
  );

  const universalVendors = useMemo(() => {
    // DB-approved vendors take precedence over static data; merge by id
    const staticWithBooked = DEFAULT_VENDORS.map(v => ({
      ...v,
      booked: bookedById.get(v.id) ?? Boolean(v.booked),
    }));
    // DB vendors have ids prefixed with "db_" so they never collide with static ids
    return [...staticWithBooked, ...dbVendors];
  }, [bookedById, dbVendors]);

  const availableCities = useMemo(
    () => Array.from(new Set(universalVendors.map(v => v.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [universalVendors]
  );

  const filtered = universalVendors
    .filter(v => activeTab === "All" ? true : v.type === activeTab)
    .filter(v => locationFilter === "all" ? true : v.city === locationFilter)
    .filter(v => ratingFilter === "all" ? true : Number(v.rating) >= Number(ratingFilter))
    .sort((a, b) => {
      if (priceSort !== "low-high") {
        return 0;
      }
      return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
    });

  return (
    <div>
      {selectedVendor && (
        <VendorDetailScreen
          vendor={selectedVendor}
          onBack={() => setSelectedVendor(null)}
        />
      )}
      {!selectedVendor && (
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
          <option value="low-high">INR tiers: low to high</option>
        </select>
      </div>
      {filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"8px 16px 14px",color:"var(--color-light-text)",fontSize:13}}>
          No vendors found for selected filters.
        </div>
      )}
      {filtered.map(v => {
        const quickFacts = getVendorQuickFacts(v);

        return (
        <div className="vendor-card vendor-card-clickable" key={v.id} onClick={()=>setSelectedVendor(v)}>
          <div className="vendor-top">
            {v.coverImageUrl ? (
              <img
                src={v.coverImageUrl}
                alt={v.name}
                style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div className="vendor-icon">{v.emoji}</div>
            )}
            <div className="vendor-info">
              <div className="vendor-name">{v.name}</div>
              <div className="vendor-type">{v.type} · {v.city}</div>
              {quickFacts.length > 0 && (
                <div className="vendor-facts-row">
                  <div className="vendor-facts-inline">{quickFacts.join(" · ")}</div>
                </div>
              )}
              <div className="vendor-stars">{"★".repeat(v.rating || 0)}{"☆".repeat(5-(v.rating || 0))} <span style={{color:"var(--color-light-text)",fontSize:11}}>{v.rating ? `${v.rating}.0` : 'No rating'}</span></div>
            </div>
            {v.booked && <div style={{background:"#E8F5E9",color:"#2E7D32",padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:600,alignSelf:"flex-start"}}>Booked ✓</div>}
          </div>
          <div className="vendor-bottom">
            <div className="vendor-price-wrap">
              <div className="vendor-price">{formatVendorPriceTier(v.priceLevel)}</div>
            </div>
            <div className="vendor-view-arrow">View Details →</div>
          </div>
        </div>
        );
      })}
    </div>
      )}
    </div>
  );
}

export default VendorsScreen;
