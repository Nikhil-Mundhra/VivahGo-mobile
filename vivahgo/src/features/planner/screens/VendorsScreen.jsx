import { useEffect, useMemo, useState } from "react";
import { BUNDLED_SERVICE_OPTIONS, VENDOR_SUBTYPE_OPTIONS, VENDOR_TYPES } from "../../../constants";
import { fmt } from "../../../shared/lib/core.js";
import { FallbackImage, FallbackVideo } from "../../../components/MediaWithFallback.jsx";
import { formatVendorBudgetRange, formatVendorPriceTier, getVendorPriceLevel, getVendorQuickFacts } from "../../vendor/lib/vendorFormatting.js";
import VendorDetailScreen from "../../vendor/components/VendorDetailScreen.jsx";
import { fetchApprovedVendors } from "../../vendor/api.js";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";
import { getVendorAvailabilityMatch } from "../../../vendorAvailability";

const VENDOR_FILTERS_SESSION_KEY = "vivahgo.vendorFilters";
const VENDOR_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "booked", label: "Booked" },
  { id: "cancelled", label: "Cancelled" },
];
const LEGACY_VENDOR_TYPE_ALIASES = {
  Bride: "Bridal & Pre-Bridal",
  Groom: "Groom Services",
};

function normalizeVendorType(type) {
  return LEGACY_VENDOR_TYPE_ALIASES[type] || type;
}

function getSavedVendorFilters() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(VENDOR_FILTERS_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      ...parsed,
      activeTab: normalizeVendorType(parsed.activeTab || "All"),
      bundledServiceFilter: normalizeVendorType(parsed.bundledServiceFilter || "all"),
    };
  } catch {
    return null;
  }
}

function createPlannerVendorId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `planner_vendor_${globalThis.crypto.randomUUID()}`;
  }

  return `planner_vendor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createLinkedSpendDraft(events) {
  return {
    label: "",
    amount: "",
    eventId: events[0]?.id ?? "",
  };
}

function createVendorForm(events, vendor = {}) {
  return {
    id: vendor.id ?? null,
    directoryVendorId: vendor.directoryVendorId ?? "",
    source: vendor.source || vendor.vendorSource || (vendor.isPrivateVendor ? "private" : (vendor.directoryVendorId ? "directory" : "private")),
    isPrivateVendor: Boolean(vendor.isPrivateVendor || vendor.source === "private" || vendor.vendorSource === "private"),
    name: vendor.name || "",
    type: vendor.type || "",
    subType: vendor.subType || "",
    city: vendor.city || "",
    contactName: vendor.contactName || "",
    phone: vendor.phone || "",
    notes: vendor.notes || "",
    status: vendor.status || (vendor.booked ? "booked" : "pending"),
    wishlist: Boolean(vendor.wishlist),
    priceRangeMin: vendor.priceRangeMin ? String(vendor.priceRangeMin) : (vendor?.budgetRange?.min ? String(vendor.budgetRange.min) : ""),
    priceRangeMax: vendor.priceRangeMax ? String(vendor.priceRangeMax) : (vendor?.budgetRange?.max ? String(vendor.budgetRange.max) : ""),
    contractTotal: vendor.contractTotal ? String(vendor.contractTotal) : "",
    contractLineItems: Array.isArray(vendor.contractLineItems)
      ? vendor.contractLineItems.map((item, index) => ({
          id: item.id || `line_${Date.now()}_${index}`,
          label: item.label || "",
          amount: Number(item.amount || 0),
          eventId: item.eventId ?? "",
        }))
      : [],
    linkedSpendDraft: createLinkedSpendDraft(events),
  };
}

function coerceAmount(value) {
  return Number(String(value || "").replace(/[^0-9.]/g, "")) || 0;
}

function buildVendorPayload(form, planId) {
  const status = form.status || "pending";
  const isBooked = status === "booked";
  const source = form.isPrivateVendor ? "private" : (form.source || (form.directoryVendorId ? "directory" : "private"));

  return {
    id: form.id || form.directoryVendorId || createPlannerVendorId(),
    directoryVendorId: form.directoryVendorId || "",
    source,
    vendorSource: source,
    isPrivateVendor: Boolean(form.isPrivateVendor || source === "private"),
    name: String(form.name || "").trim(),
    type: String(form.type || "").trim(),
    subType: String(form.subType || "").trim(),
    city: String(form.city || "").trim(),
    contactName: String(form.contactName || "").trim(),
    phone: String(form.phone || "").trim(),
    notes: String(form.notes || "").trim(),
    status,
    booked: isBooked,
    wishlist: Boolean(form.wishlist),
    priceRangeMin: isBooked ? 0 : coerceAmount(form.priceRangeMin),
    priceRangeMax: isBooked ? 0 : coerceAmount(form.priceRangeMax),
    budgetRange: isBooked ? null : {
      min: coerceAmount(form.priceRangeMin),
      max: coerceAmount(form.priceRangeMax),
    },
    contractTotal: isBooked ? coerceAmount(form.contractTotal) : 0,
    contractLineItems: isBooked
      ? form.contractLineItems.map(item => ({
          id: item.id || `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: String(item.label || "").trim(),
          amount: Number(item.amount || 0),
          eventId: item.eventId ?? "",
        }))
      : [],
    planId,
  };
}

