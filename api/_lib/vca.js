const { buildChoiceProfileName } = require('./vendor-choice');

const DEFAULT_VCA_TYPES = [
  'Venue',
  'Photography',
  'Catering',
  'Wedding Invitations',
  'Wedding Gifts',
  'Music',
  'Wedding Transportation',
  'Tent House',
  'Wedding Entertainment',
  'Florists',
  'Wedding Planners',
  'Wedding Videography',
  'Honeymoon',
  'Wedding Decorators',
  'Wedding Cakes',
  'Wedding DJ',
  'Pandit',
  'Photobooth',
  'Astrologers',
  'Party Places',
  'Choreographer',
  'Bridal & Pre-Bridal',
  'Groom Services',
];

const CHOICE_PROFILE_SEED_OVERRIDE_FIELDS = Object.freeze([
  'subType',
  'description',
  'services',
  'bundledServices',
  'city',
  'coverageAreas',
]);
const CHOICE_BUDGET_RANGE_MODES = Object.freeze(['merged', 'custom', 'hidden']);

const DEFAULT_VCA_PROFILE_CATALOG = [
  {
    type: 'Venue',
    subType: 'Wedding Resorts',
    bundledServices: ['Catering', 'Wedding Transportation', 'Wedding Decorators'],
    city: 'Delhi',
    serviceMode: 'Resort and destination venue',
    services: ['Wedding resort booking', 'Bridal suite', 'Guest room blocks', 'Outdoor phera lawns', 'Venue recce planning'],
    budgetRange: { min: 600000, max: 2200000 },
    locations: ['Delhi', 'Gurgaon', 'Jaipur'],
  },
  {
    type: 'Catering',
    city: 'Delhi',
    serviceMode: 'North Indian and regional catering',
    services: ['Regional menus', 'Live counters', 'Dessert room', 'Cocktail snacks', 'Tasting session before booking'],
    budgetRange: { min: 250000, max: 1800000 },
    locations: ['Delhi', 'Noida', 'Faridabad'],
  },
  {
    type: 'Wedding Invitations',
    subType: 'Luxury Box Invitations',
    city: 'Delhi',
    serviceMode: 'Print and digital invites',
    services: ['Luxury box invites', 'Minimal card suites', 'Digital e-invites', 'Wax seal finishing', 'Multilingual copy support'],
    budgetRange: { min: 12000, max: 150000 },
    locations: ['Delhi', 'Mumbai', 'Online nationwide'],
  },
  {
    type: 'Wedding Gifts',
    subType: 'Guest Hampers',
    city: 'Jaipur',
    serviceMode: 'Hampers and guest gifting',
    services: ['Welcome hampers', 'Shagun trays', 'Bridesmaid gifts', 'Custom gifting tags', 'Bulk packaging'],
    budgetRange: { min: 10000, max: 220000 },
    locations: ['Jaipur', 'Delhi', 'Online nationwide'],
  },
  {
    type: 'Photography',
    city: 'Gurgaon',
    serviceMode: 'Photo storytelling team',
    services: ['Candid photography', 'Family portraits', 'Pre-wedding concept shoot', 'Drone coverage', 'Same-day teaser edits'],
    budgetRange: { min: 180000, max: 450000 },
    locations: ['Gurgaon', 'Delhi', 'Jaipur'],
  },
  {
    type: 'Music',
    subType: 'Live Band',
    city: 'Noida',
    serviceMode: 'Live band and sound support',
    services: ['Sufi band', 'Instrumental entry', 'Sound console', 'Baraat sync', 'Late-night set support'],
    budgetRange: { min: 40000, max: 160000 },
    locations: ['Noida', 'Delhi', 'Ghaziabad'],
  },
  {
    type: 'Wedding Transportation',
    subType: 'Guest Transport',
    city: 'Delhi',
    serviceMode: 'Guest and family transportation',
    services: ['Airport pickups', 'Guest coaches', 'Shuttle loops', 'VIP car allocation', 'Driver coordination'],
    budgetRange: { min: 25000, max: 220000 },
    locations: ['Delhi', 'Gurgaon', 'Noida'],
  },
  {
    type: 'Tent House',
    city: 'Jaipur',
    serviceMode: 'Tent and outdoor infrastructure',
    services: ['Canopy structures', 'Lounge seating', 'Weather covers', 'Dining tents', 'Generator support'],
    budgetRange: { min: 80000, max: 450000 },
    locations: ['Jaipur', 'Delhi', 'Udaipur'],
  },
  {
    type: 'Wedding Entertainment',
    subType: 'Live Performers',
    city: 'Mumbai',
    serviceMode: 'Acts and crowd entertainment',
    services: ['Live acts', 'LED performers', 'Anchor support', 'Baraat entertainers', 'Kids activity corners'],
    budgetRange: { min: 40000, max: 300000 },
    locations: ['Mumbai', 'Delhi', 'Jaipur'],
  },
  {
    type: 'Florists',
    subType: 'Fresh Venue Florals',
    city: 'Delhi',
    serviceMode: 'Fresh floral styling',
    services: ['Varmala flowers', 'Fresh stage florals', 'Entry blooms', 'Table flowers', 'Car floral decor'],
    budgetRange: { min: 50000, max: 300000 },
    locations: ['Delhi', 'Noida', 'Jaipur'],
  },
  {
    type: 'Wedding Planners',
    subType: 'Full Planning',
    bundledServices: ['Wedding Decorators', 'Wedding Entertainment', 'Wedding Transportation'],
    city: 'Delhi',
    serviceMode: 'End-to-end wedding planning',
    services: ['Budget planning', 'Vendor coordination', 'Family logistics', 'Show calling', 'Function timelines'],
    budgetRange: { min: 150000, max: 900000 },
    locations: ['Delhi', 'Jaipur', 'Goa'],
  },
  {
    type: 'Wedding Videography',
    subType: 'Cinematic Wedding Films',
    city: 'Gurgaon',
    serviceMode: 'Cinematic wedding films',
    services: ['Highlight films', 'Instagram reels', 'Full ceremony film', 'Drone footage', 'Family interviews'],
    budgetRange: { min: 125000, max: 350000 },
    locations: ['Gurgaon', 'Delhi', 'Jaipur'],
  },
  {
    type: 'Honeymoon',
    city: 'Delhi',
    serviceMode: 'Post-wedding travel planning',
    services: ['Visa support', 'Luxury itineraries', 'Mini-moon ideas', 'Flight and hotel booking', 'Experience curation'],
    budgetRange: { min: 80000, max: 450000 },
    locations: ['Delhi', 'Mumbai', 'Online nationwide'],
  },
  {
    type: 'Wedding Decorators',
    subType: 'Mandap Decor',
    bundledServices: ['Florists', 'Tent House'],
    city: 'Delhi',
    serviceMode: 'Wedding decor production',
    services: ['Mandap styling', 'Entry tunnels', 'Fresh floral ceiling', 'Stage production', 'Mood-board execution'],
    budgetRange: { min: 220000, max: 1200000 },
    locations: ['Delhi', 'Noida', 'Jaipur'],
  },
  {
    type: 'Wedding Cakes',
    subType: 'Tiered Wedding Cakes',
    city: 'Delhi',
    serviceMode: 'Wedding and event cakes',
    services: ['Tiered cakes', 'Fondant detailing', 'Dessert tables', 'Eggless options', 'Cake table styling'],
    budgetRange: { min: 12000, max: 85000 },
    locations: ['Delhi', 'Gurgaon', 'Noida'],
  },
  {
    type: 'Wedding DJ',
    subType: 'Sangeet DJ',
    city: 'Noida',
    serviceMode: 'DJ and dance-floor energy',
    services: ['Sangeet DJ', 'Cocktail set', 'After-party playlist', 'Sound rig', 'Cold pyros sync'],
    budgetRange: { min: 50000, max: 180000 },
    locations: ['Noida', 'Delhi', 'Ghaziabad'],
  },
  {
    type: 'Pandit',
    subType: 'Wedding Pandit',
    city: 'Delhi',
    serviceMode: 'Wedding rituals and guidance',
    services: ['Phera rituals', 'Muhurat planning', 'Sankalp guidance', 'Bilingual explanations', 'Samagri checklist'],
    budgetRange: { min: 11000, max: 51000 },
    locations: ['Delhi', 'Gurgaon', 'Noida'],
  },
  {
    type: 'Photobooth',
    subType: 'Instant Print Booth',
    city: 'Gurgaon',
    serviceMode: 'Photo booth and instant print setup',
    services: ['Photo booth backdrop', 'Instant prints', 'GIF booth', 'Custom props', 'Guest album station'],
    budgetRange: { min: 20000, max: 90000 },
    locations: ['Gurgaon', 'Delhi', 'Noida'],
  },
  {
    type: 'Astrologers',
    subType: 'Muhurat Consultation',
    city: 'Varanasi',
    serviceMode: 'Kundli and muhurat consultations',
    services: ['Kundli matching', 'Muhurat selection', 'Name compatibility', 'Remedy guidance', 'Family consultation calls'],
    budgetRange: { min: 5000, max: 35000 },
    locations: ['Varanasi', 'Delhi', 'Online nationwide'],
  },
  {
    type: 'Party Places',
    subType: 'Cocktail Venues',
    bundledServices: ['Catering', 'Wedding DJ'],
    city: 'Delhi',
    serviceMode: 'Pre-wedding event spaces',
    services: ['Cocktail venues', 'Intimate function spaces', 'Rooftop party areas', 'Private dining rooms', 'Birthday and after-party bookings'],
    budgetRange: { min: 80000, max: 350000 },
    locations: ['Delhi', 'Gurgaon', 'Noida'],
  },
  {
    type: 'Choreographer',
    subType: 'Family Performances',
    city: 'Gurgaon',
    serviceMode: 'Family dance direction',
    services: ['Sangeet concept planning', 'Couple performance mix', 'Family medleys', 'At-home rehearsals', 'Stage blocking support'],
    budgetRange: { min: 30000, max: 175000 },
    locations: ['Gurgaon', 'Delhi', 'Noida'],
  },
  {
    type: 'Bridal & Pre-Bridal',
    subType: 'Bridal Jewellery',
    city: 'Delhi',
    serviceMode: 'Bridal styling and jewellery',
    services: ['Polki sets', 'Temple jewellery', 'Styling consults', 'Bridal trial styling', 'Accessory pairing'],
    budgetRange: { min: 75000, max: 600000 },
    locations: ['Delhi', 'Chandni Chowk', 'Karol Bagh'],
  },
  {
    type: 'Groom Services',
    subType: 'Sherwani',
    city: 'Delhi',
    serviceMode: 'Sherwani and groom styling',
    services: ['Sherwani trials', 'Custom tailoring', 'Safa pairing', 'Mojari styling', 'Last-mile alterations'],
    budgetRange: { min: 25000, max: 175000 },
    locations: ['Delhi', 'Noida', 'Jaipur'],
  },
];

