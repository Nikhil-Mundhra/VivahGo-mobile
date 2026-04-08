const {
  connectDb,
  getChoiceProfileModel,
  getPublicCache,
  getUserModel,
  getVendorModel,
  handlePreflight,
  invalidatePublicCache,
  requireCsrfProtection,
  setCacheControl,
  setCorsHeaders,
  setPublicCache,
  verifySession,
  withRequestMetrics,
} = require('./_lib/core');
const { createPublicObjectUrl, extractObjectKeyFromUrl, normalizeMediaList, objectKeyMatchesScope } = require('./_lib/r2');
const { createB2PresignedGetUrl, deleteB2Object } = require('./_lib/b2');
const { buildAggregatedBudgetRange, buildAggregatedServices, buildChoiceProfileName, normalizeVendorTier, normalizeWhatsappNumber, sortChoiceMedia } = require('./_lib/vendor-choice');
const { DEFAULT_VCA_TYPES, buildChoiceProfileId, buildDefaultChoiceProfileSeed } = require('./_lib/vca');

const VENDOR_TYPES = ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bridal & Pre-Bridal', 'Groom Services'];
const BUNDLED_SERVICE_OPTIONS = VENDOR_TYPES.filter(type => type !== 'Honeymoon');
const LEGACY_VENDOR_TYPE_ALIASES = {
  Bride: 'Bridal & Pre-Bridal',
  Groom: 'Groom Services',
};
const VENDOR_SUBTYPE_OPTIONS = {
  Venue: ['Wedding Lawns', 'Farmhouses', 'Hotels', 'Banquet Halls', 'Marriage Garden', 'Kalyana Mandapams', 'Wedding Resorts'],
  'Wedding Transportation': ['Guest Transport', 'Airport Transfers', 'Luxury Cars', 'Baraat Entry Vehicles'],
  'Wedding Entertainment': ['Live Performers', 'Celebrity Acts', 'Anchors / MC', 'Baraat Entertainment'],
  Music: ['Live Band', 'Dhol', 'Sufi Night', 'Instrumental Ensemble'],
  'Wedding Invitations': ['Luxury Box Invitations', 'Digital E-Invites', 'Traditional Cards', 'Invitation Hampers'],
  'Wedding Gifts': ['Guest Hampers', 'Shagun Gifts', 'Bridesmaid Gifts', 'Corporate Gifting'],
  Florists: ['Varmala Florals', 'Fresh Venue Florals', 'Car Florals', 'Table Arrangements'],
  'Wedding Planners': ['Full Planning', 'Partial Planning', 'Wedding Coordination', 'Destination Wedding Planning'],
  'Wedding Videography': ['Cinematic Wedding Films', 'Teaser Reels', 'Documentary Coverage', 'Drone Videography'],
  'Wedding Decorators': ['Mandap Decor', 'Floral Decor', 'Stage Decor', 'Theme Decor'],
  'Wedding Cakes': ['Tiered Wedding Cakes', 'Dessert Tables', 'Fondant Cakes', 'Eggless Cakes'],
  'Wedding DJ': ['Sangeet DJ', 'Cocktail DJ', 'After Party DJ', 'Sound & Lights'],
  Pandit: ['Wedding Pandit', 'Phera Specialist', 'South Indian Priest', 'Samagri Guidance'],
  Photobooth: ['Instant Print Booth', 'GIF Booth', 'Mirror Booth', '360 Video Booth'],
  Astrologers: ['Kundli Matching', 'Muhurat Consultation', 'Remedy Guidance', 'Online Consultation'],
  'Party Places': ['Cocktail Venues', 'Rooftop Venues', 'Private Dining', 'After Party Spaces'],
  Choreographer: ['Couple Choreography', 'Family Performances', 'Sangeet Concepts', 'At-Home Rehearsals'],
  'Bridal & Pre-Bridal': ['Bridal Jewellery', 'Bridal Makeup Artists', 'Bridal Lehenga', 'Mehndi Artists', 'Makeup Salon', 'Trousseau Packing'],
  'Groom Services': ['Sherwani', 'Salon'],
};
const ALLOWED_UPDATE_FIELDS = ['businessName', 'type', 'subType', 'description', 'country', 'state', 'city', 'googleMapsLink', 'phone', 'website'];
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 5000000;
const ALLOWED_MEDIA_TYPES = ['IMAGE', 'VIDEO'];
const MAX_CAPTION_LENGTH = 280;
const MAX_ALT_TEXT_LENGTH = 180;
const ALLOWED_VERIFICATION_DOCUMENT_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER'];
const MAX_VERIFICATION_NOTES_LENGTH = 1000;
const MAX_VENDOR_CAPACITY = 99;
const VENDOR_DIRECTORY_CACHE_KEY = 'vendors:index';
const VENDOR_DIRECTORY_CACHE_TAG = 'vendors';
const VENDOR_CONFLICT_CODE = 'VENDOR_CONFLICT';

/******************************************************************************
 * Shared Helpers
 ******************************************************************************/

function resolveVendorRoute(req) {
  const queryRoute = String(req.query?.route || '').trim().toLowerCase();
  if (queryRoute) {
    return queryRoute;
  }

  const path = String(req.path || req.url || '').split('?')[0].trim().toLowerCase();
  if (path.endsWith('/vendors')) {
    return 'list';
  }
  if (path.endsWith('/vendor/me')) {
    return 'me';
  }
  if (path.endsWith('/vendor/media')) {
    return 'media';
  }
  if (path.endsWith('/vendor/verification')) {
    return 'verification';
  }

  return '';
}

function normalizeVendorType(type) {
  if (typeof type !== 'string') {
    return '';
  }

  const trimmed = type.trim();
  return LEGACY_VENDOR_TYPE_ALIASES[trimmed] || trimmed;
}

function normalizeVendorSubtype(type, subType) {
  const normalizedType = normalizeVendorType(type);
  const allowedSubtypes = VENDOR_SUBTYPE_OPTIONS[normalizedType] || [];
  const normalizedSubType = typeof subType === 'string' ? subType.trim() : '';

  if (!normalizedSubType) {
    return '';
  }

  if (!allowedSubtypes.includes(normalizedSubType)) {
    throw new Error(`subType must be one of: ${allowedSubtypes.join(', ')}.`);
  }

  return normalizedSubType;
}