function createPlannerVendorFromDirectory(vendor, planId, overrides = {}) {
  return {
    id: vendor.id,
    directoryVendorId: vendor.id,
    source: "directory",
    vendorSource: "directory",
    isPrivateVendor: false,
    name: vendor.name || "",
    type: vendor.type || "",
    subType: vendor.subType || "",
    city: vendor.city || "",
    contactName: "",
    phone: "",
    notes: "",
    status: "pending",
    booked: false,
    wishlist: false,
    priceRangeMin: Number(vendor?.budgetRange?.min || 0),
    priceRangeMax: Number(vendor?.budgetRange?.max || 0),
    budgetRange: vendor?.budgetRange || null,
    contractTotal: 0,
    contractLineItems: [],
    planId,
    ...overrides,
  };
}

function formatPriceRange(minValue, maxValue) {
  const min = Number(minValue || 0);
  const max = Number(maxValue || 0);
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (max) return `Up to ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return "Price not added";
}

function getStatusLabel(status) {
  return VENDOR_STATUSES.find(item => item.id === status)?.label || "Pending";
}

function renderVendorStars(vendor) {
  const rating = Math.max(0, Math.min(5, Number(vendor?.rating) || 0));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

function VendorCoverVisual({ vendor, className, style, alt }) {
  const coverMediaUrl = String(vendor?.coverMediaUrl || vendor?.coverImageUrl || "").trim();
  const coverMediaType = String(vendor?.coverMediaType || (vendor?.coverImageUrl ? "IMAGE" : "")).trim().toUpperCase();

  if (!coverMediaUrl) {
    return <div className="vendor-icon">{vendor?.emoji || "🏷️"}</div>;
  }

  if (coverMediaType === "VIDEO") {
    return (
      <FallbackVideo
        src={coverMediaUrl}
        className={className}
        style={style}
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <FallbackImage
      src={coverMediaUrl}
      alt={alt || vendor?.name || "Vendor"}
      className={className}
      style={style}
    />
  );
}

function EmptyMyVendorsState() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "28px 20px", margin: "0 16px 16px" }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>🤝</div>
      <div className="card-title" style={{ marginBottom: 8 }}>No vendors tracked yet</div>
      <div className="card-sub">
        Wishlist a directory vendor or add a private vendor here to start managing status, price ranges, and contracts.
      </div>
    </div>
  );
}

function MyVendorCard({ vendor, events, onClick }) {
  const linkedCeremonies = (vendor.contractLineItems || [])
    .map(item => events.find(event => String(event.id) === String(item.eventId))?.name)
    .filter(Boolean);
  const notes = String(vendor.notes || "").trim();

  return (
    <button type="button" className="vendor-managed-card" onClick={onClick}>
      <div className="vendor-managed-card-head">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
          {String(vendor?.coverMediaUrl || vendor?.coverImageUrl || "").trim() ? (
            <VendorCoverVisual
              vendor={vendor}
              alt={vendor.name}
              className="my-vendors-card-image"
              style={{ width: 58, height: 58, borderRadius: 16, objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div className="my-vendors-card-icon">{vendor.emoji || (vendor.isPrivateVendor ? "🗂️" : "🏷️")}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="vendor-name">{vendor.name}</div>
            <div className="vendor-type">
              {vendor.type || "Vendor"}{vendor.subType ? ` · ${vendor.subType}` : ""}{vendor.city ? ` · ${vendor.city}` : ""}
            </div>
            <div className="vendor-managed-secondary" style={{ marginTop: 8 }}>
              {vendor.isPrivateVendor ? "Private vendor" : "Directory vendor"}{vendor.wishlist ? " · Wishlisted" : ""}
              {vendor.phone ? ` · ${vendor.phone}` : ""}
            </div>
          </div>
        </div>
        <span className={`vendor-managed-status vendor-managed-status-${vendor.status}`}>{getStatusLabel(vendor.status)}</span>
      </div>
      <div className="vendor-managed-card-body">
        {vendor.status === "booked" ? (
          <>
            <div className="vendor-managed-primary">Contract: {fmt(vendor.contractTotal)}</div>
            <div className="vendor-managed-secondary">
              {vendor.contractLineItems?.length
                ? `${vendor.contractLineItems.length} linked spend ${vendor.contractLineItems.length === 1 ? "item" : "items"}`
                : "No linked spend added yet"}
            </div>
            {linkedCeremonies.length > 0 && <div className="vendor-managed-tertiary">{linkedCeremonies.slice(0, 3).join(" · ")}</div>}
          </>
        ) : (
          <>
            <div className="vendor-managed-primary">Price Range: {formatPriceRange(vendor.priceRangeMin, vendor.priceRangeMax)}</div>
            <div className="vendor-managed-secondary">
              {vendor.status === "cancelled" ? "Cancelled vendor record" : "Pending vendor record"}
            </div>
          </>
        )}
        {notes && <div className="vendor-managed-tertiary">{notes}</div>}
        {vendor.reviewCount > 0 && (
          <div className="vendor-managed-tertiary">{renderVendorStars(vendor)} ({vendor.reviewCount})</div>
        )}
      </div>
    </button>
  );
}

function VendorsScreen({
  vendors,
  setVendors,
  events = [],
  planId,
  view = "directory",
  onBackToDirectory,
}) {
  const savedFilters = getSavedVendorFilters();
  const [activeTab, setActiveTab] = useState(savedFilters?.activeTab || "All");
  const [locationFilter, setLocationFilter] = useState(savedFilters?.locationFilter || "all");
  const [subtypeFilter, setSubtypeFilter] = useState(savedFilters?.subtypeFilter || "all");
  const [bundledServiceFilter, setBundledServiceFilter] = useState(savedFilters?.bundledServiceFilter || "all");
  const [ratingFilter, setRatingFilter] = useState(savedFilters?.ratingFilter || "all");
  const [budgetFilter, setBudgetFilter] = useState(savedFilters?.budgetFilter || "all");
  const [priceSort, setPriceSort] = useState(savedFilters?.priceSort || "none");
  const [availabilityStartDate, setAvailabilityStartDate] = useState(savedFilters?.availabilityStartDate || "");
  const [availabilityEndDate, setAvailabilityEndDate] = useState(savedFilters?.availabilityEndDate || "");
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [vendorReviews, setVendorReviews] = useState({});
  const [dbVendors, setDbVendors] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [showVendorEditor, setShowVendorEditor] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState(() => createVendorForm(events));
  const [myVendorStatusFilter, setMyVendorStatusFilter] = useState("all");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event) => {
      setIsMobileView(event.matches);
      if (!event.matches) {
        setShowMobileFilters(false);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(VENDOR_FILTERS_SESSION_KEY, JSON.stringify({
      activeTab,
      locationFilter,
      subtypeFilter,
      bundledServiceFilter,
      ratingFilter,
      budgetFilter,
      priceSort,
      availabilityStartDate,
      availabilityEndDate,
    }));
  }, [activeTab, availabilityEndDate, availabilityStartDate, budgetFilter, bundledServiceFilter, locationFilter, priceSort, ratingFilter, subtypeFilter]);

  useEffect(() => {
    fetchApprovedVendors()
      .then(data => { setDbVendors(Array.isArray(data?.vendors) ? data.vendors : []); })
      .catch(() => { setDbVendors([]); });
  }, []);

  function closeVendorEditor() {
    setShowVendorEditor(false);
    setEditingVendorId(null);
    setVendorForm(createVendorForm(events));
  }

  useBackButtonClose(showMobileFilters, () => setShowMobileFilters(false));
  useBackButtonClose(showVendorEditor, closeVendorEditor);

  const directoryVendorById = useMemo(() => new Map(dbVendors.map(vendor => [String(vendor.id), vendor])), [dbVendors]);

  const plannerVendorsByDirectoryId = useMemo(() => {
    const map = new Map();
    (Array.isArray(vendors) ? vendors : []).forEach(vendor => {
      const directoryId = vendor?.directoryVendorId ?? (typeof vendor?.id === "number" ? vendor.id : null);
      if (directoryId !== null && directoryId !== undefined && directoryId !== "") {
        map.set(String(directoryId), vendor);
      }
    });
    return map;
  }, [vendors]);

  const myVendors = useMemo(() => {
    return (Array.isArray(vendors) ? vendors : [])
      .map(vendor => {
        const directoryVendor = directoryVendorById.get(String(vendor.directoryVendorId ?? vendor.id));
        const status = vendor.status || (vendor.booked ? "booked" : "pending");
        return {
          ...directoryVendor,
          ...vendor,
          status,
          booked: status === "booked",
          isPrivateVendor: Boolean(vendor.isPrivateVendor || vendor.source === "private" || vendor.vendorSource === "private"),
          priceRangeMin: Number(vendor.priceRangeMin ?? vendor?.budgetRange?.min ?? 0),
          priceRangeMax: Number(vendor.priceRangeMax ?? vendor?.budgetRange?.max ?? 0),
          contractTotal: Number(vendor.contractTotal || 0),
          contractLineItems: Array.isArray(vendor.contractLineItems) ? vendor.contractLineItems : [],
        };
      })
      .sort((a, b) => {
        const statusOrder = { booked: 0, pending: 1, cancelled: 2 };
        const statusDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [directoryVendorById, vendors]);

  const wishlistedVendorCount = myVendors.filter(vendor => vendor.wishlist).length;
  const myVendorCounts = useMemo(() => ({
    booked: myVendors.filter(vendor => vendor.status === "booked").length,
    pending: myVendors.filter(vendor => vendor.status === "pending").length,
    cancelled: myVendors.filter(vendor => vendor.status === "cancelled").length,
  }), [myVendors]);
  const visibleMyVendors = useMemo(() => (
    myVendorStatusFilter === "all"
      ? myVendors
      : myVendors.filter(vendor => vendor.status === myVendorStatusFilter)
  ), [myVendorStatusFilter, myVendors]);

  const universalVendors = useMemo(() => {
    return dbVendors.map(vendor => {
      const plannerVendor = plannerVendorsByDirectoryId.get(String(vendor.id));
      const status = plannerVendor?.status || (plannerVendor?.booked ? "booked" : "directory");

      return {
        ...vendor,
        ...(plannerVendor || {}),
        id: vendor.id,
        directoryVendorId: vendor.id,
        booked: status === "booked",
        status,
        wishlist: Boolean(plannerVendor?.wishlist),
        isMarketplaceVendor: true,
      };
    });
  }, [dbVendors, plannerVendorsByDirectoryId]);

  const hydratedVendors = useMemo(() => {
    return universalVendors.map(vendor => {
      const localReviews = vendorReviews[vendor.id] || [];
      return {
        ...vendor,
        reviews: [
          ...(Array.isArray(vendor.reviews) ? vendor.reviews : []),
          ...localReviews,
        ],
        reviewCount: Number(vendor.reviewCount || 0) + localReviews.length,
      };
    });
  }, [universalVendors, vendorReviews]);

  const availableCities = useMemo(
    () => Array.from(new Set(hydratedVendors.map(v => v.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [hydratedVendors]
  );

  const availableSubtypes = useMemo(() => {
    if (activeTab !== "All") {
      return VENDOR_SUBTYPE_OPTIONS[activeTab] || [];
    }

    return Array.from(new Set(hydratedVendors.map(v => v.subType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activeTab, hydratedVendors]);

  const filtered = hydratedVendors
    .map(vendor => ({
      ...vendor,
      availabilityMatch: getVendorAvailabilityMatch(vendor, availabilityStartDate, availabilityEndDate),
    }))
    .filter(v => activeTab === "All" ? true : v.type === activeTab)
    .filter(v => subtypeFilter === "all" ? true : v.subType === subtypeFilter)
    .filter(v => bundledServiceFilter === "all" ? true : Array.isArray(v.bundledServices) && v.bundledServices.includes(bundledServiceFilter))
    .filter(v => locationFilter === "all" ? true : v.city === locationFilter)
    .filter(v => ratingFilter === "all" ? true : Number(v.rating) >= Number(ratingFilter))
    .filter(v => v.availabilityMatch?.isMatch !== false)
    .filter(v => {
      if (budgetFilter === "all") return true;
      const maxBudget = Number(v?.budgetRange?.max || 0);
      if (!maxBudget) return budgetFilter === "luxury";
      if (budgetFilter === "budget") return maxBudget <= 100000;
      if (budgetFilter === "mid") return maxBudget > 100000 && maxBudget <= 350000;
      return maxBudget > 350000;
    })
    .sort((a, b) => {
      if (priceSort === "low-high") return getVendorPriceLevel(a) - getVendorPriceLevel(b);
      if (priceSort === "high-low") return getVendorPriceLevel(b) - getVendorPriceLevel(a);
      if (priceSort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (Boolean(b.isChoiceProfile) !== Boolean(a.isChoiceProfile)) {
        return Number(Boolean(b.isChoiceProfile)) - Number(Boolean(a.isChoiceProfile));
      }
      if (Boolean(b.isMarketplaceVendor) !== Boolean(a.isMarketplaceVendor)) {
        return Number(Boolean(b.isMarketplaceVendor)) - Number(Boolean(a.isMarketplaceVendor));
      }
      if (Boolean(a.featured) !== Boolean(b.featured)) {
        return Number(Boolean(a.featured)) - Number(Boolean(b.featured));
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

  const selectedVendor = useMemo(
    () => filtered.find(v => String(v.id) === String(selectedVendorId)) || hydratedVendors.find(v => String(v.id) === String(selectedVendorId)) || null,
    [filtered, hydratedVendors, selectedVendorId]
  );

  const editingVendor = useMemo(
    () => myVendors.find(vendor => String(vendor.id) === String(editingVendorId)) || null,
    [editingVendorId, myVendors]
  );

  const activeFilterCount = [
    locationFilter,
    subtypeFilter,
    bundledServiceFilter,
    ratingFilter,
    budgetFilter,
    priceSort,
    availabilityStartDate,
    availabilityEndDate,
  ].filter(value => value !== "all" && value !== "none" && value !== "").length;

  const linkedSpendTotal = vendorForm.contractLineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const canAddLinkedSpend = Boolean(vendorForm.linkedSpendDraft.label.trim() && coerceAmount(vendorForm.linkedSpendDraft.amount));
  const canSaveVendor = Boolean(vendorForm.name.trim() && vendorForm.type.trim());

  function updateVendors(updater) {
    if (typeof setVendors === "function") {
      setVendors(updater);
    }
  }

  function openAddVendor() {
    setEditingVendorId(null);
    setVendorForm(createVendorForm(events, {
      source: "private",
      vendorSource: "private",
      isPrivateVendor: true,
      type: activeTab !== "All" ? activeTab : "Venue",
      status: "pending",
    }));
    setShowVendorEditor(true);
  }

  function openEditVendor(vendor) {
    setEditingVendorId(vendor.id);
    setVendorForm(createVendorForm(events, vendor));
    setShowVendorEditor(true);
  }

  function handleVendorFormChange(field, value) {
    setVendorForm(current => {
      const next = { ...current, [field]: value };
      if (field === "type") {
        const allowedSubtypes = VENDOR_SUBTYPE_OPTIONS[value] || [];
        if (!allowedSubtypes.includes(next.subType)) {
          next.subType = "";
        }
      }
      if (field === "status" && value !== "booked") {
        next.contractTotal = "";
        next.contractLineItems = [];
        next.linkedSpendDraft = createLinkedSpendDraft(events);
      }
      if (field === "status" && value === "booked") {
        next.priceRangeMin = "";
        next.priceRangeMax = "";
      }
      return next;
    });
  }

  function addLinkedSpendItem() {
    if (!canAddLinkedSpend) {
      return;
    }

    setVendorForm(current => ({
      ...current,
      contractLineItems: [
        ...current.contractLineItems,
        {
          id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          label: current.linkedSpendDraft.label.trim(),
          amount: coerceAmount(current.linkedSpendDraft.amount),
          eventId: current.linkedSpendDraft.eventId ?? "",
        },
      ],
      linkedSpendDraft: createLinkedSpendDraft(events),
    }));
  }

  function removeLinkedSpendItem(itemId) {
    setVendorForm(current => ({
      ...current,
      contractLineItems: current.contractLineItems.filter(item => item.id !== itemId),
    }));
  }

  function saveVendor() {
    if (!canSaveVendor) {
      return;
    }

    const payload = buildVendorPayload(vendorForm, planId);
    updateVendors(existing => {
      const current = Array.isArray(existing) ? existing : [];
      const hasExisting = current.some(vendor => String(vendor.id) === String(payload.id));
      if (hasExisting) {
        return current.map(vendor => String(vendor.id) === String(payload.id) ? { ...vendor, ...payload } : vendor);
      }
      return [...current, payload];
    });
    closeVendorEditor();
  }

  function deleteVendor(vendorId) {
    updateVendors(existing => (Array.isArray(existing) ? existing : []).filter(vendor => String(vendor.id) !== String(vendorId)));
    closeVendorEditor();
  }

  function toggleWishlist(vendorId) {
    const directoryVendor = directoryVendorById.get(String(vendorId));
    if (!directoryVendor) {
      return;
    }

    const existingVendor = plannerVendorsByDirectoryId.get(String(vendorId));
    if (existingVendor) {
      updateVendors(current => (Array.isArray(current) ? current : []).map(vendor => {
        if (String(vendor.id) !== String(existingVendor.id)) {
          return vendor;
        }

        const nextWishlist = !vendor.wishlist;
        return {
          ...vendor,
          wishlist: nextWishlist,
          status: vendor.status || (vendor.booked ? "booked" : "pending"),
          booked: (vendor.status || (vendor.booked ? "booked" : "pending")) === "booked",
          priceRangeMin: vendor.priceRangeMin || Number(directoryVendor?.budgetRange?.min || 0),
          priceRangeMax: vendor.priceRangeMax || Number(directoryVendor?.budgetRange?.max || 0),
        };
      }));
      return;
    }

    updateVendors(current => [
      ...(Array.isArray(current) ? current : []),
      createPlannerVendorFromDirectory(directoryVendor, planId, { wishlist: true }),
    ]);
  }

  function handleAddReview(vendorId, review) {
    setVendorReviews(current => ({
      ...current,
      [vendorId]: [...(current[vendorId] || []), review],
    }));
  }

  const filterControls = (
    <>
      <div className="vendor-filter-grid vendor-filter-grid-primary">
        <select className="select-field vendor-filter-select" value={subtypeFilter} onChange={e=>setSubtypeFilter(e.target.value)}>
          <option value="all">{activeTab === "All" ? "All Subcategories" : `${activeTab} Subcategories`}</option>
          {availableSubtypes.map(subtype => <option key={subtype} value={subtype}>{subtype}</option>)}
        </select>
        <select className="select-field vendor-filter-select" value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}>
          <option value="all">All Locations</option>
          {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
        <select className="select-field vendor-filter-select" value={bundledServiceFilter} onChange={e=>setBundledServiceFilter(e.target.value)}>
          <option value="all">Also Offers</option>
          {BUNDLED_SERVICE_OPTIONS.filter(option => option !== activeTab).map(option => <option key={option} value={option}>{option}</option>)}
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
        <div className="vendor-availability-filter-card">
          <div className="vendor-availability-filter-head">
            <span className="vendor-availability-filter-label">Availability dates</span>
            {(availabilityStartDate || availabilityEndDate) && (
              <button
                type="button"
                className="vendor-availability-clear-btn"
                onClick={() => {
                  setAvailabilityStartDate("");
                  setAvailabilityEndDate("");
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="vendor-availability-filter-inputs">
            <input
              type="date"
              className="input-field vendor-availability-date-input"
              value={availabilityStartDate}
              onChange={e => setAvailabilityStartDate(e.target.value)}
              aria-label="Availability start date"
            />
            <span className="vendor-availability-filter-divider">to</span>
            <input
              type="date"
              className="input-field vendor-availability-date-input"
              value={availabilityEndDate}
              min={availabilityStartDate || undefined}
              onChange={e => setAvailabilityEndDate(e.target.value)}
              aria-label="Availability end date"
            />
          </div>
          <div className="vendor-availability-filter-caption">
            Show vendors available on at least one day in this range.
          </div>
        </div>
        <select className="select-field vendor-filter-select" value={budgetFilter} onChange={e=>setBudgetFilter(e.target.value)}>
          <option value="all">All Budgets</option>
          <option value="budget">Budget friendly</option>
          <option value="mid">Mid range</option>
          <option value="luxury">Luxury</option>
        </select>
        <div className="vendor-filter-summary">
          <span>{wishlistedVendorCount} wishlisted</span>
          <span>{filtered.length} vendors shown</span>
        </div>
      </div>
    </>
  );

  if (view === "my-vendors") {
    return (
      <>
        <div className="my-vendors-shell">
          <div className="section-head">
            <div className="my-vendors-title-wrap">
              <button type="button" className="my-vendors-back-btn" onClick={() => onBackToDirectory?.()}>←</button>
              <div>
                <div className="section-title">My Vendors</div>
                <div className="my-vendors-subtitle">
                  Manage wishlisted, booked, pending, cancelled, and private vendors tied to this wedding plan.
                </div>
              </div>
            </div>
            <button type="button" className="section-action my-vendors-add-btn" onClick={openAddVendor}>
              Add Private Vendor
            </button>
          </div>

          <div className="vendor-status-overview">
            {VENDOR_STATUSES.map(status => (
              <button
                key={status.id}
                type="button"
                className={`vendor-status-pill${myVendorStatusFilter === status.id ? " active" : ""}`}
                onClick={() => setMyVendorStatusFilter(current => current === status.id ? "all" : status.id)}
                aria-pressed={myVendorStatusFilter === status.id}
              >
                <strong>{myVendorCounts[status.id]}</strong>
                <span>{status.label}</span>
              </button>
            ))}
          </div>

          {myVendors.length === 0 ? (
            <EmptyMyVendorsState />
          ) : visibleMyVendors.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "24px 20px", margin: "0 16px 16px" }}>
              <div className="card-title" style={{ marginBottom: 8 }}>No {getStatusLabel(myVendorStatusFilter).toLowerCase()} vendors yet</div>
              <div className="card-sub">
                Try a different status filter or add a new private vendor.
              </div>
            </div>
          ) : (
            <div className="vendor-managed-grid">
              {visibleMyVendors.map(vendor => (
                <MyVendorCard
                  key={vendor.id}
                  vendor={vendor}
                  events={events}
                  onClick={() => openEditVendor(vendor)}
                />
              ))}
            </div>
          )}
        </div>

        {showVendorEditor && (
          <div className="modal-overlay" onClick={closeVendorEditor}>
            <div className="modal vendor-editor-modal" onClick={event => event.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">{editingVendor ? "Update Vendor" : "Add Private Vendor"}</div>

              <div className="vendor-editor-grid">
                <input
                  className="input-field"
                  placeholder="Vendor name"
                  value={vendorForm.name}
                  onChange={event => handleVendorFormChange("name", event.target.value)}
                />
                <select className="select-field" value={vendorForm.type} onChange={event => handleVendorFormChange("type", event.target.value)}>
                  <option value="">Vendor category</option>
                  {VENDOR_TYPES.filter(type => type !== "All").map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <select className="select-field" value={vendorForm.subType} onChange={event => handleVendorFormChange("subType", event.target.value)}>
                  <option value="">Subcategory</option>
                  {(VENDOR_SUBTYPE_OPTIONS[vendorForm.type] || []).map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <input
                  className="input-field"
                  placeholder="City"
                  value={vendorForm.city}
                  onChange={event => handleVendorFormChange("city", event.target.value)}
                />
              </div>

              <div className="vendor-editor-status-row">
                {VENDOR_STATUSES.map(status => (
                  <button
                    key={status.id}
                    type="button"
                    className={`vendor-editor-status-btn${vendorForm.status === status.id ? " active" : ""}`}
                    onClick={() => handleVendorFormChange("status", status.id)}
                  >
                    {status.label}
                  </button>
                ))}
              </div>

              {vendorForm.status === "booked" ? (
                <div className="vendor-editor-section">
                  <div className="vendor-editor-section-title">Contract Details</div>
                  <input
                    className="input-field"
                    inputMode="numeric"
                    placeholder="Total contract amount"
                    value={vendorForm.contractTotal}
                    onChange={event => handleVendorFormChange("contractTotal", event.target.value)}
                  />

                  <div className="vendor-linked-spend-card">
                    <div className="vendor-editor-section-title" style={{ marginBottom: 8 }}>Linked Spend</div>
                    <div className="vendor-editor-grid vendor-editor-grid-tight">
                      <input
                        className="input-field"
                        placeholder="Line item"
                        value={vendorForm.linkedSpendDraft.label}
                        onChange={event => setVendorForm(current => ({
                          ...current,
                          linkedSpendDraft: { ...current.linkedSpendDraft, label: event.target.value },
                        }))}
                      />
                      <input
                        className="input-field"
                        inputMode="numeric"
                        placeholder="Amount"
                        value={vendorForm.linkedSpendDraft.amount}
                        onChange={event => setVendorForm(current => ({
                          ...current,
                          linkedSpendDraft: { ...current.linkedSpendDraft, amount: event.target.value },
                        }))}
                      />
                      <select
                        className="select-field"
                        value={vendorForm.linkedSpendDraft.eventId}
                        onChange={event => setVendorForm(current => ({
                          ...current,
                          linkedSpendDraft: { ...current.linkedSpendDraft, eventId: event.target.value },
                        }))}
                      >
                        <option value="">General</option>
                        {events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                      </select>
                    </div>
                    <button type="button" className="btn-secondary vendor-linked-spend-add" onClick={addLinkedSpendItem}>
                      Add
                    </button>

                    {vendorForm.contractLineItems.length > 0 && (
                      <div className="vendor-linked-spend-list">
                        {vendorForm.contractLineItems.map(item => {
                          const ceremony = events.find(event => String(event.id) === String(item.eventId));
                          return (
                            <div key={item.id} className="vendor-linked-spend-item">
                              <div>
                                <div className="vendor-linked-spend-name">{item.label}</div>
                                <div className="vendor-linked-spend-meta">{fmt(item.amount)}{ceremony ? ` · ${ceremony.name}` : " · General"}</div>
                              </div>
                              <button type="button" className="vendor-linked-spend-delete" onClick={() => removeLinkedSpendItem(item.id)}>
                                Delete
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="vendor-linked-spend-summary">
                      <span>Linked total</span>
                      <strong>{fmt(linkedSpendTotal)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="vendor-editor-section">
                  <div className="vendor-editor-section-title">Price Range</div>
                  <div className="vendor-editor-grid vendor-editor-grid-tight">
                    <input
                      className="input-field"
                      inputMode="numeric"
                      placeholder="Minimum"
                      value={vendorForm.priceRangeMin}
                      onChange={event => handleVendorFormChange("priceRangeMin", event.target.value)}
                    />
                    <input
                      className="input-field"
                      inputMode="numeric"
                      placeholder="Maximum"
                      value={vendorForm.priceRangeMax}
                      onChange={event => handleVendorFormChange("priceRangeMax", event.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="vendor-editor-section">
                <div className="vendor-editor-section-title">Contact & Notes</div>
                <div className="vendor-editor-grid vendor-editor-grid-tight">
                  <input
                    className="input-field"
                    placeholder="Contact name"
                    value={vendorForm.contactName}
                    onChange={event => handleVendorFormChange("contactName", event.target.value)}
                  />
                  <input
                    className="input-field"
                    placeholder="Phone"
                    value={vendorForm.phone}
                    onChange={event => handleVendorFormChange("phone", event.target.value)}
                  />
                </div>
                <textarea
                  className="textarea-field"
                  placeholder="Notes"
                  value={vendorForm.notes}
                  onChange={event => handleVendorFormChange("notes", event.target.value)}
                  rows={4}
                  style={{ marginTop: 10 }}
                />
              </div>

              <div className="vendor-editor-actions">
                {editingVendor && (
                  <button type="button" className="btn-ghost vendor-editor-delete-btn" onClick={() => deleteVendor(editingVendor.id)}>
                    Delete Vendor
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={closeVendorEditor}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={saveVendor} disabled={!canSaveVendor}>
                  {editingVendor ? "Save Changes" : "Add Vendor"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      {selectedVendor && (
        <VendorDetailScreen
          key={selectedVendor.id}
          vendor={selectedVendor}
          availabilityRange={{ startDate: availabilityStartDate, endDate: availabilityEndDate }}
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
              <div key={t} className={`vendor-tab${activeTab===t?" active":""}`} onClick={() => { setActiveTab(t); setSubtypeFilter("all"); setBundledServiceFilter("all"); }}>{t}</div>
            ))}
          </div>
          {isMobileView ? (
            <div className="vendor-mobile-filter-row">
              <button
                type="button"
                className="vendor-mobile-filter-toggle"
                onClick={() => setShowMobileFilters(true)}
                aria-label="Open vendor filters"
              >
                <span />
                <span />
                <span />
                {activeFilterCount > 0 && <strong>{activeFilterCount}</strong>}
              </button>
              <div className="vendor-filter-summary vendor-filter-summary-mobile">
                <span>{wishlistedVendorCount} wishlisted</span>
                <span>{filtered.length} vendors shown</span>
              </div>
            </div>
          ) : filterControls}
          {isMobileView && showMobileFilters && (
            <div className="modal-overlay" onClick={() => setShowMobileFilters(false)}>
              <div className="modal vendor-mobile-filter-sheet" onClick={event => event.stopPropagation()}>
                <div className="modal-handle" />
                <div className="modal-title">Vendor Filters</div>
                {filterControls}
                <button type="button" className="btn-secondary" onClick={() => setShowMobileFilters(false)}>
                  Apply Filters
                </button>
              </div>
            </div>
          )}
          {filtered.length === 0 && (
            <div style={{textAlign:"center",padding:"8px 16px 14px",color:"var(--color-light-text)",fontSize:13}}>
              No vendors found for selected filters.
            </div>
          )}
          {filtered.map(v => {
            const quickFacts = getVendorQuickFacts(v);
            const availabilityMessage = (availabilityStartDate || availabilityEndDate) && v.availabilityMatch?.matchingDays?.length
              ? v.availabilityMatch.matchingDays.length === 1
                ? "Available on 1 selected day"
                : `Available on ${v.availabilityMatch.matchingDays.length} selected days`
              : "";

            return (
              <div className="vendor-card vendor-card-clickable" key={v.id} onClick={()=>setSelectedVendorId(v.id)}>
                <div className="vendor-top">
                  {String(v?.coverMediaUrl || v?.coverImageUrl || "").trim() ? (
                    <VendorCoverVisual
                      vendor={v}
                      alt={v.name}
                      style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div className="vendor-icon">{v.emoji}</div>
                  )}
                  <div className="vendor-info">
                    <div className="vendor-name">{v.name}</div>
                    <div className="vendor-type">{v.type}{v.subType ? ` · ${v.subType}` : ""}{v.city ? ` · ${v.city}` : ""}</div>
                    {v.featuredLabel && <div className="vendor-featured-chip">{v.featuredLabel}</div>}
                    {quickFacts.length > 0 && (
                      <div className="vendor-facts-row">
                        <div className="vendor-facts-inline">{quickFacts.join(" · ")}</div>
                      </div>
                    )}
                    {availabilityMessage && <div className="vendor-availability-match-chip">{availabilityMessage}</div>}
                    <div className="vendor-stars">{"★".repeat(v.rating || 0)}{"☆".repeat(5-(v.rating || 0))} <span style={{color:"var(--color-light-text)",fontSize:11}}>{v.rating ? `${v.rating}.0` : "No rating"}</span> <span style={{color:"var(--color-light-text)",fontSize:11}}>({v.reviewCount || 0} reviews)</span></div>
                  </div>
                  {v.status && v.status !== "directory" && (
                    <div className={`vendor-directory-status vendor-directory-status-${v.status}`}>{getStatusLabel(v.status)}</div>
                  )}
                </div>
                <div className="vendor-bottom">
                  <div className="vendor-price-wrap">
                    <div className="vendor-price">{formatVendorPriceTier(getVendorPriceLevel(v))}</div>
                    <div style={{fontSize:11,color:"var(--color-light-text)",marginTop:2}}>
                      {v.pricePerPlate ? `${v.pricePerPlate.toLocaleString("en-IN")}/plate` : formatVendorBudgetRange(v) || "Price on request"}
                    </div>
                  </div>
                  <div className="vendor-card-actions">
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
                    <div className="vendor-view-arrow">View Details →</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showVendorEditor && (
        <div className="modal-overlay" onClick={closeVendorEditor}>
          <div className="modal vendor-editor-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{editingVendor ? "Update Vendor" : "Add Private Vendor"}</div>

            <div className="vendor-editor-grid">
              <input
                className="input-field"
                placeholder="Vendor name"
                value={vendorForm.name}
                onChange={event => handleVendorFormChange("name", event.target.value)}
              />
              <select className="select-field" value={vendorForm.type} onChange={event => handleVendorFormChange("type", event.target.value)}>
                <option value="">Vendor category</option>
                {VENDOR_TYPES.filter(type => type !== "All").map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="select-field" value={vendorForm.subType} onChange={event => handleVendorFormChange("subType", event.target.value)}>
                <option value="">Subcategory</option>
                {(VENDOR_SUBTYPE_OPTIONS[vendorForm.type] || []).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <input
                className="input-field"
                placeholder="City"
                value={vendorForm.city}
                onChange={event => handleVendorFormChange("city", event.target.value)}
              />
            </div>

            <div className="vendor-editor-status-row">
              {VENDOR_STATUSES.map(status => (
                <button
                  key={status.id}
                  type="button"
                  className={`vendor-editor-status-btn${vendorForm.status === status.id ? " active" : ""}`}
                  onClick={() => handleVendorFormChange("status", status.id)}
                >
                  {status.label}
                </button>
              ))}
            </div>

            {vendorForm.status === "booked" ? (
              <div className="vendor-editor-section">
                <div className="vendor-editor-section-title">Contract Details</div>
                <input
                  className="input-field"
                  inputMode="numeric"
                  placeholder="Total contract amount"
                  value={vendorForm.contractTotal}
                  onChange={event => handleVendorFormChange("contractTotal", event.target.value)}
                />

                <div className="vendor-linked-spend-card">
                  <div className="vendor-editor-section-title" style={{ marginBottom: 8 }}>Linked Spend</div>
                  <div className="vendor-editor-grid vendor-editor-grid-tight">
                    <input
                      className="input-field"
                      placeholder="Line item"
                      value={vendorForm.linkedSpendDraft.label}
                      onChange={event => setVendorForm(current => ({
                        ...current,
                        linkedSpendDraft: { ...current.linkedSpendDraft, label: event.target.value },
                      }))}
                    />
                    <input
                      className="input-field"
                      inputMode="numeric"
                      placeholder="Amount"
                      value={vendorForm.linkedSpendDraft.amount}
                      onChange={event => setVendorForm(current => ({
                        ...current,
                        linkedSpendDraft: { ...current.linkedSpendDraft, amount: event.target.value },
                      }))}
                    />
                    <select
                      className="select-field"
                      value={vendorForm.linkedSpendDraft.eventId}
                      onChange={event => setVendorForm(current => ({
                        ...current,
                        linkedSpendDraft: { ...current.linkedSpendDraft, eventId: event.target.value },
                      }))}
                    >
                      <option value="">General</option>
                      {events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                    </select>
                  </div>
                  <button type="button" className="btn-secondary vendor-linked-spend-add" onClick={addLinkedSpendItem}>
                    Add
                  </button>

                  {vendorForm.contractLineItems.length > 0 && (
                    <div className="vendor-linked-spend-list">
                      {vendorForm.contractLineItems.map(item => {
                        const ceremony = events.find(event => String(event.id) === String(item.eventId));
                        return (
                          <div key={item.id} className="vendor-linked-spend-item">
                            <div>
                              <div className="vendor-linked-spend-name">{item.label}</div>
                              <div className="vendor-linked-spend-meta">{fmt(item.amount)}{ceremony ? ` · ${ceremony.name}` : " · General"}</div>
                            </div>
                            <button type="button" className="vendor-linked-spend-delete" onClick={() => removeLinkedSpendItem(item.id)}>
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="vendor-linked-spend-summary">
                    <span>Linked total</span>
                    <strong>{fmt(linkedSpendTotal)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="vendor-editor-section">
                <div className="vendor-editor-section-title">Price Range</div>
                <div className="vendor-editor-grid vendor-editor-grid-tight">
                  <input
                    className="input-field"
                    inputMode="numeric"
                    placeholder="Minimum price"
                    value={vendorForm.priceRangeMin}
                    onChange={event => handleVendorFormChange("priceRangeMin", event.target.value)}
                  />
                  <input
                    className="input-field"
                    inputMode="numeric"
                    placeholder="Maximum price"
                    value={vendorForm.priceRangeMax}
                    onChange={event => handleVendorFormChange("priceRangeMax", event.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="vendor-editor-grid">
              <input
                className="input-field"
                placeholder="Contact name"
                value={vendorForm.contactName}
                onChange={event => handleVendorFormChange("contactName", event.target.value)}
              />
              <input
                className="input-field"
                placeholder="Phone"
                value={vendorForm.phone}
                onChange={event => handleVendorFormChange("phone", event.target.value)}
              />
            </div>
            <textarea
              className="input-field"
              rows="3"
              placeholder="Notes"
              value={vendorForm.notes}
              onChange={event => handleVendorFormChange("notes", event.target.value)}
              style={{ resize: "vertical", marginTop: 12 }}
            />

            <div className="vendor-editor-actions">
              {editingVendor && (
                <button type="button" className="btn-secondary vendor-editor-delete-btn" onClick={() => deleteVendor(editingVendor.id)}>
                  Delete Vendor
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={closeVendorEditor}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveVendor} disabled={!canSaveVendor}>
                Save Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorsScreen;
