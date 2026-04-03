const PRIMARY_VENDOR_MEDIA_BASE = new URL("https://media.vivahgo.com/portfolio/");
const FALLBACK_VENDOR_MEDIA_BASE = new URL("https://pub-47c8cf1fe5da4a1b89c93045916376d7.r2.dev/");

export function formatVendorPriceTier(priceLevel = 1) {
  const normalizedLevel = Math.min(Math.max(Number(priceLevel) || 1, 1), 4);
  return `${"₹".repeat(normalizedLevel)}`;
}

export function getVendorPriceLevel(vendor) {
  const explicitLevel = Number(vendor?.priceLevel);
  if (Number.isFinite(explicitLevel) && explicitLevel > 0) {
    return Math.min(Math.max(Math.round(explicitLevel), 1), 4);
  }

  const minPrice = Number(vendor?.budgetRange?.min);
  if (!Number.isFinite(minPrice) || minPrice <= 0) {
    return 1;
  }

  if (minPrice <= 100000) return 1;
  if (minPrice <= 350000) return 2;
  if (minPrice <= 1000000) return 3;
  return 4;
}

export function formatVendorCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatVendorGuestRange(vendor) {
  const minGuests = vendor?.guestRange?.min;
  const maxGuests = vendor?.guestRange?.max;

  if (!Number.isFinite(minGuests) || !Number.isFinite(maxGuests)) {
    return "";
  }

  return `${minGuests}-${maxGuests} guests`;
}

export function formatVendorBudgetRange(vendor) {
  const minBudget = Number(vendor?.budgetRange?.min);
  const maxBudget = Number(vendor?.budgetRange?.max);

  if (!Number.isFinite(minBudget) || !Number.isFinite(maxBudget)) {
    return "";
  }

  return `${formatVendorCurrency(minBudget)}-${formatVendorCurrency(maxBudget)}`;
}

export function formatVendorPricePerPlate(vendor) {
  const perPlate = Number(vendor?.pricePerPlate);

  if (!Number.isFinite(perPlate) || perPlate <= 0) {
    return "";
  }

  return `${formatVendorCurrency(perPlate)}/plate`;
}

export function getVendorQuickFacts(vendor) {
  return [
    vendor?.featuredLabel,
    formatVendorPricePerPlate(vendor),
    formatVendorGuestRange(vendor),
    vendor?.serviceMode,
    vendor?.typicalTiming,
  ].filter(Boolean);
}

export function getVendorMediaFallbackUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  let mediaUrl;
  try {
    mediaUrl = new URL(url);
  } catch {
    return "";
  }

  const primaryPath = PRIMARY_VENDOR_MEDIA_BASE.pathname.endsWith("/")
    ? PRIMARY_VENDOR_MEDIA_BASE.pathname
    : `${PRIMARY_VENDOR_MEDIA_BASE.pathname}/`;

  if (mediaUrl.origin !== PRIMARY_VENDOR_MEDIA_BASE.origin || !mediaUrl.pathname.startsWith(primaryPath)) {
    return "";
  }

  const objectKey = decodeURIComponent(mediaUrl.pathname.slice(primaryPath.length));
  if (!objectKey) {
    return "";
  }

  return new URL(objectKey, FALLBACK_VENDOR_MEDIA_BASE).toString();
}
