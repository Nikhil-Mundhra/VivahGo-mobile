import { useEffect, useMemo, useState } from "react";
import { BUNDLED_SERVICE_OPTIONS, VENDOR_SUBTYPE_OPTIONS, VENDOR_TYPES } from "../../../constants";
import { formatVendorBudgetRange, formatVendorPriceTier, getVendorPriceLevel, getVendorQuickFacts } from "../../vendor/lib/vendorFormatting.js";
import VendorDetailScreen from "../../vendor/components/VendorDetailScreen.jsx";
import { fetchApprovedVendors } from "../../vendor/api.js";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";
import { getVendorAvailabilityMatch } from "../../../vendorAvailability";
import { FallbackImage, FallbackVideo } from "../../../components/MediaWithFallback.jsx";

const VENDOR_FILTERS_SESSION_KEY = "vivahgo.vendorFilters";
const PRIVATE_VENDOR_TYPES = VENDOR_TYPES.filter((type) => type !== "All");
const PRIVATE_VENDOR_INITIAL_FORM = {
  name: "",
  type: PRIVATE_VENDOR_TYPES[0] || "Venue",
  subType: "",
  phone: "",
  city: "",
  budgetMin: "",
  budgetMax: "",
  notes: "",
  status: "booked",
};
const LEGACY_VENDOR_TYPE_ALIASES = {
  Bride: "Bridal & Pre-Bridal",
  Groom: "Groom Services",
};

function normalizeVendorType(type) {
  return LEGACY_VENDOR_TYPE_ALIASES[type] || type;
}

