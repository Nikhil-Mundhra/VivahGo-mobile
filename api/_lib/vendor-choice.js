const DEFAULT_CHOICE_NAME_PREFIX = "VivahGo's Choice";

function normalizeVendorTier(value) {
  return String(value || '').trim().toLowerCase() === 'plus' ? 'Plus' : 'Free';
}

function buildChoiceProfileName(type) {
  const trimmedType = String(type || '').trim();
  return trimmedType ? `${DEFAULT_CHOICE_NAME_PREFIX} ${trimmedType}` : DEFAULT_CHOICE_NAME_PREFIX;
}

function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
}

function buildAggregatedBudgetRange(vendors) {
  const normalizedVendors = Array.isArray(vendors) ? vendors : [];
  const mins = normalizedVendors
    .map(vendor => Number(vendor?.budgetRange?.min))
    .filter(value => Number.isFinite(value) && value > 0);
  const maxes = normalizedVendors
    .map(vendor => Number(vendor?.budgetRange?.max))
    .filter(value => Number.isFinite(value) && value > 0);

  if (mins.length === 0 || maxes.length === 0) {
    return null;
  }

  return {
    min: Math.min(...mins),
    max: Math.max(...maxes),
  };
}

function buildAggregatedServices(vendors) {
  const normalizedVendors = Array.isArray(vendors) ? vendors : [];
  return Array.from(new Set(
    normalizedVendors.flatMap(vendor => [
      vendor?.subType,
      ...(Array.isArray(vendor?.bundledServices) ? vendor.bundledServices : []),
    ])
      .filter(value => typeof value === 'string')
      .map(value => value.trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));
}

function sortChoiceMedia(media) {
  return [...(Array.isArray(media) ? media : [])].sort((a, b) => {
    const orderA = typeof a?.sortOrder === 'number' ? a.sortOrder : 0;
    const orderB = typeof b?.sortOrder === 'number' ? b.sortOrder : 0;
    return orderA - orderB;
  });
}

module.exports = {
  buildAggregatedBudgetRange,
  buildAggregatedServices,
  buildChoiceProfileName,
  normalizeVendorTier,
  normalizeWhatsappNumber,
  sortChoiceMedia,
};