function normalizeVendorRevision(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeClientSequence(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildVendorRevisionFilter(currentRevision) {
  if (currentRevision > 0) {
    return { vendorRevision: currentRevision };
  }

  return {
    $or: [
      { vendorRevision: { $exists: false } },
      { vendorRevision: 0 },
    ],
  };
}

function buildVendorConflictPayload({ correlationId = '', clientSequence = null, vendorRevision = 0 } = {}) {
  return {
    error: 'Vendor profile changed before this update completed. Please refresh and try again.',
    code: VENDOR_CONFLICT_CODE,
    correlationId,
    clientSequence,
    vendorRevision,
  };
}

function createSubdocumentId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Math.random().toString(16).slice(2).padEnd(16, '0');
  return `${timestamp}${random}`.slice(0, 24);
}

function cloneVendorMediaItems(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    ...item,
    _id: item?._id || createSubdocumentId(),
    sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : index,
    isCover: Boolean(item?.isCover),
    isVisible: item?.isVisible !== false,
    caption: item?.caption || '',
    altText: item?.altText || '',
    filename: item?.filename || '',
    size: typeof item?.size === 'number' ? item.size : 0,
  }));
}

function cloneVerificationDocuments(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    _id: item?._id || createSubdocumentId(),
    filename: item?.filename || '',
    size: typeof item?.size === 'number' ? item.size : 0,
    contentType: item?.contentType || '',
    documentType: item?.documentType || 'OTHER',
    uploadedAt: item?.uploadedAt || new Date(),
  }));
}

function findSubdocumentIndex(items, targetId) {
  return (Array.isArray(items) ? items : []).findIndex((item) => String(item?._id || '') === String(targetId || ''));
}

async function applyVendorRevisionUpdate(Vendor, ownerId, currentVendorRevision, setPayload) {
  if (typeof Vendor.findOneAndUpdate === 'function') {
    return Vendor.findOneAndUpdate(
      {
        googleId: ownerId,
        ...buildVendorRevisionFilter(currentVendorRevision),
      },
      {
        $set: setPayload,
        $inc: { vendorRevision: 1 },
      },
      { new: true, runValidators: true }
    );
  }

  const vendor = await Vendor.findOne({ googleId: ownerId });
  if (!vendor) {
    return null;
  }

  for (const [key, value] of Object.entries(setPayload || {})) {
    vendor[key] = value;
  }
  vendor.vendorRevision = currentVendorRevision + 1;
  if (typeof vendor.save === 'function') {
    await vendor.save();
  }
  return vendor;
}

async function loadVendorSnapshot(Vendor, query) {
  const result = Vendor.findOne(query);
  if (result && typeof result.lean === 'function') {
    return result.lean();
  }
  return result;
}

function normalizeCoverageAreas(value) {
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
    .filter(item => item.country && item.state && item.city);
}

function normalizeBundledServices(type, value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => item && item !== type && BUNDLED_SERVICE_OPTIONS.includes(item))
  ));
}

function normalizeBudgetRange(value) {
  if (!value || typeof value !== 'object') {
    return { min: 100000, max: 300000 };
  }

  const min = Number(value.min);
  const max = Number(value.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('budgetRange.min and budgetRange.max must be numbers.');
  }

  const safeMin = Math.max(MIN_BUDGET_LIMIT, Math.min(Math.round(min), MAX_BUDGET_LIMIT));
  const safeMax = Math.max(safeMin, Math.min(Math.round(max), MAX_BUDGET_LIMIT));

  return { min: safeMin, max: safeMax };
}

function normalizeAvailabilityCount(value, { min = 0, fieldName = 'availability capacity' } = {}) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (number < min || number > MAX_VENDOR_CAPACITY) {
    throw new Error(`${fieldName} must be between ${min} and ${MAX_VENDOR_CAPACITY}.`);
  }

  return number;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeAvailabilitySettings(value) {
  if (!value || typeof value !== 'object') {
    return {
      hasDefaultCapacity: true,
      defaultMaxCapacity: 1,
      dateOverrides: [],
    };
  }

  const hasDefaultCapacity = value.hasDefaultCapacity !== false;
  const defaultMaxCapacity = hasDefaultCapacity
    ? normalizeAvailabilityCount(
      value.defaultMaxCapacity ?? 1,
      { min: 1, fieldName: 'availabilitySettings.defaultMaxCapacity' }
    )
    : 0;

  if (value.dateOverrides != null && !Array.isArray(value.dateOverrides)) {
    throw new Error('availabilitySettings.dateOverrides must be an array.');
  }

  const seenDates = new Set();
  const dateOverrides = (Array.isArray(value.dateOverrides) ? value.dateOverrides : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('availabilitySettings.dateOverrides must contain objects.');
      }

      const date = typeof item.date === 'string' ? item.date.trim() : '';
      if (!isValidDateKey(date)) {
        throw new Error('availabilitySettings.dateOverrides[].date must use YYYY-MM-DD.');
      }
      if (seenDates.has(date)) {
        throw new Error('availabilitySettings.dateOverrides must not contain duplicate dates.');
      }
      seenDates.add(date);

      return {
        date,
        maxCapacity: normalizeAvailabilityCount(
          item.maxCapacity,
          { min: 0, fieldName: 'availabilitySettings.dateOverrides[].maxCapacity' }
        ),
        rawBookingsCount: item.bookingsCount ?? 0,
      };
    })
    .map((item) => {
      const bookingsCount = normalizeAvailabilityCount(
        item && typeof item === 'object' ? item.rawBookingsCount ?? 0 : 0,
        { min: 0, fieldName: 'availabilitySettings.dateOverrides[].bookingsCount' }
      );

      return {
        date: item.date,
        maxCapacity: item.maxCapacity,
        bookingsCount: item.maxCapacity > 0 ? Math.min(bookingsCount, item.maxCapacity) : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasDefaultCapacity,
    defaultMaxCapacity,
    dateOverrides,
  };
}

function getAvailabilityDayForDate(availability, dateKey) {
  const override = Array.isArray(availability?.dateOverrides)
    ? availability.dateOverrides.find(item => item?.date === dateKey)
    : null;

  if (override) {
    return {
      maxCapacity: override.maxCapacity,
      bookingsCount: override.bookingsCount,
      hasOverride: true,
    };
  }

  return {
    maxCapacity: availability?.hasDefaultCapacity ? Number(availability?.defaultMaxCapacity || 0) : 0,
    bookingsCount: 0,
    hasOverride: false,
  };
}

function buildAggregatedAvailabilitySettings(vendors) {
  const normalizedVendors = Array.isArray(vendors) ? vendors : [];
  if (normalizedVendors.length === 0) {
    return {
      hasDefaultCapacity: false,
      defaultMaxCapacity: 0,
      dateOverrides: [],
    };
  }

  const vendorStates = normalizedVendors.map(vendor => normalizeAvailabilitySettings(vendor?.availabilitySettings));
  const defaultMaxCapacity = Math.min(
    MAX_VENDOR_CAPACITY,
    vendorStates.reduce((sum, availability) => (
      sum + (availability.hasDefaultCapacity ? Number(availability.defaultMaxCapacity || 0) : 0)
    ), 0)
  );
  const dateKeys = Array.from(new Set(
    vendorStates.flatMap(availability => (
      Array.isArray(availability.dateOverrides) ? availability.dateOverrides.map(item => item.date) : []
    ))
  )).sort((a, b) => a.localeCompare(b));

  const dateOverrides = dateKeys.map((date) => {
    const totals = vendorStates.reduce((accumulator, availability) => {
      const day = getAvailabilityDayForDate(availability, date);
      return {
        maxCapacity: Math.min(MAX_VENDOR_CAPACITY, accumulator.maxCapacity + Number(day.maxCapacity || 0)),
        bookingsCount: Math.min(MAX_VENDOR_CAPACITY, accumulator.bookingsCount + Number(day.bookingsCount || 0)),
        hasOverride: accumulator.hasOverride || day.hasOverride,
      };
    }, { maxCapacity: 0, bookingsCount: 0, hasOverride: false });

    const bookingsCount = Math.min(totals.bookingsCount, totals.maxCapacity);
    if (!totals.hasOverride && totals.maxCapacity === defaultMaxCapacity && bookingsCount === 0) {
      return null;
    }

    return {
      date,
      maxCapacity: totals.maxCapacity,
      bookingsCount,
    };
  }).filter(Boolean);

  return {
    hasDefaultCapacity: defaultMaxCapacity > 0,
    defaultMaxCapacity,
    dateOverrides,
  };
}

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function sanitizeVerificationNotes(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, MAX_VERIFICATION_NOTES_LENGTH);
}

function isLikelyHttpUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeVerificationStatus(value, { hasDocuments = false } = {}) {
  if (value === 'approved' || value === 'rejected' || value === 'submitted') {
    return value;
  }
  return hasDocuments ? 'submitted' : 'not_submitted';
}

function isVendorMediaKeyForOwner(key, ownerId) {
  return objectKeyMatchesScope(key, 'vendors', ownerId);
}

function isVendorVerificationKeyForOwner(key, ownerId) {
  return objectKeyMatchesScope(key, 'vendor-verification', ownerId);
}

function normalizeMediaForResponse(vendor) {
  if (!vendor || !Array.isArray(vendor.media)) {
    return vendor;
  }

  const ownerId = typeof vendor.googleId === 'string' ? vendor.googleId : '';
  return {
    ...vendor,
    media: normalizeMediaList(vendor.media)
      .filter(item => isVendorMediaKeyForOwner(item?.key, ownerId))
      .sort((a, b) => {
        const orderA = typeof a?.sortOrder === 'number' ? a.sortOrder : 0;
        const orderB = typeof b?.sortOrder === 'number' ? b.sortOrder : 0;
        return orderA - orderB;
      }),
  };
}

function collectVendorMedia(vendor, { includeHidden = false } = {}) {
  const ownerId = typeof vendor?.googleId === 'string' ? vendor.googleId : '';
  return normalizeMediaList(vendor?.media)
    .filter(item => isVendorMediaKeyForOwner(item?.key, ownerId))
    .filter(item => includeHidden || item?.isVisible !== false)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
}

function buildDirectoryLocations(entity) {
  return [
    [entity?.city, entity?.state, entity?.country].filter(Boolean).join(', '),
    ...(Array.isArray(entity?.coverageAreas)
      ? entity.coverageAreas.map(item => [item?.city, item?.state, item?.country].filter(Boolean).join(', '))
      : []),
  ].filter(Boolean);
}

async function serializeVerificationDocuments(documents, ownerId) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const ownedDocuments = documents.filter(document => isVendorVerificationKeyForOwner(document?.key, ownerId));

  return Promise.all(ownedDocuments.map(async document => {
    const key = typeof document?.key === 'string' ? document.key.replace(/^\/+/, '') : '';
    let accessUrl = '';

    if (key) {
      try {
        accessUrl = await createB2PresignedGetUrl(key);
      } catch {
        accessUrl = '';
      }
    }

    return {
      _id: String(document?._id || ''),
      key,
      filename: document?.filename || '',
      size: typeof document?.size === 'number' ? document.size : 0,
      contentType: document?.contentType || '',
      documentType: document?.documentType || 'OTHER',
      uploadedAt: document?.uploadedAt || null,
      accessUrl,
    };
  }));
}

async function serializeVendor(vendor) {
  const vendorObject = typeof vendor?.toObject === 'function' ? vendor.toObject() : vendor;
  const normalizedVendor = normalizeMediaForResponse(vendorObject);
  const { vendorRevision: _vendorRevision, ...publicVendor } = normalizedVendor || {};
  const verificationDocuments = await serializeVerificationDocuments(publicVendor?.verificationDocuments, publicVendor?.googleId);

  return {
    ...publicVendor,
    type: normalizeVendorType(publicVendor?.type),
    tier: normalizeVendorTier(publicVendor?.tier),
    bundledServices: Array.isArray(publicVendor?.bundledServices) ? publicVendor.bundledServices.map(normalizeVendorType) : [],
    availabilitySettings: normalizeAvailabilitySettings(publicVendor?.availabilitySettings),
    verificationStatus: normalizeVerificationStatus(publicVendor?.verificationStatus, {
      hasDocuments: verificationDocuments.length > 0,
    }),
    verificationNotes: sanitizeVerificationNotes(publicVendor?.verificationNotes),
    verificationReviewedAt: publicVendor?.verificationReviewedAt || null,
    verificationReviewedBy: publicVendor?.verificationReviewedBy || '',
    verificationDocuments,
  };
}

async function buildVendorMutationResponse(vendor, mutationMeta = {}) {
  return {
    vendor: await serializeVendor(vendor),
    vendorRevision: Math.max(0, Number(vendor?.vendorRevision) || 0),
    correlationId: typeof mutationMeta?.correlationId === 'string' ? mutationMeta.correlationId : '',
    clientSequence: normalizeClientSequence(mutationMeta?.clientSequence),
  };
}

