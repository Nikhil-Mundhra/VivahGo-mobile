import { useEffect, useMemo, useState } from "react";
import { VENDOR_TYPES } from "../constants";
import { DEFAULT_VENDORS } from "../data";
import { formatVendorBudgetRange, formatVendorPriceTier, getVendorQuickFacts } from "../utils";
import VendorDetailScreen from "./VendorDetailScreen";
import { fetchApprovedVendors } from "../api";

function VendorsScreen({ vendors }) {
  const [activeTab, setActiveTab] = useState("All");
  const [locationFilter, setLocationFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [budgetFilter, setBudgetFilter] = useState("all");
  const [priceSort, setPriceSort] = useState("none");
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [vendorReviews, setVendorReviews] = useState({});
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

  const hydratedVendors = useMemo(() => {
    return universalVendors.map(vendor => {
      const localReviews = vendorReviews[vendor.id] || [];
      const wishlist = wishlistIds.includes(vendor.id);

      return {
        ...vendor,
        wishlist,
        reviews: [
          ...(Array.isArray(vendor.reviews) ? vendor.reviews : []),
          ...localReviews,
        ],
        reviewCount: Number(vendor.reviewCount || 0) + localReviews.length,
      };
    });
  }, [universalVendors, vendorReviews, wishlistIds]);

  const availableCities = useMemo(
    () => Array.from(new Set(hydratedVendors.map(v => v.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [hydratedVendors]
  );

  const filtered = hydratedVendors
    .filter(v => activeTab === "All" ? true : v.type === activeTab)
    .filter(v => locationFilter === "all" ? true : v.city === locationFilter)
    .filter(v => ratingFilter === "all" ? true : Number(v.rating) >= Number(ratingFilter))
    .filter(v => {
      if (budgetFilter === "all") return true;
      const maxBudget = Number(v?.budgetRange?.max || 0);
      if (!maxBudget) return budgetFilter === "luxury";
      if (budgetFilter === "budget") return maxBudget <= 100000;
      if (budgetFilter === "mid") return maxBudget > 100000 && maxBudget <= 350000;
      return maxBudget > 350000;
    })
    .sort((a, b) => {
      if (priceSort === "low-high") {
        return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
      }
      if (priceSort === "high-low") {
        return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
      }
      if (priceSort === "rating") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      if (Boolean(b.featured) !== Boolean(a.featured)) {
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

  const selectedVendor = useMemo(
    () => filtered.find(v => v.id === selectedVendorId) || hydratedVendors.find(v => v.id === selectedVendorId) || null,
    [filtered, hydratedVendors, selectedVendorId]
  );

  function toggleWishlist(vendorId) {
    setWishlistIds(current => (
      current.includes(vendorId)
        ? current.filter(id => id !== vendorId)
        : [...current, vendorId]
    ));
  }

  function handleAddReview(vendorId, review) {
    setVendorReviews(current => ({
      ...current,
      [vendorId]: [...(current[vendorId] || []), review],
    }));
  }

  return (
    <div>
      {selectedVendor && (
        <VendorDetailScreen
          vendor={selectedVendor}
          onBack={() => setSelectedVendorId(null)}
          onToggleWishlist={() => toggleWishlist(selectedVendor.id)}
          onAddReview={review => handleAddReview(selectedVendor.id, review)}
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
      <div className="vendor-filter-grid vendor-filter-grid-primary">
        <select className="select-field vendor-filter-select" value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}>
          <option value="all">All Locations</option>
          {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
        <select className="select-field vendor-filter-select" value={ratingFilter} onChange={e=>setRatingFilter(e.target.value)}>
          <option value="all">Any Rating</option>
          <option value="5">5★ & up</option>
          <option value="4">4★ & up</option>
          <option value="3">3★ & up</option>
        </select>
        <select className="select-field vendor-filter-select" value={priceSort} onChange={e=>setPriceSort(e.target.value)}>
          <option value="none">Default Order</option>
          <option value="low-high">INR tiers: low to high</option>
          <option value="high-low">INR tiers: high to low</option>
          <option value="rating">Top rated first</option>
        </select>
      </div>
      <div className="vendor-filter-grid vendor-filter-grid-secondary">
        <select className="select-field vendor-filter-select" value={budgetFilter} onChange={e=>setBudgetFilter(e.target.value)}>
          <option value="all">All Budgets</option>
          <option value="budget">Budget friendly</option>
          <option value="mid">Mid range</option>
          <option value="luxury">Luxury</option>
        </select>
        <div className="vendor-filter-summary">
          <span>{wishlistIds.length} wishlisted</span>
          <span>{filtered.length} vendors shown</span>
        </div>
      </div>
      {filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"8px 16px 14px",color:"var(--color-light-text)",fontSize:13}}>
          No vendors found for selected filters.
        </div>
      )}
      {filtered.map(v => {
        const quickFacts = getVendorQuickFacts(v);

        return (
        <div className="vendor-card vendor-card-clickable" key={v.id} onClick={()=>setSelectedVendorId(v.id)}>
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
              {v.featuredLabel && <div className="vendor-featured-chip">{v.featuredLabel}</div>}
              {quickFacts.length > 0 && (
                <div className="vendor-facts-row">
                  <div className="vendor-facts-inline">{quickFacts.join(" · ")}</div>
                </div>
              )}
              <div className="vendor-stars">{"★".repeat(v.rating || 0)}{"☆".repeat(5-(v.rating || 0))} <span style={{color:"var(--color-light-text)",fontSize:11}}>{v.rating ? `${v.rating}.0` : 'No rating'}</span> <span style={{color:"var(--color-light-text)",fontSize:11}}>({v.reviewCount || 0} reviews)</span></div>
            </div>
            <button
              type="button"
              className={`vendor-wishlist-btn${v.wishlist ? " active" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleWishlist(v.id);
              }}
              aria-label={v.wishlist ? "Remove from wishlist" : "Add to wishlist"}
            >
              {v.wishlist ? "♥" : "♡"}
            </button>
            {v.booked && <div style={{background:"#E8F5E9",color:"#2E7D32",padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:600,alignSelf:"flex-start"}}>Booked ✓</div>}
          </div>
          <div className="vendor-bottom">
            <div className="vendor-price-wrap">
              <div className="vendor-price">{formatVendorPriceTier(v.priceLevel)}</div>
              <div style={{fontSize:11,color:"var(--color-light-text)",marginTop:2}}>
                {v.pricePerPlate ? `${v.pricePerPlate.toLocaleString("en-IN")}/plate` : formatVendorBudgetRange(v) || "Budget on request"}
              </div>
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
