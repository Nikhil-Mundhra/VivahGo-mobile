export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export function fmt(num) {
  if (!num) return "₹0";
  return "₹" + Number(num).toLocaleString("en-IN");
}

export function initials(name) {
  return name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
}

export function formatVendorPriceTier(priceLevel = 1) {
  const normalizedLevel = Math.min(Math.max(Number(priceLevel) || 1, 1), 4);
  return `${"₹".repeat(normalizedLevel)}`;
}

export function formatVendorGuestRange(vendor) {
  const minGuests = vendor?.guestRange?.min;
  const maxGuests = vendor?.guestRange?.max;

  if (!Number.isFinite(minGuests) || !Number.isFinite(maxGuests)) {
    return "";
  }

  return `${minGuests}-${maxGuests} guests`;
}

export function getVendorQuickFacts(vendor) {
  return [formatVendorGuestRange(vendor), vendor?.typicalTiming].filter(Boolean);
}

const PRIMARY_VENDOR_MEDIA_BASE = new URL("https://media.vivahgo.com/portfolio/");
const FALLBACK_VENDOR_MEDIA_BASE = new URL("https://pub-47c8cf1fe5da4a1b89c93045916376d7.r2.dev/");

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

// Validation functions for onboarding
export function validateOnboardingAnswer(key, value) {
  const trimmedValue = value.trim();

  switch (key) {
    case 'bride':
    case 'groom':
    case 'venue': {
      if (!trimmedValue) {
        return { isValid: false, message: "This field cannot be empty. Please provide an answer." };
      }
      if (trimmedValue.length < 2) {
        return { isValid: false, message: "Please enter at least 2 characters." };
      }
      return { isValid: true };
    }

    case 'date': {
      if (!trimmedValue) {
        return { isValid: false, message: "Please enter a wedding date." };
      }
      // Try to parse the date
      const date = new Date(trimmedValue);
      if (isNaN(date.getTime())) {
        return { isValid: false, message: "Please enter a valid date format (e.g., '25 November 2025' or '2025-11-25')." };
      }
      // Check if date is in the future
      const now = new Date();
      if (date <= now) {
        return { isValid: false, message: "Please enter a future date for your wedding." };
      }
      return { isValid: true };
    }

    case 'guests': {
      if (!trimmedValue) {
        return { isValid: false, message: "Please enter the expected number of guests." };
      }
      const guestNum = parseInt(trimmedValue.replace(/,/g, ''));
      if (isNaN(guestNum) || guestNum <= 0) {
        return { isValid: false, message: "Please enter a valid number of guests (e.g., 300)." };
      }
      if (guestNum > 2000) {
        return { isValid: false, message: "Please enter a realistic number of guests (under 2000)." };
      }
      return { isValid: true };
    }

    case 'budget': {
      if (!trimmedValue) {
        return { isValid: false, message: "Please enter your wedding budget." };
      }
      // Remove currency symbols and commas
      const cleanBudget = trimmedValue.replace(/[₹,\s]/g, '');
      const budgetNum = parseFloat(cleanBudget);
      if (isNaN(budgetNum) || budgetNum <= 0) {
        return { isValid: false, message: "Please enter a valid budget amount (e.g., '50,00,000' or '500000')." };
      }
      if (budgetNum < 10000) {
        return { isValid: false, message: "Please enter a realistic budget amount (minimum ₹10,000)." };
      }
      return { isValid: true };
    }

    default:
      return { isValid: true };
  }
}