function buildPublicVendorDirectoryEntry(vendor) {
  const media = collectVendorMedia(vendor);
  const coverMedia = media.find(item => item?.isCover) || media[0] || null;

  return {
    id: `db_${vendor._id}`,
    name: vendor.businessName,
    type: normalizeVendorType(vendor.type),
    subType: vendor.subType || '',
    bundledServices: Array.isArray(vendor.bundledServices) ? vendor.bundledServices.map(normalizeVendorType) : [],
    description: vendor.description || '',
    country: vendor.country || '',
    state: vendor.state || '',
    city: vendor.city || '',
    googleMapsLink: vendor.googleMapsLink || '',
    phone: vendor.phone || '',
    website: vendor.website || '',
    whatsappNumber: normalizeWhatsappNumber(vendor.phone),
    availabilitySettings: normalizeAvailabilitySettings(vendor.availabilitySettings),
    emoji: '🏷️',
    rating: 0,
    reviewCount: 0,
    priceLevel: null,
    booked: false,
    budgetRange: vendor.budgetRange || null,
    locations: buildDirectoryLocations(vendor),
    media,
    coverImageUrl: coverMedia?.type === 'IMAGE' ? coverMedia.url : '',
    tier: normalizeVendorTier(vendor.tier),
    isChoiceProfile: false,
  };
}

function resolveChoiceSourceVendors(choiceProfile, vendorsForType) {
  const normalizedVendors = Array.isArray(vendorsForType) ? vendorsForType : [];
  const approvedVendors = normalizedVendors.filter(vendor => Boolean(vendor?.isApproved));
  const sourceVendorIds = Array.isArray(choiceProfile?.sourceVendorIds)
    ? choiceProfile.sourceVendorIds.map(id => String(id || '').trim()).filter(Boolean)
    : [];

  if (sourceVendorIds.length > 0) {
    const sourceIdSet = new Set(sourceVendorIds);
    return approvedVendors.filter(vendor => sourceIdSet.has(String(vendor._id || '')));
  }

  return approvedVendors.filter(vendor => normalizeVendorTier(vendor.tier) === 'Free');
}

function buildDefaultSelectedVendorMedia(sourceVendors) {
  return sourceVendors.flatMap(vendor => collectVendorMedia(vendor).map((item) => ({
    vendorId: String(vendor._id || ''),
    vendorName: vendor.businessName || '',
    sourceMediaId: String(item?._id || ''),
    r2Url: item?.url || '',
    mediaType: item?.type || 'IMAGE',
    sortOrder: 0,
    filename: item?.filename || '',
    size: typeof item?.size === 'number' ? item.size : 0,
    caption: item?.caption || '',
    altText: item?.altText || '',
    isCover: Boolean(item?.isCover),
    isVisible: item?.isVisible !== false,
  })));
}

function resolveChoiceMedia(choiceProfile, vendorsForType) {
  const sourceVendorMap = new Map((Array.isArray(vendorsForType) ? vendorsForType : []).map(vendor => [String(vendor?._id || ''), vendor]));
  const storedVendorMedia = Array.isArray(choiceProfile?.selectedVendorMedia)
    ? sortChoiceMedia(choiceProfile.selectedVendorMedia)
    : [];
  const storedOwnedMedia = Array.isArray(choiceProfile?.media)
    ? sortChoiceMedia(choiceProfile.media)
    : [];
  const effectiveVendorMedia = storedVendorMedia.length > 0
    ? storedVendorMedia
    : buildDefaultSelectedVendorMedia(resolveChoiceSourceVendors(choiceProfile, vendorsForType));

  const vendorMedia = effectiveVendorMedia.map((item) => {
    const vendor = sourceVendorMap.get(String(item?.vendorId || ''));
    const vendorMediaItem = collectVendorMedia(vendor, { includeHidden: true }).find(mediaItem => String(mediaItem?._id || '') === String(item?.sourceMediaId || ''));
    if (!vendor || !vendorMediaItem) {
      return null;
    }

    return {
      sourceType: 'vendor',
      vendorId: String(vendor._id || ''),
      vendorName: vendor.businessName || '',
      sourceMediaId: String(vendorMediaItem?._id || ''),
      key: vendorMediaItem?.key || '',
      url: vendorMediaItem?.url || item?.r2Url || '',
      r2Url: vendorMediaItem?.url || item?.r2Url || '',
      type: vendorMediaItem?.type || item?.mediaType || 'IMAGE',
      mediaType: vendorMediaItem?.type || item?.mediaType || 'IMAGE',
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : 0,
      filename: vendorMediaItem?.filename || item?.filename || '',
      size: typeof vendorMediaItem?.size === 'number' ? vendorMediaItem.size : (typeof item?.size === 'number' ? item.size : 0),
      caption: vendorMediaItem?.caption || item?.caption || '',
      altText: vendorMediaItem?.altText || item?.altText || '',
      isCover: Boolean(item?.isCover),
      isVisible: item?.isVisible !== false && vendorMediaItem?.isVisible !== false,
    };
  }).filter(Boolean);

  const ownedMedia = storedOwnedMedia.map((item) => {
    if (!item?.url || !ALLOWED_MEDIA_TYPES.includes(item?.type)) {
      return null;
    }

    return {
      sourceType: 'admin',
      vendorId: '',
      vendorName: '',
      sourceMediaId: '',
      key: item?.key || '',
      url: item.url,
      r2Url: '',
      type: item.type,
      mediaType: item.type,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : 0,
      filename: item?.filename || '',
      size: typeof item?.size === 'number' ? item.size : 0,
      caption: item?.caption || '',
      altText: item?.altText || '',
      isCover: Boolean(item?.isCover),
      isVisible: item?.isVisible !== false,
    };
  }).filter(Boolean);

  return sortChoiceMedia([...vendorMedia, ...ownedMedia]).map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: index === 0 ? true : Boolean(item.isCover),
  }));
}