function slugifyChoiceType(type) {
  return String(type || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildChoiceProfileId(type) {
  const slug = slugifyChoiceType(type);
  return slug ? `vca-${slug}` : '';
}

function buildSeedCoverageAreas(locations) {
  return (Array.isArray(locations) ? locations : [])
    .filter(location => typeof location === 'string' && location.trim())
    .map(location => ({
      country: '',
      state: '',
      city: location.trim(),
    }));
}

function buildSeedDescription(seed) {
  const serviceMode = String(seed?.serviceMode || '').trim();
  const services = Array.isArray(seed?.services)
    ? seed.services.filter(item => typeof item === 'string' && item.trim()).slice(0, 3)
    : [];

  if (!serviceMode && services.length === 0) {
    return '';
  }

  if (!serviceMode) {
    return services.join(', ');
  }

  if (services.length === 0) {
    return serviceMode;
  }

  return `${serviceMode}. ${services.join(', ')}.`;
}

function buildDefaultChoiceProfileSeed(type) {
  const normalizedType = String(type || '').trim();
  const seed = DEFAULT_VCA_PROFILE_CATALOG.find(item => item.type === normalizedType) || null;
  return {
    _id: buildChoiceProfileId(normalizedType),
    type: normalizedType,
    businessName: buildChoiceProfileName(normalizedType),
    name: buildChoiceProfileName(normalizedType),
    subType: seed?.subType || '',
    description: buildSeedDescription(seed),
    services: Array.isArray(seed?.services) ? [...seed.services] : [],
    bundledServices: Array.isArray(seed?.bundledServices) ? [...seed.bundledServices] : [],
    country: '',
    state: '',
    city: seed?.city || '',
    googleMapsLink: '',
    coverageAreas: buildSeedCoverageAreas(seed?.locations),
    budgetRangeMode: 'custom',
    budgetRange: seed?.budgetRange ? { ...seed.budgetRange } : null,
    phone: '',
    website: '',
    availabilitySettings: {
      hasDefaultCapacity: false,
      defaultMaxCapacity: 0,
      dateOverrides: [],
    },
    sourceVendorIds: [],
    selectedVendorMedia: [],
    media: [],
    isApproved: true,
    tier: 'Plus',
    isActive: true,
  };
}

function normalizeChoiceBudgetRangeMode(value, fallback = 'custom') {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CHOICE_BUDGET_RANGE_MODES.includes(normalized) ? normalized : fallback;
}

function areChoiceBudgetRangesEqual(left, right) {
  const leftMin = Number(left?.min);
  const leftMax = Number(left?.max);
  const rightMin = Number(right?.min);
  const rightMax = Number(right?.max);

  if (!Number.isFinite(leftMin) || !Number.isFinite(leftMax) || !Number.isFinite(rightMin) || !Number.isFinite(rightMax)) {
    return false;
  }

  return leftMin === rightMin && leftMax === rightMax;
}

function inferChoiceBudgetRangeMode(choiceProfile, { aggregatedBudgetRange = null, seedProfile = null } = {}) {
  const explicitMode = normalizeChoiceBudgetRangeMode(choiceProfile?.budgetRangeMode, '');
  if (explicitMode) {
    return explicitMode;
  }

  const storedBudgetRange = choiceProfile?.budgetRange;
  if (!storedBudgetRange || !Number.isFinite(Number(storedBudgetRange.min)) || !Number.isFinite(Number(storedBudgetRange.max))) {
    return aggregatedBudgetRange ? 'merged' : 'hidden';
  }

  if (aggregatedBudgetRange && areChoiceBudgetRangesEqual(storedBudgetRange, aggregatedBudgetRange)) {
    return 'merged';
  }

  if (seedProfile?.budgetRange && areChoiceBudgetRangesEqual(storedBudgetRange, seedProfile.budgetRange)) {
    return 'custom';
  }

  return 'custom';
}

function normalizeChoiceProfileSeedOverrides(value) {
  return CHOICE_PROFILE_SEED_OVERRIDE_FIELDS.reduce((accumulator, fieldName) => {
    accumulator[fieldName] = Boolean(value?.[fieldName]);
    return accumulator;
  }, {});
}

function normalizeComparableSeedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeComparableSeedArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  ));
}