function createPlannerVendorId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `planner_vendor_${globalThis.crypto.randomUUID()}`;
  }

  return `planner_vendor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

function normalizePrivateVendorBudgetRange({ budgetMin, budgetMax }) {
  const min = Number(budgetMin);
  const max = Number(budgetMax);

  if (!Number.isFinite(min) && !Number.isFinite(max)) {
    return null;
  }

  const safeMin = Number.isFinite(min) && min > 0 ? Math.round(min) : Math.round(max);
  const safeMax = Number.isFinite(max) && max > 0 ? Math.round(max) : Math.round(min);
  const normalizedMin = Math.max(0, Math.min(safeMin || 0, safeMax || safeMin || 0));
  const normalizedMax = Math.max(normalizedMin, safeMax || normalizedMin);

  if (!normalizedMin || !normalizedMax) {
    return null;
  }

  return {
    min: normalizedMin,
    max: normalizedMax,
  };
}

function isAllowedFilterValue(value, allowedValues, fallbackValue = "all") {
  if (value === fallbackValue) {
    return true;
  }

  return allowedValues.includes(value);
}

function buildPlannerVendorRecord(vendor, marketplaceVendorById, fallbackIndex) {
  const vendorId = String(vendor?.id || "").trim();
  const matchedMarketplaceVendor = vendorId ? marketplaceVendorById.get(vendorId) : null;

  if (matchedMarketplaceVendor) {
    return {
      ...matchedMarketplaceVendor,
      ...vendor,
      id: vendorId,
      booked: Boolean(vendor?.booked),
      notes: typeof vendor?.notes === "string" ? vendor.notes.trim() : "",
      isPrivateVendor: Boolean(vendor?.isPrivateVendor),
      vendorSource: vendor?.vendorSource || (vendor?.isPrivateVendor ? "private" : "directory"),
      isMarketplaceVendor: true,
    };
  }

  const normalizedType = normalizeVendorType(vendor?.type || "");
  const normalizedMedia = Array.isArray(vendor?.media) ? vendor.media : [];
  const coverMedia = normalizedMedia.find(item => item?.isCover) || normalizedMedia[0] || null;

  return {
    id: vendorId || `planner_vendor_fallback_${fallbackIndex}`,
    name: String(vendor?.name || vendor?.businessName || "Untitled vendor").trim() || "Untitled vendor",
    type: normalizedType || "Vendor",
    subType: String(vendor?.subType || "").trim(),
    bundledServices: Array.isArray(vendor?.bundledServices) ? vendor.bundledServices.map(normalizeVendorType) : [],
    description: String(vendor?.description || vendor?.notes || "").trim(),
    country: String(vendor?.country || "").trim(),
    state: String(vendor?.state || "").trim(),
    city: String(vendor?.city || "").trim(),
    googleMapsLink: String(vendor?.googleMapsLink || "").trim(),
    phone: String(vendor?.phone || "").trim(),
    website: String(vendor?.website || "").trim(),
    whatsappNumber: String(vendor?.phone || "").replace(/\D+/g, ""),
    availabilitySettings: vendor?.availabilitySettings || {
      hasDefaultCapacity: false,
      defaultMaxCapacity: 0,
      dateOverrides: [],
    },
    emoji: vendor?.isPrivateVendor ? "🗂️" : (vendor?.emoji || "🏷️"),
    rating: Number(vendor?.rating || 0),
    reviewCount: Number(vendor?.reviewCount || 0),
    priceLevel: Number.isFinite(Number(vendor?.priceLevel)) ? Number(vendor.priceLevel) : null,
    booked: Boolean(vendor?.booked),
    budgetRange: vendor?.budgetRange && typeof vendor.budgetRange === "object" ? vendor.budgetRange : null,
    locations: [vendor?.city, vendor?.state, vendor?.country].filter(Boolean),
    media: normalizedMedia,
    coverMediaUrl: String(vendor?.coverMediaUrl || vendor?.coverImageUrl || coverMedia?.url || "").trim(),
    coverMediaType: String(vendor?.coverMediaType || (vendor?.coverImageUrl ? "IMAGE" : (coverMedia?.type || ""))).trim().toUpperCase(),
    coverImageUrl: String(vendor?.coverImageUrl || "").trim(),
    tier: String(vendor?.tier || "").trim(),
    featuredLabel: String(vendor?.featuredLabel || "").trim(),
    serviceMode: vendor?.isPrivateVendor ? "Private wedding vendor" : String(vendor?.serviceMode || "").trim(),
    isChoiceProfile: Boolean(vendor?.isChoiceProfile),
    isPrivateVendor: Boolean(vendor?.isPrivateVendor),
    isMarketplaceVendor: !vendor?.isPrivateVendor,
    vendorSource: vendor?.vendorSource || (vendor?.isPrivateVendor ? "private" : "directory"),
    notes: String(vendor?.notes || "").trim(),
    createdAt: vendor?.createdAt || "",
    wishlist: false,
    reviews: Array.isArray(vendor?.reviews) ? vendor.reviews : [],
  };
}

function renderVendorStars(vendor) {
  const rating = Math.max(0, Math.min(5, Number(vendor?.rating) || 0));
  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

function VendorCoverVisual({ vendor, className, style, alt }) {
  const coverMediaUrl = String(vendor?.coverMediaUrl || vendor?.coverImageUrl || "").trim();
  const coverMediaType = String(vendor?.coverMediaType || (vendor?.coverImageUrl ? "IMAGE" : "")).trim().toUpperCase();

  if (!coverMediaUrl) {
    return <div className="vendor-icon">{vendor?.emoji}</div>;
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

function MyVendorCard({ vendor }) {
  const quickFacts = getVendorQuickFacts(vendor);
  const statusLabel = vendor.booked ? "Booked" : "Not booked yet";
  const sourceLabel = vendor.isPrivateVendor ? "Private vendor" : "Directory vendor";
  const notes = String(vendor.notes || "").trim();

  return (
    <div className="my-vendors-card">
      <div className="my-vendors-card-top">
        {String(vendor?.coverMediaUrl || vendor?.coverImageUrl || "").trim() ? (
          <VendorCoverVisual
            vendor={vendor}
            alt={vendor.name}
            className="my-vendors-card-image"
          />
        ) : (
          <div className="my-vendors-card-icon">{vendor.emoji}</div>
        )}
        <div className="my-vendors-card-body">
          <div className="my-vendors-card-head">
            <div>
              <div className="my-vendors-card-name">{vendor.name}</div>
              <div className="my-vendors-card-meta">
                {vendor.type}
                {vendor.subType ? ` · ${vendor.subType}` : ""}
                {vendor.city ? ` · ${vendor.city}` : ""}
              </div>
            </div>
            <div className={`my-vendors-status-pill${vendor.booked ? " is-booked" : ""}`}>
              {statusLabel}
            </div>
          </div>
          <div className="my-vendors-chip-row">
            <span className="my-vendors-source-pill">{sourceLabel}</span>
            {vendor.featuredLabel && <span className="vendor-featured-chip">{vendor.featuredLabel}</span>}
          </div>
          {(quickFacts.length > 0 || formatVendorBudgetRange(vendor)) && (
            <div className="my-vendors-card-copy">
              {[...quickFacts, formatVendorBudgetRange(vendor)].filter(Boolean).join(" · ")}
            </div>
          )}
          {notes && <div className="my-vendors-card-notes">{notes}</div>}
          {(vendor.phone || vendor.reviewCount) && (
            <div className="my-vendors-card-foot">
              {vendor.phone && <span>{vendor.phone}</span>}
              {vendor.reviewCount > 0 && (
                <span>{renderVendorStars(vendor)} ({vendor.reviewCount})</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyMyVendorsState() {
  return (
    <div className="my-vendors-empty">
      <div className="my-vendors-empty-title">No vendors are linked to this wedding yet.</div>
      <p>
        Use Vendor Directory to discover suppliers, then keep your wedding-specific vendors here. Private vendors you add
        from this page stay inside this plan and do not get published to the marketplace.
      </p>
    </div>
  );
}

function PrivateVendorForm({
  draft,
  error,
  onBack,
  onChange,
  onSubmit,
}) {
  const subtypeOptions = VENDOR_SUBTYPE_OPTIONS[draft.type] || [];

  return (
    <div className="my-vendor-form-shell">
      <div className="vendor-detail-header">
        <button type="button" className="vendor-detail-back" onClick={onBack}>←</button>
        <div className="vendor-detail-header-title">Add Private Vendor</div>
      </div>

      <div className="my-vendor-form-intro">
        Track a vendor inside this wedding plan without publishing them to VivahGo&apos;s directory.
      </div>

      <div className="my-vendor-form-card">
        <div className="input-group">
          <div className="input-label">Vendor Name *</div>
          <input
            className="input-field"
            value={draft.name}
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="e.g. Khanna Family Caterers"
          />
        </div>

        <div className="my-vendor-form-grid">
          <div className="input-group">
            <div className="input-label">Category *</div>
            <select
              className="select-field"
              value={draft.type}
              onChange={(event) => onChange("type", event.target.value)}
            >
              {VENDOR_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <div className="input-label">Status *</div>
            <select
              className="select-field"
              value={draft.status}
              onChange={(event) => onChange("status", event.target.value)}
            >
              <option value="booked">Booked</option>
              <option value="pending">Not booked yet</option>
            </select>
          </div>
        </div>

        {subtypeOptions.length > 0 && (
          <div className="input-group">
            <div className="input-label">Subcategory</div>
            <select
              className="select-field"
              value={draft.subType}
              onChange={(event) => onChange("subType", event.target.value)}
            >
              <option value="">Select a subcategory</option>
              {subtypeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}

        <div className="my-vendor-form-grid">
          <div className="input-group">
            <div className="input-label">Phone</div>
            <input
              className="input-field"
              value={draft.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>
          <div className="input-group">
            <div className="input-label">City</div>
            <input
              className="input-field"
              value={draft.city}
              onChange={(event) => onChange("city", event.target.value)}
              placeholder="e.g. Jaipur"
            />
          </div>
        </div>

        <div className="my-vendor-form-grid">
          <div className="input-group">
            <div className="input-label">Budget Min</div>
            <input
              type="number"
              min="0"
              className="input-field"
              value={draft.budgetMin}
              onChange={(event) => onChange("budgetMin", event.target.value)}
              placeholder="e.g. 50000"
            />
          </div>
          <div className="input-group">
            <div className="input-label">Budget Max</div>
            <input
              type="number"
              min="0"
              className="input-field"
              value={draft.budgetMax}
              onChange={(event) => onChange("budgetMax", event.target.value)}
              placeholder="e.g. 150000"
            />
          </div>
        </div>

        <div className="input-group">
          <div className="input-label">Notes</div>
          <textarea
            className="input-field my-vendor-form-textarea"
            rows={4}
            value={draft.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            placeholder="Add booking notes, deliverables, or who owns communication."
          />
        </div>

        {error && <div className="my-vendor-form-error">{error}</div>}

        <button type="button" className="btn-primary" onClick={onSubmit}>
          Save Private Vendor
        </button>
        <button type="button" className="btn-secondary" onClick={onBack}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function VendorsScreen({ vendors, setVendors, view = "directory", onBackToDirectory }) {
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
  const [wishlistIds, setWishlistIds] = useState([]);
  const [vendorReviews, setVendorReviews] = useState({});
  const [dbVendors, setDbVendors] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showPrivateVendorForm, setShowPrivateVendorForm] = useState(false);
  const [privateVendorDraft, setPrivateVendorDraft] = useState(PRIVATE_VENDOR_INITIAL_FORM);
  const [privateVendorError, setPrivateVendorError] = useState("");
  const [myVendorsFilter, setMyVendorsFilter] = useState(null);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );

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
      activeTab: activeTab !== "All" && !VENDOR_TYPES.includes(activeTab) ? "All" : activeTab,
      locationFilter,
      subtypeFilter,
      bundledServiceFilter,
      ratingFilter,
      budgetFilter,
      priceSort,
      availabilityStartDate,
      availabilityEndDate: availabilityStartDate && availabilityEndDate && availabilityStartDate > availabilityEndDate
        ? ""
        : availabilityEndDate,
    }));
  }, [activeTab, availabilityEndDate, availabilityStartDate, budgetFilter, bundledServiceFilter, locationFilter, priceSort, ratingFilter, subtypeFilter]);

  const normalizedActiveTab = activeTab !== "All" && !VENDOR_TYPES.includes(activeTab) ? "All" : activeTab;
  const effectiveSelectedVendorId = view === "directory" ? selectedVendorId : null;
  const isMobileFiltersOpen = view === "directory" ? showMobileFilters : false;
  const isPrivateVendorFormOpen = view === "my-vendors" ? showPrivateVendorForm : false;
  const normalizedAvailabilityEndDate = availabilityStartDate && availabilityEndDate && availabilityStartDate > availabilityEndDate
    ? ""
    : availabilityEndDate;

  useBackButtonClose(isMobileFiltersOpen, () => setShowMobileFilters(false));
  useBackButtonClose(view === "my-vendors", () => {
    if (isPrivateVendorFormOpen) {
      setShowPrivateVendorForm(false);
      setPrivateVendorError("");
      setPrivateVendorDraft(PRIVATE_VENDOR_INITIAL_FORM);
      return;
    }

    onBackToDirectory?.();
  });

  useEffect(() => {
    fetchApprovedVendors()
      .then(data => {
        setDbVendors(Array.isArray(data?.vendors) ? data.vendors : []);
      })
      .catch(() => {
        setDbVendors([]);
      });
  }, []);

  const bookedById = useMemo(
    () => new Map((Array.isArray(vendors) ? vendors : []).map(v => [String(v.id), Boolean(v.booked)])),
    [vendors]
  );

  const universalVendors = useMemo(() => {
    return dbVendors.map(v => ({
      ...v,
      booked: bookedById.get(String(v.id)) ?? false,
      isMarketplaceVendor: true,
    }));
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

  const marketplaceVendorById = useMemo(
    () => new Map(hydratedVendors.map(vendor => [String(vendor.id), vendor])),
    [hydratedVendors]
  );

  const plannerVendors = useMemo(
    () => (Array.isArray(vendors) ? vendors : []).map((vendor, index) => (
      buildPlannerVendorRecord(vendor, marketplaceVendorById, index)
    )),
    [marketplaceVendorById, vendors]
  );

  const bookedPlannerVendors = useMemo(
    () => plannerVendors.filter(vendor => vendor.booked),
    [plannerVendors]
  );

  const privatePlannerVendors = useMemo(
    () => plannerVendors.filter(vendor => vendor.isPrivateVendor),
    [plannerVendors]
  );

  const bookedPrivatePlannerVendors = useMemo(
    () => privatePlannerVendors.filter(vendor => vendor.booked),
    [privatePlannerVendors]
  );

  const pendingPrivatePlannerVendors = useMemo(
    () => privatePlannerVendors.filter(vendor => !vendor.booked),
    [privatePlannerVendors]
  );

  const filteredMyVendors = useMemo(() => {
    if (myVendorsFilter === "booked") {
      return bookedPlannerVendors;
    }
    if (myVendorsFilter === "private") {
      return privatePlannerVendors;
    }
    if (myVendorsFilter === "pending-private") {
      return pendingPrivatePlannerVendors;
    }
    return plannerVendors;
  }, [bookedPlannerVendors, myVendorsFilter, pendingPrivatePlannerVendors, plannerVendors, privatePlannerVendors]);

  const availableCities = useMemo(
    () => Array.from(new Set(hydratedVendors.map(v => v.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [hydratedVendors]
  );

  const availableSubtypes = useMemo(() => {
    if (normalizedActiveTab !== "All") {
      return VENDOR_SUBTYPE_OPTIONS[normalizedActiveTab] || [];
    }

    return Array.from(new Set(hydratedVendors.map(v => v.subType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [hydratedVendors, normalizedActiveTab]);

  const normalizedLocationFilter = isAllowedFilterValue(locationFilter, availableCities) ? locationFilter : "all";
  const normalizedSubtypeFilter = isAllowedFilterValue(subtypeFilter, availableSubtypes) ? subtypeFilter : "all";
  const allowedBundledServices = useMemo(
    () => BUNDLED_SERVICE_OPTIONS.filter(option => option !== normalizedActiveTab),
    [normalizedActiveTab]
  );
  const normalizedBundledServiceFilter = isAllowedFilterValue(bundledServiceFilter, allowedBundledServices)
    ? bundledServiceFilter
    : "all";
  const normalizedRatingFilter = ["all", "3", "4", "5"].includes(String(ratingFilter)) ? String(ratingFilter) : "all";
  const normalizedBudgetFilter = ["all", "budget", "mid", "luxury"].includes(String(budgetFilter)) ? String(budgetFilter) : "all";
  const normalizedPriceSort = ["none", "low-high", "high-low", "rating"].includes(String(priceSort)) ? String(priceSort) : "none";

  const filtered = hydratedVendors
    .map(vendor => ({
      ...vendor,
      availabilityMatch: getVendorAvailabilityMatch(vendor, availabilityStartDate, normalizedAvailabilityEndDate),
    }))
    .filter(v => normalizedActiveTab === "All" ? true : v.type === normalizedActiveTab)
    .filter(v => normalizedSubtypeFilter === "all" ? true : v.subType === normalizedSubtypeFilter)
    .filter(v => normalizedBundledServiceFilter === "all" ? true : Array.isArray(v.bundledServices) && v.bundledServices.includes(normalizedBundledServiceFilter))
    .filter(v => normalizedLocationFilter === "all" ? true : v.city === normalizedLocationFilter)
    .filter(v => normalizedRatingFilter === "all" ? true : Number(v.rating) >= Number(normalizedRatingFilter))
    .filter(v => v.availabilityMatch?.isMatch !== false)
    .filter(v => {
      if (normalizedBudgetFilter === "all") return true;
      const maxBudget = Number(v?.budgetRange?.max || 0);
      if (!maxBudget) return normalizedBudgetFilter === "luxury";
      if (normalizedBudgetFilter === "budget") return maxBudget <= 100000;
      if (normalizedBudgetFilter === "mid") return maxBudget > 100000 && maxBudget <= 350000;
      return maxBudget > 350000;
    })
    .sort((a, b) => {
      if (normalizedPriceSort === "low-high") {
        return getVendorPriceLevel(a) - getVendorPriceLevel(b);
      }
      if (normalizedPriceSort === "high-low") {
        return getVendorPriceLevel(b) - getVendorPriceLevel(a);
      }
      if (normalizedPriceSort === "rating") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
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
    () => filtered.find(v => v.id === effectiveSelectedVendorId) || hydratedVendors.find(v => v.id === effectiveSelectedVendorId) || null,
    [effectiveSelectedVendorId, filtered, hydratedVendors]
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

  function updatePrivateVendorDraft(field, value) {
    setPrivateVendorDraft(current => {
      if (field === "type") {
        const nextSubtypeOptions = VENDOR_SUBTYPE_OPTIONS[value] || [];
        return {
          ...current,
          type: value,
          subType: nextSubtypeOptions.includes(current.subType) ? current.subType : "",
        };
      }

      return {
        ...current,
        [field]: value,
      };
    });
  }

  function handlePrivateVendorSave() {
    const trimmedName = privateVendorDraft.name.trim();
    if (!trimmedName) {
      setPrivateVendorError("Vendor name is required.");
      return;
    }

    const budgetRange = normalizePrivateVendorBudgetRange(privateVendorDraft);
    const nextVendor = {
      id: createPlannerVendorId(),
      name: trimmedName,
      type: privateVendorDraft.type,
      subType: privateVendorDraft.subType,
      phone: privateVendorDraft.phone.trim(),
      city: privateVendorDraft.city.trim(),
      budgetRange,
      notes: privateVendorDraft.notes.trim(),
      booked: privateVendorDraft.status === "booked",
      isPrivateVendor: true,
      vendorSource: "private",
      createdAt: new Date().toISOString(),
    };

    setVendors?.(current => [...current, nextVendor]);
    setPrivateVendorDraft(PRIVATE_VENDOR_INITIAL_FORM);
    setPrivateVendorError("");
    setShowPrivateVendorForm(false);
  }

  const activeFilterCount = [
    normalizedLocationFilter,
    normalizedSubtypeFilter,
    normalizedBundledServiceFilter,
    normalizedRatingFilter,
    normalizedBudgetFilter,
    normalizedPriceSort,
    availabilityStartDate,
    normalizedAvailabilityEndDate,
  ].filter(value => value !== "all" && value !== "none" && value !== "").length;

  const filterControls = (
    <>
      <div className="vendor-filter-grid vendor-filter-grid-primary">
        <select className="select-field vendor-filter-select" value={normalizedSubtypeFilter} onChange={e=>setSubtypeFilter(e.target.value)}>
          <option value="all">{normalizedActiveTab === "All" ? "All Subcategories" : `${normalizedActiveTab} Subcategories`}</option>
          {availableSubtypes.map(subtype => <option key={subtype} value={subtype}>{subtype}</option>)}
        </select>
        <select className="select-field vendor-filter-select" value={normalizedLocationFilter} onChange={e=>setLocationFilter(e.target.value)}>
          <option value="all">All Locations</option>
          {availableCities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
        <select className="select-field vendor-filter-select" value={normalizedBundledServiceFilter} onChange={e=>setBundledServiceFilter(e.target.value)}>
          <option value="all">Also Offers</option>
          {allowedBundledServices.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className="select-field vendor-filter-select" value={normalizedRatingFilter} onChange={e=>setRatingFilter(e.target.value)}>
          <option value="all">Any Rating</option>
          <option value="5">5★ & up</option>
          <option value="4">4★ & up</option>
          <option value="3">3★ & up</option>
        </select>
        <select className="select-field vendor-filter-select" value={normalizedPriceSort} onChange={e=>setPriceSort(e.target.value)}>
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
            {(availabilityStartDate || normalizedAvailabilityEndDate) && (
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
              value={normalizedAvailabilityEndDate}
              min={availabilityStartDate || undefined}
              onChange={e => setAvailabilityEndDate(e.target.value)}
              aria-label="Availability end date"
            />
          </div>
          <div className="vendor-availability-filter-caption">
            Show vendors available on at least one day in this range.
          </div>
        </div>
        <select className="select-field vendor-filter-select" value={normalizedBudgetFilter} onChange={e=>setBudgetFilter(e.target.value)}>
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
    </>
  );

  if (showPrivateVendorForm) {
    return (
      <PrivateVendorForm
        draft={privateVendorDraft}
        error={privateVendorError}
        onBack={() => {
          setShowPrivateVendorForm(false);
          setPrivateVendorError("");
        }}
        onChange={updatePrivateVendorDraft}
        onSubmit={handlePrivateVendorSave}
      />
    );
  }

  if (view === "my-vendors") {
    const hasAnyPlannerVendor = plannerVendors.length > 0;

    return (
      <div className="my-vendors-shell">
        <div className="section-head">
          <div className="my-vendors-title-wrap">
            <button type="button" className="my-vendors-back-btn" onClick={onBackToDirectory}>←</button>
            <div>
              <div className="section-title">My Vendors</div>
              <div className="my-vendors-subtitle">
                Keep the vendors tied to this wedding here. Use Vendor Directory separately for discovery.
              </div>
            </div>
          </div>
          <button type="button" className="section-action my-vendors-add-btn" onClick={() => setShowPrivateVendorForm(true)}>
            Add Private Vendor
          </button>
        </div>

        <div className="my-vendors-summary-grid">
          <div
            className="my-vendors-summary-card"
            onClick={() => setMyVendorsFilter(current => current === "booked" ? null : "booked")}
            style={{ cursor: "pointer", outline: myVendorsFilter === "booked" ? "2px solid #2E7D32" : "none" }}
          >
            <div className="my-vendors-summary-label">Booked Vendors</div>
            <div className="my-vendors-summary-value" style={{ color: "#2E7D32" }}>{bookedPlannerVendors.length}</div>
          </div>
          <div
            className="my-vendors-summary-card"
            onClick={() => setMyVendorsFilter(current => current === "private" ? null : "private")}
            style={{ cursor: "pointer", outline: myVendorsFilter === "private" ? "2px solid var(--color-crimson)" : "none" }}
          >
            <div className="my-vendors-summary-label">Private Vendors</div>
            <div className="my-vendors-summary-value">{privatePlannerVendors.length}</div>
          </div>
          <div
            className="my-vendors-summary-card"
            onClick={() => setMyVendorsFilter(current => current === "pending-private" ? null : "pending-private")}
            style={{ cursor: "pointer", outline: myVendorsFilter === "pending-private" ? "2px solid #F57F17" : "none" }}
          >
            <div className="my-vendors-summary-label">Pending Private</div>
            <div className="my-vendors-summary-value" style={{ color: "#F57F17" }}>{pendingPrivatePlannerVendors.length}</div>
          </div>
        </div>

        {!hasAnyPlannerVendor && <EmptyMyVendorsState />}

        {filteredMyVendors.length === 0 && hasAnyPlannerVendor && (
          <div className="my-vendors-empty">
            <div className="my-vendors-empty-title">No vendors match this filter.</div>
            <p>Try a different view to see the rest of the vendors linked to this wedding.</p>
          </div>
        )}

        {(myVendorsFilter === null || myVendorsFilter === "booked") && bookedPlannerVendors.length > 0 && (
          <div className="my-vendors-section">
            <div className="my-vendors-section-head">
              <h3>Booked for This Wedding</h3>
              <span>{bookedPlannerVendors.length}</span>
            </div>
            <div className="my-vendors-list">
              {bookedPlannerVendors.map(vendor => <MyVendorCard key={`booked-${vendor.id}`} vendor={vendor} />)}
            </div>
          </div>
        )}

        {(myVendorsFilter === null || myVendorsFilter === "private" || myVendorsFilter === "pending-private") && privatePlannerVendors.length > 0 && (
          <div className="my-vendors-section">
            <div className="my-vendors-section-head">
              <h3>Private Vendors</h3>
              <span>{privatePlannerVendors.length}</span>
            </div>
            <div className="my-vendors-section-copy">
              These are planner-only vendors created inside this wedding plan. They are not published to the public directory.
            </div>

            {bookedPrivatePlannerVendors.length > 0 && (
              <>
                <div className="my-vendors-subsection-title">Private vendors already booked</div>
                <div className="my-vendors-list">
                  {bookedPrivatePlannerVendors.map(vendor => <MyVendorCard key={`private-booked-${vendor.id}`} vendor={vendor} />)}
                </div>
              </>
            )}

            {pendingPrivatePlannerVendors.length > 0 && (
              <>
                <div className="my-vendors-subsection-title">Private vendors not booked yet</div>
                <div className="my-vendors-list">
                  {pendingPrivatePlannerVendors.map(vendor => <MyVendorCard key={`private-pending-${vendor.id}`} vendor={vendor} />)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
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
              <div key={t} className={`vendor-tab${normalizedActiveTab===t?" active":""}`} onClick={() => { setActiveTab(t); setSubtypeFilter("all"); setBundledServiceFilter("all"); }}>{t}</div>
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
                <span>{wishlistIds.length} wishlisted</span>
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
              {hydratedVendors.length > 0 && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="vendor-inline-reset-btn"
                    onClick={() => {
                      setActiveTab("All");
                      setLocationFilter("all");
                      setSubtypeFilter("all");
                      setBundledServiceFilter("all");
                      setRatingFilter("all");
                      setBudgetFilter("all");
                      setPriceSort("none");
                      setAvailabilityStartDate("");
                      setAvailabilityEndDate("");
                    }}
                  >
                    Reset filters
                  </button>
                </>
              )}
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
                  {v.booked && <div style={{background:"#E8F5E9",color:"#2E7D32",padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:600,alignSelf:"flex-start"}}>Booked ✓</div>}
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
    </div>
  );
}

export default VendorsScreen;