async function bootstrapChoiceProfiles(ChoiceProfile) {
  let existingProfiles = [];
  if (typeof ChoiceProfile.find === 'function') {
    const query = ChoiceProfile.find({ type: { $in: DEFAULT_VCA_TYPES } });
    if (query && typeof query.select === 'function') {
      existingProfiles = await (typeof query.lean === 'function'
        ? query.select('-__v').lean()
        : query.select('-__v'));
    } else {
      existingProfiles = await query;
    }
  }

  const existingByType = new Map((Array.isArray(existingProfiles) ? existingProfiles : []).map(profile => [String(profile?.type || '').trim(), profile]));
  const bootstrapped = [];

  for (const type of DEFAULT_VCA_TYPES) {
    const seedProfile = buildDefaultChoiceProfileSeed(type);
    const existingProfile = existingByType.get(type) || null;
    if (typeof ChoiceProfile.findOneAndUpdate === 'function') {
      const upserted = await ChoiceProfile.findOneAndUpdate(
        { _id: buildChoiceProfileId(type) },
        {
          $setOnInsert: seedProfile,
          $set: {
            type,
            businessName: existingProfile?.businessName || existingProfile?.name || seedProfile.businessName,
            name: existingProfile?.name || existingProfile?.businessName || seedProfile.name,
            isApproved: true,
            tier: 'Plus',
            isActive: existingProfile?.isActive !== false,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      bootstrapped.push(upserted);
    } else {
      bootstrapped.push({ ...seedProfile, ...(existingProfile || {}) });
    }
  }

  return bootstrapped;
}

function resolveChoiceProfile(choiceProfile, vendorsForType) {
  const sourceVendors = resolveChoiceSourceVendors(choiceProfile, vendorsForType);
  const media = resolveChoiceMedia(choiceProfile, vendorsForType);
  const derivedBudgetRange = buildAggregatedBudgetRange(sourceVendors);
  const derivedServices = buildAggregatedServices(sourceVendors);
  const derivedAvailabilitySettings = buildAggregatedAvailabilitySettings(sourceVendors);
  const normalizedServices = Array.isArray(choiceProfile?.services)
    ? choiceProfile.services.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];

  return {
    id: String(choiceProfile?._id || buildChoiceProfileId(choiceProfile?.type)),
    type: normalizeVendorType(choiceProfile?.type),
    name: choiceProfile?.name || choiceProfile?.businessName || buildChoiceProfileName(choiceProfile?.type),
    subType: choiceProfile?.subType || '',
    description: choiceProfile?.description || (sourceVendors.length > 0
      ? `Curated by VivahGo from approved ${String(choiceProfile?.type || 'vendor').toLowerCase()} partners.`
      : ''),
    services: normalizedServices.length > 0 ? normalizedServices : derivedServices,
    bundledServices: Array.isArray(choiceProfile?.bundledServices) && choiceProfile.bundledServices.length > 0
      ? choiceProfile.bundledServices.map(normalizeVendorType)
      : derivedServices.map(normalizeVendorType),
    country: choiceProfile?.country || '',
    state: choiceProfile?.state || '',
    city: choiceProfile?.city || '',
    googleMapsLink: choiceProfile?.googleMapsLink || '',
    phone: choiceProfile?.phone || '',
    website: choiceProfile?.website || '',
    whatsappNumber: normalizeWhatsappNumber(choiceProfile?.phone),
    budgetRange: choiceProfile?.budgetRange?.min && choiceProfile?.budgetRange?.max ? choiceProfile.budgetRange : derivedBudgetRange,
    availabilitySettings: normalizeAvailabilitySettings(choiceProfile?.availabilitySettings || derivedAvailabilitySettings),
    coverageAreas: Array.isArray(choiceProfile?.coverageAreas) ? choiceProfile.coverageAreas : [],
    sourceVendorIds: sourceVendors.map(vendor => String(vendor._id || '')),
    sourceVendorCount: sourceVendors.length,
    selectedVendorMedia: media.filter(item => item.sourceType === 'vendor'),
    ownedMedia: media.filter(item => item.sourceType !== 'vendor'),
    media,
  };
}

function buildPublicChoiceDirectoryEntry(choiceProfile, vendorsForType) {
  const resolved = resolveChoiceProfile(choiceProfile, vendorsForType);
  const visibleMedia = sortChoiceMedia(resolved.media).filter(item => item?.isVisible !== false);
  const coverMedia = visibleMedia.find(item => item?.isCover) || visibleMedia[0] || null;

  if (!resolved.type) {
    return null;
  }

  return {
    id: resolved.id,
    name: resolved.name,
    type: resolved.type,
    subType: resolved.subType,
    bundledServices: resolved.bundledServices,
    services: resolved.services,
    description: resolved.description || `Curated by VivahGo for ${String(resolved.type || 'wedding vendors').toLowerCase()}.`,
    country: resolved.country,
    state: resolved.state,
    city: resolved.city,
    googleMapsLink: resolved.googleMapsLink,
    phone: resolved.phone,
    website: resolved.website,
    whatsappNumber: resolved.whatsappNumber,
    availabilitySettings: resolved.availabilitySettings,
    emoji: '⭐',
    rating: 0,
    reviewCount: 0,
    priceLevel: null,
    booked: false,
    budgetRange: resolved.budgetRange,
    locations: buildDirectoryLocations(resolved),
    media: visibleMedia,
    coverImageUrl: coverMedia?.type === 'IMAGE' ? coverMedia.url : '',
    tier: 'Choice',
    featuredLabel: "VivahGo's Choice",
    serviceMode: 'Curated from approved vendors',
    isChoiceProfile: true,
  };
}

/******************************************************************************
 * /api/vendors
 *
 * The public vendor directory is grouped here with authenticated vendor APIs so
 * Vercel deploys one function while the external URL remains unchanged.
 ******************************************************************************/

async function handleVendorList(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  setCacheControl(res, 'vendorDirectory');

  try {
    return await withRequestMetrics('vendor:list', async () => {
      const cached = getPublicCache(VENDOR_DIRECTORY_CACHE_KEY);
      if (cached) {
        console.info('[cache] hit', { key: VENDOR_DIRECTORY_CACHE_KEY, source: 'memory-snapshot' });
        return res.status(200).json(cached.value);
      }

      await connectDb();
      const Vendor = getVendorModel();
      const ChoiceProfile = getChoiceProfileModel();

      const raw = await Vendor.find({ isApproved: true })
        .select('-__v')
        .lean();
      const choiceProfiles = await bootstrapChoiceProfiles(ChoiceProfile);

      const plusVendors = raw
        .filter(vendor => normalizeVendorTier(vendor?.tier) === 'Plus')
        .map(buildPublicVendorDirectoryEntry);
      const freeVendorsByType = raw.reduce((map, vendor) => {
        const type = normalizeVendorType(vendor?.type);
        if (!type) {
          return map;
        }
        if (!map.has(type)) {
          map.set(type, []);
        }
        map.get(type).push(vendor);
        return map;
      }, new Map());
      const choiceProfilesByType = new Map(choiceProfiles.map(profile => [normalizeVendorType(profile?.type), profile]));
      const resolvedChoiceProfiles = DEFAULT_VCA_TYPES
        .map((type) => {
          const savedProfile = choiceProfilesByType.get(type);
          return buildPublicChoiceDirectoryEntry(
            savedProfile || buildDefaultChoiceProfileSeed(type),
            freeVendorsByType.get(type) || []
          );
        })
        .filter(Boolean);

      const payload = { vendors: [...resolvedChoiceProfiles, ...plusVendors] };
      setPublicCache(VENDOR_DIRECTORY_CACHE_KEY, payload, { tags: [VENDOR_DIRECTORY_CACHE_TAG] });
      console.info('[cache] miss', { key: VENDOR_DIRECTORY_CACHE_KEY, source: 'db' });
      return res.status(200).json(payload);
    });
  } catch (error) {
    console.error('Approved vendors fetch failed:', error);
    return res.status(500).json({ error: 'Could not fetch vendors.' });
  }
}

/******************************************************************************
 * /api/vendor/me
 ******************************************************************************/

async function handleVendorMe(req, res) {
  setCacheControl(res, 'noStore');

  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  const { auth, error: authError, status = 401 } = verifySession(req);
  if (authError) {
    return res.status(status).json({ error: authError });
  }

  try {
    await connectDb();
    const Vendor = getVendorModel();
    const User = getUserModel();
    const baseRevision = normalizeVendorRevision(req.body?.baseRevision);
    const correlationId = typeof req.body?.correlationId === 'string' ? req.body.correlationId : '';
    const clientSequence = normalizeClientSequence(req.body?.clientSequence);
    const mutationMeta = { correlationId, clientSequence };

    if (req.method === 'GET') {
      const vendor = await loadVendorSnapshot(Vendor, { googleId: auth.sub });
      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
      return res.status(200).json(await buildVendorMutationResponse(vendor));
    }

    if (req.method === 'POST') {
      const { businessName, type, subType, description, country, state, city, googleMapsLink, phone, website, coverageAreas, bundledServices, budgetRange, availabilitySettings } = req.body || {};

      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        return res.status(400).json({ error: 'businessName is required.' });
      }
      const normalizedType = normalizeVendorType(type);
      if (!VENDOR_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      let normalizedSubType = '';
      try {
        normalizedSubType = normalizeVendorSubtype(normalizedType, subType);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!isLikelyHttpUrl((website || '').trim()) || !isLikelyHttpUrl((googleMapsLink || '').trim())) {
        return res.status(400).json({ error: 'website and googleMapsLink must start with http:// or https://.' });
      }

      const existing = await loadVendorSnapshot(Vendor, { googleId: auth.sub });
      if (existing) {
        return res.status(409).json({ error: 'Vendor profile already exists. Use PATCH to update.' });
      }

      let normalizedBudgetRange;
      let normalizedAvailabilitySettings;
      try {
        normalizedBudgetRange = normalizeBudgetRange(budgetRange || {});
        normalizedAvailabilitySettings = normalizeAvailabilitySettings(availabilitySettings);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const vendor = await Vendor.create({
        googleId: auth.sub,
        businessName: businessName.trim(),
        type: normalizedType,
        subType: normalizedSubType,
        bundledServices: normalizeBundledServices(normalizedType, bundledServices),
        country: (country || '').trim(),
        state: (state || '').trim(),
        description: (description || '').trim(),
        city: (city || '').trim(),
        googleMapsLink: (googleMapsLink || '').trim(),
        coverageAreas: normalizeCoverageAreas(coverageAreas),
        phone: (phone || '').trim(),
        website: (website || '').trim(),
        budgetRange: normalizedBudgetRange,
        availabilitySettings: normalizedAvailabilitySettings,
        vendorRevision: 1,
      });

      await User.findOneAndUpdate(
        { googleId: auth.sub },
        { $set: { isVendor: true, vendorId: vendor._id } }
      );
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });

      return res.status(201).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const updates = {};
      const existingVendor = await loadVendorSnapshot(Vendor, { googleId: auth.sub });

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const currentVendorRevision = Math.max(0, Number(existingVendor?.vendorRevision) || 0);
      if (baseRevision !== null && baseRevision < currentVendorRevision) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }

      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (typeof body[field] === 'string') {
          updates[field] = body[field].trim();
        }
      }

      if (typeof updates.type === 'string') {
        updates.type = normalizeVendorType(updates.type);
      }

      if (Array.isArray(body.coverageAreas)) {
        updates.coverageAreas = normalizeCoverageAreas(body.coverageAreas);
      }

      if (Array.isArray(body.bundledServices)) {
        updates.bundledServices = normalizeBundledServices(updates.type || normalizeVendorType(existingVendor.type), body.bundledServices);
      }

      if (body.budgetRange && typeof body.budgetRange === 'object') {
        try {
          updates.budgetRange = normalizeBudgetRange(body.budgetRange);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      if (body.availabilitySettings && typeof body.availabilitySettings === 'object') {
        try {
          updates.availabilitySettings = normalizeAvailabilitySettings(body.availabilitySettings);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      if (updates.type && !VENDOR_TYPES.includes(updates.type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      if (typeof updates.website === 'string' && !isLikelyHttpUrl(updates.website)) {
        return res.status(400).json({ error: 'website must start with http:// or https://.' });
      }

      if (typeof updates.googleMapsLink === 'string' && !isLikelyHttpUrl(updates.googleMapsLink)) {
        return res.status(400).json({ error: 'googleMapsLink must start with http:// or https://.' });
      }

      try {
        const resolvedType = updates.type || normalizeVendorType(existingVendor.type);
        if ('subType' in updates || updates.type) {
          updates.subType = normalizeVendorSubtype(resolvedType, updates.subType ?? body.subType ?? '');
        }
        if (updates.type && !('bundledServices' in updates)) {
          updates.bundledServices = normalizeBundledServices(resolvedType, existingVendor.bundledServices);
        }
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const vendor = await Vendor.findOneAndUpdate(
        {
          googleId: auth.sub,
          ...buildVendorRevisionFilter(currentVendorRevision),
        },
        {
          $set: updates,
          $inc: { vendorRevision: 1 },
        },
        { new: true, runValidators: true }
      );
      if (!vendor) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
      return res.status(200).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }
  } catch (error) {
    console.error('Vendor profile error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}

/******************************************************************************
 * /api/vendor/media
 *
 * Media management is intentionally grouped below the profile flow because it
 * shares the same auth context but has enough branching to deserve a dedicated
 * section for future uploads, crops, and moderation actions.
 ******************************************************************************/

async function handleVendorMedia(req, res) {
  setCacheControl(res, 'noStore');

  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  const { auth, error: authError, status = 401 } = verifySession(req);
  if (authError) {
    return res.status(status).json({ error: authError });
  }

  try {
    await connectDb();
    const Vendor = getVendorModel();
    const baseRevision = normalizeVendorRevision(req.body?.baseRevision);
    const correlationId = typeof req.body?.correlationId === 'string' ? req.body.correlationId : '';
    const clientSequence = normalizeClientSequence(req.body?.clientSequence);
    const mutationMeta = { correlationId, clientSequence };

    if (req.method === 'POST') {
      const { key, url, type, sortOrder, filename, size, caption, altText, isVisible } = req.body || {};
      const normalizedKey = typeof key === 'string' && key ? key.replace(/^\/+/, '') : extractObjectKeyFromUrl(url);

      if (!normalizedKey) {
        return res.status(400).json({ error: 'A valid media key is required.' });
      }
      if (!isVendorMediaKeyForOwner(normalizedKey, auth.sub)) {
        return res.status(400).json({ error: 'Media key must belong to your account.' });
      }
      if (!ALLOWED_MEDIA_TYPES.includes(type)) {
        return res.status(400).json({ error: 'type must be IMAGE or VIDEO.' });
      }

      const existingVendor = await loadVendorSnapshot(Vendor, { googleId: auth.sub });

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const currentVendorRevision = Math.max(0, Number(existingVendor?.vendorRevision) || 0);
      if (baseRevision !== null && baseRevision < currentVendorRevision) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }

      const nextMedia = cloneVendorMediaItems(existingVendor.media);
      const nextSortOrder = Array.isArray(nextMedia)
        ? nextMedia.reduce((highest, item, index) => {
          const current = typeof item?.sortOrder === 'number' ? item.sortOrder : index;
          return Math.max(highest, current);
        }, -1) + 1
        : 0;

      let publicUrl = '';
      try {
        publicUrl = createPublicObjectUrl(normalizedKey);
      } catch {}

      nextMedia.push({
        _id: createSubdocumentId(),
        key: normalizedKey,
        url: publicUrl,
        type,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : nextSortOrder,
        filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
        size: typeof size === 'number' && size >= 0 ? size : 0,
        caption: sanitizeText(caption, MAX_CAPTION_LENGTH),
        altText: sanitizeText(altText, MAX_ALT_TEXT_LENGTH),
        isVisible: typeof isVisible === 'boolean' ? isVisible : true,
        isCover: !nextMedia.some(item => item?.isCover),
      });

      const vendor = await applyVendorRevisionUpdate(Vendor, auth.sub, currentVendorRevision, { media: nextMedia });
      if (!vendor) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
      return res.status(201).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }

    if (req.method === 'PUT') {
      const { mediaId, caption, altText, isVisible, makeCover, mediaIds } = req.body || {};
      const existingVendor = await loadVendorSnapshot(Vendor, { googleId: auth.sub });

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const currentVendorRevision = Math.max(0, Number(existingVendor?.vendorRevision) || 0);
      if (baseRevision !== null && baseRevision < currentVendorRevision) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }

      const nextMedia = cloneVendorMediaItems(existingVendor.media);

      if (Array.isArray(mediaIds)) {
        const normalizedIds = mediaIds.filter(id => typeof id === 'string' && id);
        if (normalizedIds.length !== nextMedia.length) {
          return res.status(400).json({ error: 'mediaIds must include every portfolio item exactly once.' });
        }

        const seen = new Set();
        for (const id of normalizedIds) {
          if (seen.has(id)) {
            return res.status(400).json({ error: 'mediaIds must not contain duplicates.' });
          }
          seen.add(id);
        }

        const itemsById = new Map(nextMedia.map(item => [String(item._id), item]));
        if (normalizedIds.some(id => !itemsById.has(id))) {
          return res.status(400).json({ error: 'mediaIds includes an unknown portfolio item.' });
        }

        normalizedIds.forEach((id, index) => {
          itemsById.get(id).sortOrder = index;
        });

        const vendor = await applyVendorRevisionUpdate(Vendor, auth.sub, currentVendorRevision, { media: nextMedia });
        if (!vendor) {
          return res.status(409).json(
            buildVendorConflictPayload({
              correlationId,
              clientSequence,
              vendorRevision: currentVendorRevision,
            })
          );
        }
        invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
        return res.status(200).json(await buildVendorMutationResponse(vendor, mutationMeta));
      }

      if (!mediaId || typeof mediaId !== 'string') {
        return res.status(400).json({ error: 'mediaId is required.' });
      }

      const targetIndex = findSubdocumentIndex(nextMedia, mediaId);
      if (targetIndex < 0) {
        return res.status(404).json({ error: 'Media item not found.' });
      }
      const target = nextMedia[targetIndex];

      if (typeof caption === 'string') {
        target.caption = sanitizeText(caption, MAX_CAPTION_LENGTH);
      }
      if (typeof altText === 'string') {
        target.altText = sanitizeText(altText, MAX_ALT_TEXT_LENGTH);
      }
      if (typeof isVisible === 'boolean') {
        target.isVisible = isVisible;
      }
      if (makeCover === true) {
        nextMedia.forEach(item => {
          item.isCover = String(item._id) === mediaId;
        });
      }

      const vendor = await applyVendorRevisionUpdate(Vendor, auth.sub, currentVendorRevision, { media: nextMedia });
      if (!vendor) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
      return res.status(200).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }

    if (req.method === 'DELETE') {
      const { mediaId } = req.body || {};

      if (!mediaId || typeof mediaId !== 'string') {
        return res.status(400).json({ error: 'mediaId is required.' });
      }

      const existingVendor = await loadVendorSnapshot(Vendor, { googleId: auth.sub });

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const currentVendorRevision = Math.max(0, Number(existingVendor?.vendorRevision) || 0);
      if (baseRevision !== null && baseRevision < currentVendorRevision) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }

      const nextMedia = cloneVendorMediaItems(existingVendor.media);
      const targetIndex = findSubdocumentIndex(nextMedia, mediaId);
      if (targetIndex < 0) {
        return res.status(404).json({ error: 'Media item not found.' });
      }

      const [target] = nextMedia.splice(targetIndex, 1);
      const wasCover = Boolean(target?.isCover);

      const sortedMedia = [...nextMedia].sort((a, b) => {
        const orderA = typeof a?.sortOrder === 'number' ? a.sortOrder : 0;
        const orderB = typeof b?.sortOrder === 'number' ? b.sortOrder : 0;
        return orderA - orderB;
      });

      if (wasCover && sortedMedia.length > 0) {
        nextMedia.forEach(item => {
          item.isCover = false;
        });
        sortedMedia[0].isCover = true;
      }

      sortedMedia.forEach((item, index) => {
        item.sortOrder = index;
      });

      const vendor = await applyVendorRevisionUpdate(Vendor, auth.sub, currentVendorRevision, { media: sortedMedia });
      if (!vendor) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
      return res.status(200).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }
  } catch (error) {
    console.error('Vendor media error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}

/******************************************************************************
 * /api/vendor/verification
 ******************************************************************************/

async function handleVendorVerification(req, res) {
  setCacheControl(res, 'noStore');

  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  const { auth, error: authError, status = 401 } = verifySession(req);
  if (authError) {
    return res.status(status).json({ error: authError });
  }

  try {
    await connectDb();
    const Vendor = getVendorModel();
    const baseRevision = normalizeVendorRevision(req.body?.baseRevision);
    const correlationId = typeof req.body?.correlationId === 'string' ? req.body.correlationId : '';
    const clientSequence = normalizeClientSequence(req.body?.clientSequence);
    const mutationMeta = { correlationId, clientSequence };
    const existingVendor = await loadVendorSnapshot(Vendor, { googleId: auth.sub });

    if (!existingVendor) {
      return res.status(404).json({ error: 'No vendor profile found.' });
    }

    const currentVendorRevision = Math.max(0, Number(existingVendor?.vendorRevision) || 0);
    if (baseRevision !== null && baseRevision < currentVendorRevision) {
      return res.status(409).json(
        buildVendorConflictPayload({
          correlationId,
          clientSequence,
          vendorRevision: currentVendorRevision,
        })
      );
    }

    if (req.method === 'POST') {
      const { key, filename, size, contentType, documentType } = req.body || {};
      const normalizedKey = typeof key === 'string' ? key.replace(/^\/+/, '') : '';

      if (!normalizedKey) {
        return res.status(400).json({ error: 'A valid verification document key is required.' });
      }
      if (!isVendorVerificationKeyForOwner(normalizedKey, auth.sub)) {
        return res.status(400).json({ error: 'Verification document key must belong to your account.' });
      }
      if (!ALLOWED_VERIFICATION_DOCUMENT_TYPES.includes(documentType)) {
        return res.status(400).json({ error: `documentType must be one of: ${ALLOWED_VERIFICATION_DOCUMENT_TYPES.join(', ')}.` });
      }

      const nextVerificationDocuments = cloneVerificationDocuments(existingVendor.verificationDocuments);
      nextVerificationDocuments.push({
        _id: createSubdocumentId(),
        key: normalizedKey,
        filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
        size: typeof size === 'number' && size >= 0 ? size : 0,
        contentType: typeof contentType === 'string' ? contentType.slice(0, 120) : '',
        documentType,
        uploadedAt: new Date(),
      });
      const vendor = await applyVendorRevisionUpdate(Vendor, auth.sub, currentVendorRevision, {
        verificationDocuments: nextVerificationDocuments,
        verificationStatus: 'submitted',
        verificationReviewedAt: null,
        verificationReviewedBy: '',
      });
      if (!vendor) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
      return res.status(201).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }

    if (req.method === 'DELETE') {
      const { documentId } = req.body || {};
      if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ error: 'documentId is required.' });
      }

      const nextVerificationDocuments = cloneVerificationDocuments(existingVendor.verificationDocuments);
      const targetIndex = findSubdocumentIndex(nextVerificationDocuments, documentId);
      if (targetIndex < 0) {
        return res.status(404).json({ error: 'Verification document not found.' });
      }

      const [target] = nextVerificationDocuments.splice(targetIndex, 1);
      const targetKey = typeof target?.key === 'string' ? target.key.replace(/^\/+/, '') : '';
      const nextVerificationStatus = nextVerificationDocuments.length === 0
        ? 'not_submitted'
        : existingVendor.verificationStatus === 'approved'
          ? 'submitted'
          : existingVendor.verificationStatus;
      const nextVerificationNotes = nextVerificationDocuments.length === 0
        ? ''
        : sanitizeVerificationNotes(existingVendor.verificationNotes);
      const nextReviewedAt = nextVerificationDocuments.length === 0 ? null : (existingVendor.verificationReviewedAt || null);
      const nextReviewedBy = nextVerificationDocuments.length === 0 ? '' : (existingVendor.verificationReviewedBy || '');

      const vendor = await applyVendorRevisionUpdate(Vendor, auth.sub, currentVendorRevision, {
        verificationDocuments: nextVerificationDocuments,
        verificationStatus: nextVerificationStatus,
        verificationNotes: nextVerificationNotes,
        verificationReviewedAt: nextReviewedAt,
        verificationReviewedBy: nextReviewedBy,
      });
      if (!vendor) {
        return res.status(409).json(
          buildVendorConflictPayload({
            correlationId,
            clientSequence,
            vendorRevision: currentVendorRevision,
          })
        );
      }
      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });
      if (targetKey) {
        try {
          await deleteB2Object(targetKey);
        } catch (error) {
          console.error('Vendor verification document delete failed:', error);
        }
      }
      return res.status(200).json(await buildVendorMutationResponse(vendor, mutationMeta));
    }
  } catch (error) {
    console.error('Vendor verification error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}

/******************************************************************************
 * Main Entrypoint
 ******************************************************************************/

async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }
  setCorsHeaders(req, res);

  const route = resolveVendorRoute(req);

  if (route === 'list') {
    return handleVendorList(req, res);
  }

  if (route === 'me') {
    return handleVendorMe(req, res);
  }

  if (route === 'media') {
    return handleVendorMedia(req, res);
  }

  if (route === 'verification') {
    return handleVendorVerification(req, res);
  }

  res.setHeader('Allow', 'OPTIONS');
  return res.status(404).json({ error: 'Vendor route not found.' });
}

module.exports = handler;
module.exports.handleVendorList = handleVendorList;
module.exports.handleVendorMe = handleVendorMe;
module.exports.handleVendorMedia = handleVendorMedia;
module.exports.handleVendorVerification = handleVendorVerification;