function normalizeComparableSeedCoverageAreas(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      country: typeof item.country === 'string' ? item.country.trim() : '',
      state: typeof item.state === 'string' ? item.state.trim() : '',
      city: typeof item.city === 'string' ? item.city.trim() : '',
    }))
    .filter(item => item.country || item.state || item.city);
}

function areComparableArraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areComparableCoverageAreasEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => (
    item.country === right[index].country
    && item.state === right[index].state
    && item.city === right[index].city
  ));
}

function buildChoiceProfileSeedOverrides(seedProfile, source) {
  return {
    subType: normalizeComparableSeedString(source?.subType) !== normalizeComparableSeedString(seedProfile?.subType),
    description: normalizeComparableSeedString(source?.description) !== normalizeComparableSeedString(seedProfile?.description),
    services: !areComparableArraysEqual(
      normalizeComparableSeedArray(source?.services),
      normalizeComparableSeedArray(seedProfile?.services)
    ),
    bundledServices: !areComparableArraysEqual(
      normalizeComparableSeedArray(source?.bundledServices),
      normalizeComparableSeedArray(seedProfile?.bundledServices)
    ),
    city: normalizeComparableSeedString(source?.city) !== normalizeComparableSeedString(seedProfile?.city),
    coverageAreas: !areComparableCoverageAreasEqual(
      normalizeComparableSeedCoverageAreas(source?.coverageAreas),
      normalizeComparableSeedCoverageAreas(seedProfile?.coverageAreas)
    ),
  };
}

