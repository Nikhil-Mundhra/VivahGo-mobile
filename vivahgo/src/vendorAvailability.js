const DAY_MS = 24 * 60 * 60 * 1000;

export const VENDOR_AVAILABILITY_COPY = {
  open: "Available",
  partial: "Limited bookings",
  "near-full": "Filling fast",
  full: "Fully booked",
  unavailable: "Unavailable",
  unknown: "Availability not shared",
};

export function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDays(date, offset) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

export function startOfWeek(date) {
  return addDays(date, -date.getDay());
}

export function addWeeks(date, offset) {
  return addDays(date, offset * 7);
}

function sanitizeCount(rawValue, fallback = 0) {
  const value = Number(rawValue);
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(99, value));
}

export function buildAvailabilityState(vendor) {
  const settings = vendor?.availabilitySettings || {};
  const hasDefaultCapacity = settings.hasDefaultCapacity !== false;
  const defaultMaxCapacity = hasDefaultCapacity
    ? Math.max(1, sanitizeCount(settings.defaultMaxCapacity, 1))
    : 0;
  const dateOverrides = Array.isArray(settings.dateOverrides)
    ? settings.dateOverrides
      .filter((item) => item && typeof item.date === "string")
      .map((item) => {
        const maxCapacity = sanitizeCount(item.maxCapacity, 0);
        const bookingsCount = maxCapacity > 0
          ? Math.min(sanitizeCount(item.bookingsCount, 0), maxCapacity)
          : 0;

        return {
          date: item.date,
          maxCapacity,
          bookingsCount,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return {
    hasDefaultCapacity,
    defaultMaxCapacity,
    dateOverrides,
  };
}

export function getDayAvailability(availability, dateKey) {
  const override = availability.dateOverrides.find((item) => item.date === dateKey) || null;
  if (override) {
    return {
      maxCapacity: override.maxCapacity,
      bookingsCount: override.bookingsCount,
      hasOverride: true,
    };
  }

  return {
    maxCapacity: availability.hasDefaultCapacity ? availability.defaultMaxCapacity : 0,
    bookingsCount: 0,
    hasOverride: false,
  };
}

export function getDayStatus(maxCapacity, bookingsCount) {
  if (maxCapacity <= 0) {
    return "unavailable";
  }
  if (bookingsCount >= maxCapacity) {
    return "full";
  }
  if (bookingsCount > 0 && bookingsCount / maxCapacity >= 0.8) {
    return "near-full";
  }
  if (bookingsCount > 0) {
    return "partial";
  }
  return "open";
}

export function getAvailabilityForDate(vendor, dateKey) {
  const availability = buildAvailabilityState(vendor);
  const dayAvailability = getDayAvailability(availability, dateKey);
  return {
    ...dayAvailability,
    status: getDayStatus(dayAvailability.maxCapacity, dayAvailability.bookingsCount),
  };
}

export function isVendorAvailableOnDate(vendor, dateKey) {
  const day = getAvailabilityForDate(vendor, dateKey);
  return day.maxCapacity > day.bookingsCount;
}

export function getDateRangeKeys(startKey, endKey) {
  if (!startKey && !endKey) {
    return [];
  }

  const resolvedStart = startKey || endKey;
  const resolvedEnd = endKey || startKey;
  if (!resolvedStart || !resolvedEnd) {
    return [];
  }

  const startDate = parseDateKey(resolvedStart);
  const endDate = parseDateKey(resolvedEnd);
  const lower = startDate <= endDate ? startDate : endDate;
  const upper = startDate <= endDate ? endDate : startDate;
  const totalDays = Math.round((upper - lower) / DAY_MS);

  return Array.from({ length: totalDays + 1 }, (_, index) => dateKeyFromDate(addDays(lower, index)));
}

export function getVendorAvailabilityMatch(vendor, startKey, endKey) {
  const rangeKeys = getDateRangeKeys(startKey, endKey);
  if (rangeKeys.length === 0) {
    return {
      hasFilter: false,
      hasAvailabilityData: Boolean(vendor?.availabilitySettings),
      isMatch: true,
      matchingDays: [],
    };
  }

  const hasAvailabilityData = Boolean(vendor?.availabilitySettings);
  if (!hasAvailabilityData) {
    return {
      hasFilter: true,
      hasAvailabilityData: false,
      isMatch: false,
      matchingDays: [],
    };
  }

  const matchingDays = rangeKeys.filter((dateKey) => isVendorAvailableOnDate(vendor, dateKey));
  return {
    hasFilter: true,
    hasAvailabilityData,
    isMatch: matchingDays.length > 0,
    matchingDays,
  };
}

export function buildWeekDays(anchorDate) {
  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    return {
      date,
      key: dateKeyFromDate(date),
    };
  });
}