function inferChoiceProfileSeedOverrides(seedProfile, source) {
  if (source?.seedOverrides && typeof source.seedOverrides === 'object') {
    return normalizeChoiceProfileSeedOverrides(source.seedOverrides);
  }

  const normalizedServices = normalizeComparableSeedArray(source?.services);
  const normalizedBundledServices = normalizeComparableSeedArray(source?.bundledServices);
  const normalizedCoverageAreas = normalizeComparableSeedCoverageAreas(source?.coverageAreas);

  return {
    subType: Boolean(normalizeComparableSeedString(source?.subType))
      && normalizeComparableSeedString(source?.subType) !== normalizeComparableSeedString(seedProfile?.subType),
    description: Boolean(normalizeComparableSeedString(source?.description))
      && normalizeComparableSeedString(source?.description) !== normalizeComparableSeedString(seedProfile?.description),
    services: normalizedServices.length > 0
      && !areComparableArraysEqual(normalizedServices, normalizeComparableSeedArray(seedProfile?.services)),
    bundledServices: normalizedBundledServices.length > 0
      && !areComparableArraysEqual(normalizedBundledServices, normalizeComparableSeedArray(seedProfile?.bundledServices)),
    city: Boolean(normalizeComparableSeedString(source?.city))
      && normalizeComparableSeedString(source?.city) !== normalizeComparableSeedString(seedProfile?.city),
    coverageAreas: normalizedCoverageAreas.length > 0
      && !areComparableCoverageAreasEqual(normalizedCoverageAreas, normalizeComparableSeedCoverageAreas(seedProfile?.coverageAreas)),
  };
}

module.exports = {
  CHOICE_BUDGET_RANGE_MODES,
  CHOICE_PROFILE_SEED_OVERRIDE_FIELDS,
  DEFAULT_VCA_TYPES,
  inferChoiceBudgetRangeMode,
  normalizeChoiceBudgetRangeMode,
  buildChoiceProfileId,
  buildDefaultChoiceProfileSeed,
  buildChoiceProfileSeedOverrides,
  inferChoiceProfileSeedOverrides,
  normalizeChoiceProfileSeedOverrides,
  slugifyChoiceType,
};
