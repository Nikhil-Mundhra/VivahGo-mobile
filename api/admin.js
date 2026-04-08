const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

const {
  applyRateLimit,
  getBillingReceiptModel,
  getCareerApplicationModel,
  getCareerEmailTemplateModel,
  getChoiceProfileModel,
  getVendorModel,
  handlePreflight,
  invalidatePublicCache,
  normalizeEmail,
  normalizeStaffRole,
  requireCsrfProtection,
  setCacheControl,
  setCorsHeaders,
} = require('./_lib/core');
const { requireAdminSession, sanitizeStaffUser } = require('./_lib/admin');
const { createPresignedPutUrl, createPublicObjectUrl, normalizeMediaList, objectKeyMatchesScope } = require('./_lib/r2');
const { createB2PresignedGetUrl, deleteB2Object } = require('./_lib/b2');
const { getDefaultCareerRejectionTemplate, sanitizeCareerRejectionTemplate, sendCareerRejectionEmail } = require('./_lib/careers-admin');
const { serializeApplication } = require('./careers');
const { buildAggregatedBudgetRange, buildAggregatedServices, buildChoiceProfileName, normalizeVendorTier, sortChoiceMedia } = require('./_lib/vendor-choice');
const {
  DEFAULT_VCA_TYPES,
  buildChoiceProfileId,
  buildChoiceProfileSeedOverrides,
  buildDefaultChoiceProfileSeed,
  inferChoiceBudgetRangeMode,
  normalizeChoiceBudgetRangeMode,
  normalizeChoiceProfileSeedOverrides,
} = require('./_lib/vca');

const CAREER_REJECTION_TEMPLATE_KEY = 'career-application-rejection';
const VENDOR_DIRECTORY_CACHE_TAG = 'vendors';

/******************************************************************************
 * Shared Helpers
 ******************************************************************************/

function resolveAdminRoute(req) {
  const queryRoute = String(req.query?.route || '').trim().toLowerCase();
  if (queryRoute) {
    return queryRoute;
  }

  const path = String(req.path || req.url || '').split('?')[0].trim().toLowerCase();
  if (path.endsWith('/admin/me')) {
    return 'me';
  }
  if (path.endsWith('/admin/vendors')) {
    return 'vendors';
  }
  if (path.endsWith('/admin/choice')) {
    return 'choice';
  }
  if (path.endsWith('/admin/choice-media-upload')) {
    return 'choice-media-upload';
  }
  if (path.endsWith('/admin/staff')) {
    return 'staff';
  }
  if (path.endsWith('/admin/applications')) {
    return 'applications';
  }
  if (path.endsWith('/admin/resume-download')) {
    return 'resume-download';
  }
  if (path.endsWith('/admin/subscribers')) {
    return 'subscribers';
  }

  return '';
}

function normalizeResumeStorageKey(value) {
  return typeof value === 'string' ? value.trim().replace(/^\/+/, '') : '';
}

function isAllowedResumeStorageKey(key) {
  return key.startsWith('careers/resumes/') || key.startsWith('resumes/');
}

function normalizeResumeAccessMode(value) {
  return String(value || '').trim().toLowerCase() === 'preview' ? 'preview' : 'download';
}

function normalizeResumeResponseMode(value) {
  return String(value || '').trim().toLowerCase() === 'json' ? 'json' : 'redirect';
}

function normalizeResumeFilename(value, fallback = 'resume.pdf') {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const normalized = (candidate || fallback)
    .replace(/["\r\n]+/g, '')
    .replace(/[\\/]+/g, '-')
    .slice(0, 255);

  return normalized || fallback;
}

function normalizeAction(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeObjectId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveCareerRejectionTemplate(CareerEmailTemplate) {
  const defaults = getDefaultCareerRejectionTemplate();
  if (!CareerEmailTemplate || typeof CareerEmailTemplate.findOne !== 'function') {
    return defaults;
  }

  const existing = await resolveLean(CareerEmailTemplate.findOne({ templateKey: CAREER_REJECTION_TEMPLATE_KEY }));
  if (!existing) {
    return defaults;
  }

  return sanitizeCareerRejectionTemplate(existing);
}

async function saveCareerRejectionTemplate(CareerEmailTemplate, template, updatedBy) {
  const sanitized = sanitizeCareerRejectionTemplate(template);
  if (!CareerEmailTemplate || typeof CareerEmailTemplate.findOneAndUpdate !== 'function') {
    return sanitized;
  }

  const updated = await resolveLean(CareerEmailTemplate.findOneAndUpdate(
    { templateKey: CAREER_REJECTION_TEMPLATE_KEY },
    {
      $set: {
        templateKey: CAREER_REJECTION_TEMPLATE_KEY,
        subject: sanitized.subject,
        body: sanitized.body,
        updatedBy: updatedBy || '',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ));

  return sanitizeCareerRejectionTemplate(updated || sanitized);
}

async function resolveLean(result) {
  if (!result) {
    return null;
  }
  if (typeof result.lean === 'function') {
    return result.lean();
  }
  if (typeof result.toObject === 'function') {
    return result.toObject();
  }
  return result;
}

async function serializeAdminVendor(vendor = {}) {
  const media = normalizeMediaList(vendor.media)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
  const verificationDocuments = Array.isArray(vendor.verificationDocuments)
    ? vendor.verificationDocuments.filter(document => objectKeyMatchesScope(document?.key, 'vendor-verification', vendor.googleId))
    : [];
  const signedVerificationDocuments = await Promise.all(verificationDocuments.map(async document => {
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
      ...document,
      _id: String(document?._id || ''),
      key,
      accessUrl,
    };
  }));

  return {
    id: String(vendor._id || ''),
    googleId: vendor.googleId || '',
    businessName: vendor.businessName || '',
    type: vendor.type || '',
    subType: vendor.subType || '',
    description: vendor.description || '',
    country: vendor.country || '',
    state: vendor.state || '',
    city: vendor.city || '',
    phone: vendor.phone || '',
    website: vendor.website || '',
    googleMapsLink: vendor.googleMapsLink || '',
    bundledServices: Array.isArray(vendor.bundledServices) ? vendor.bundledServices : [],
    coverageAreas: Array.isArray(vendor.coverageAreas) ? vendor.coverageAreas : [],
    budgetRange: vendor.budgetRange || null,
    isApproved: Boolean(vendor.isApproved),
    tier: normalizeVendorTier(vendor.tier),
    verificationStatus: vendor.verificationStatus || (verificationDocuments.length ? 'submitted' : 'not_submitted'),
    verificationNotes: vendor.verificationNotes || '',
    verificationReviewedAt: vendor.verificationReviewedAt || null,
    verificationReviewedBy: vendor.verificationReviewedBy || '',
    verificationDocuments: signedVerificationDocuments,
    verificationDocumentCount: signedVerificationDocuments.length,
    mediaCount: media.length,
    media,
    createdAt: vendor.createdAt || null,
    updatedAt: vendor.updatedAt || null,
  };
}

function buildFallbackAdminVendor(vendor = {}) {
  return {
    id: String(vendor?._id || ''),
    googleId: vendor?.googleId || '',
    businessName: vendor?.businessName || '',
    type: vendor?.type || '',
    subType: vendor?.subType || '',
    description: vendor?.description || '',
    country: vendor?.country || '',
    state: vendor?.state || '',
    city: vendor?.city || '',
    phone: vendor?.phone || '',
    website: vendor?.website || '',
    googleMapsLink: vendor?.googleMapsLink || '',
    bundledServices: Array.isArray(vendor?.bundledServices) ? vendor.bundledServices : [],
    coverageAreas: Array.isArray(vendor?.coverageAreas) ? vendor.coverageAreas : [],
    budgetRange: vendor?.budgetRange || null,
    isApproved: Boolean(vendor?.isApproved),
    tier: normalizeVendorTier(vendor?.tier),
    verificationStatus: vendor?.verificationStatus || 'not_submitted',
    verificationNotes: vendor?.verificationNotes || '',
    verificationReviewedAt: vendor?.verificationReviewedAt || null,
    verificationReviewedBy: vendor?.verificationReviewedBy || '',
    verificationDocuments: [],
    verificationDocumentCount: 0,
    mediaCount: 0,
    media: [],
    createdAt: vendor?.createdAt || null,
    updatedAt: vendor?.updatedAt || null,
  };
}

function normalizeChoiceCoverageAreas(value) {
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

function hasOwnPayloadField(payload, fieldName) {
  return Boolean(payload) && Object.prototype.hasOwnProperty.call(payload, fieldName);
}

function normalizeChoiceTextField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChoiceServices(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  )).slice(0, 80);
}

function normalizeChoiceBudgetRange(value, fallback = null) {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const min = Number(value.min);
  const max = Number(value.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return fallback;
  }

  return {
    min: Math.round(Math.min(min, max)),
    max: Math.round(Math.max(min, max)),
  };
}

function resolveChoiceBudgetRangeForMode(mode, customBudgetRange, aggregatedBudgetRange) {
  if (mode === 'hidden') {
    return null;
  }

  if (mode === 'merged') {
    return normalizeChoiceBudgetRange(aggregatedBudgetRange, null);
  }

  return normalizeChoiceBudgetRange(customBudgetRange, null);
}

function isValidAvailabilityDateKey(value) {
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

function normalizeChoiceAvailabilityCount(value, { min = 0, fieldName = 'availability capacity' } = {}) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (number < min || number > 99) {
    throw new Error(`${fieldName} must be between ${min} and 99.`);
  }

  return number;
}

function normalizeChoiceAvailabilitySettings(value, fallback = null) {
  if (!value || typeof value !== 'object') {
    return fallback || {
      hasDefaultCapacity: true,
      defaultMaxCapacity: 1,
      dateOverrides: [],
    };
  }

  const hasDefaultCapacity = value.hasDefaultCapacity !== false;
  const defaultMaxCapacity = hasDefaultCapacity
    ? normalizeChoiceAvailabilityCount(
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
      if (!isValidAvailabilityDateKey(date)) {
        throw new Error('availabilitySettings.dateOverrides[].date must use YYYY-MM-DD.');
      }
      if (seenDates.has(date)) {
        throw new Error('availabilitySettings.dateOverrides must not contain duplicate dates.');
      }
      seenDates.add(date);

      return {
        date,
        maxCapacity: normalizeChoiceAvailabilityCount(
          item.maxCapacity,
          { min: 0, fieldName: 'availabilitySettings.dateOverrides[].maxCapacity' }
        ),
        // Preserve imported booking counts, but clamp them after capacity is validated.
        rawBookingsCount: item.bookingsCount ?? 0,
      };
    })
    .map(item => {
      const bookingsCount = normalizeChoiceAvailabilityCount(
        item.rawBookingsCount,
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

function buildVendorAvailabilityState(vendor) {
  return normalizeChoiceAvailabilitySettings(vendor?.availabilitySettings, {
    hasDefaultCapacity: true,
    defaultMaxCapacity: 1,
    dateOverrides: [],
  });
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

  const vendorStates = normalizedVendors.map(buildVendorAvailabilityState);
  // Default capacity is the sum of each source vendor's baseline availability.
  const defaultMaxCapacity = Math.min(
    99,
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
    // For each date we aggregate both explicit overrides and vendor defaults, then
    // drop rows that would serialize back to the unchanged default state.
    const totals = vendorStates.reduce((accumulator, availability) => {
      const day = getAvailabilityDayForDate(availability, date);
      return {
        maxCapacity: Math.min(99, accumulator.maxCapacity + Number(day.maxCapacity || 0)),
        bookingsCount: Math.min(99, accumulator.bookingsCount + Number(day.bookingsCount || 0)),
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

function collectChoiceableVendorMedia(vendor, { includeHidden = true } = {}) {
  return normalizeMediaList(vendor?.media)
    .filter(item => includeHidden || item?.isVisible !== false)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
}

function normalizeChoiceMediaType(value, fallback = 'IMAGE') {
  return String(value || '').trim().toUpperCase() === 'VIDEO' ? 'VIDEO' : fallback;
}

function buildChoiceMediaPreviewUrl(item) {
  if (typeof item?.url === 'string' && item.url.trim()) {
    return item.url.trim();
  }
  if (typeof item?.r2Url === 'string' && item.r2Url.trim()) {
    return item.r2Url.trim();
  }
  return '';
}

function normalizeChoiceOwnedMediaInput(item, index) {
  if (!item?.url || !['IMAGE', 'VIDEO'].includes(String(item?.type || '').trim())) {
    throw new Error('media includes an invalid VCA-owned item.');
  }

  return {
    key: typeof item.key === 'string' ? item.key.trim() : '',
    url: String(item.url).trim(),
    type: String(item.type).trim(),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : index,
    filename: typeof item.filename === 'string' ? item.filename.trim().slice(0, 255) : '',
    size: typeof item.size === 'number' && item.size >= 0 ? item.size : 0,
    caption: typeof item.caption === 'string' ? item.caption.trim().slice(0, 280) : '',
    altText: typeof item.altText === 'string' ? item.altText.trim().slice(0, 180) : '',
    isCover: Boolean(item?.isCover),
    isVisible: item?.isVisible !== false,
  };
}

function normalizeChoiceSelectedVendorMediaInput(item, index, vendorsById) {
  const vendorId = normalizeObjectId(item?.vendorId);
  const sourceMediaId = normalizeObjectId(item?.sourceMediaId);
  const vendor = vendorsById.get(vendorId);
  const vendorMedia = collectChoiceableVendorMedia(vendor).find(mediaItem => String(mediaItem?._id || '') === sourceMediaId);

  if (!vendor || !vendorMedia) {
    throw new Error('selectedVendorMedia includes vendor media that is not available.');
  }

  return {
    vendorId,
    vendorName: vendor.businessName || '',
    sourceMediaId,
    r2Url: vendorMedia?.url || '',
    mediaType: vendorMedia?.type || 'IMAGE',
    sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : index,
    filename: vendorMedia?.filename || '',
    size: typeof vendorMedia?.size === 'number' ? vendorMedia.size : 0,
    caption: vendorMedia?.caption || '',
    altText: vendorMedia?.altText || '',
    isCover: Boolean(item?.isCover),
    isVisible: item?.isVisible !== false,
  };
}

function buildDefaultSelectedVendorMedia(sourceVendors) {
  return sourceVendors.flatMap(vendor => collectChoiceableVendorMedia(vendor, { includeHidden: false }).map(item => ({
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

function resolveChoiceSourceVendors(choiceProfile, vendorsForType) {
  const approvedVendors = (Array.isArray(vendorsForType) ? vendorsForType : []).filter(vendor => Boolean(vendor?.isApproved));
  const sourceVendorIds = Array.isArray(choiceProfile?.sourceVendorIds)
    ? choiceProfile.sourceVendorIds.map(id => String(id || '').trim()).filter(Boolean)
    : [];

  if (sourceVendorIds.length > 0) {
    const sourceIdSet = new Set(sourceVendorIds);
    return approvedVendors.filter(vendor => sourceIdSet.has(String(vendor._id || '')));
  }

  return approvedVendors.filter(vendor => normalizeVendorTier(vendor.tier) === 'Free');
}

function resolveAdminChoiceMedia(choiceProfile, vendorsForType) {
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

  const vendorMedia = effectiveVendorMedia
    .map((item) => {
      const vendor = sourceVendorMap.get(String(item?.vendorId || ''));
      const vendorMediaItem = collectChoiceableVendorMedia(vendor).find(mediaItem => String(mediaItem?._id || '') === String(item?.sourceMediaId || ''));
      if (!vendor || !vendorMediaItem) {
        // Skip stale references when a vendor or media item has been removed or hidden.
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
        type: normalizeChoiceMediaType(vendorMediaItem?.type || item?.mediaType),
        mediaType: normalizeChoiceMediaType(vendorMediaItem?.type || item?.mediaType),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : 0,
        filename: vendorMediaItem?.filename || item?.filename || '',
        size: typeof vendorMediaItem?.size === 'number' ? vendorMediaItem.size : (typeof item?.size === 'number' ? item.size : 0),
        caption: vendorMediaItem?.caption || item?.caption || '',
        altText: vendorMediaItem?.altText || item?.altText || '',
        isCover: Boolean(item?.isCover),
        isVisible: item?.isVisible !== false && vendorMediaItem?.isVisible !== false,
      };
    })
    .filter(Boolean);

  const ownedMedia = storedOwnedMedia
    .map((item) => {
      if (!item?.url || !item?.type) {
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
        type: normalizeChoiceMediaType(item.type),
        mediaType: normalizeChoiceMediaType(item.type),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : 0,
        filename: item?.filename || '',
        size: typeof item?.size === 'number' ? item.size : 0,
        caption: item?.caption || '',
        altText: item?.altText || '',
        isCover: Boolean(item?.isCover),
        isVisible: item?.isVisible !== false,
      };
    })
    .filter(Boolean);

  // Re-sort the merged list so admin-owned and vendor-owned media share one cover item.
  return sortChoiceMedia([...vendorMedia, ...ownedMedia]).map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: index === 0,
  }));
}

function buildChoiceProfileUpdateDocument(seedProfile, existingProfile, payload) {
  const existingServices = normalizeChoiceServices(existingProfile?.services);
  const existingBundledServices = normalizeChoiceServices(existingProfile?.bundledServices);
  const existingCoverageAreas = normalizeChoiceCoverageAreas(existingProfile?.coverageAreas);
  const existingSeedOverrides = normalizeChoiceProfileSeedOverrides(existingProfile?.seedOverrides);
  const resolvedSubType = hasOwnPayloadField(payload, 'subType')
    ? normalizeChoiceTextField(payload?.subType)
    : (existingSeedOverrides.subType
      ? normalizeChoiceTextField(existingProfile?.subType)
      : (normalizeChoiceTextField(existingProfile?.subType) || normalizeChoiceTextField(seedProfile?.subType)));
  const resolvedDescription = hasOwnPayloadField(payload, 'description')
    ? normalizeChoiceTextField(payload?.description)
    : (existingSeedOverrides.description
      ? normalizeChoiceTextField(existingProfile?.description)
      : (normalizeChoiceTextField(existingProfile?.description) || normalizeChoiceTextField(seedProfile?.description)));
  const resolvedServices = hasOwnPayloadField(payload, 'services')
    ? normalizeChoiceServices(payload?.services)
    : (existingSeedOverrides.services
      ? existingServices
      : (existingServices.length > 0 ? existingServices : normalizeChoiceServices(seedProfile?.services)));
  const resolvedBundledServices = hasOwnPayloadField(payload, 'bundledServices')
    ? normalizeChoiceServices(payload?.bundledServices)
    : (existingSeedOverrides.bundledServices
      ? existingBundledServices
      : (existingBundledServices.length > 0 ? existingBundledServices : normalizeChoiceServices(seedProfile?.bundledServices)));
  const resolvedCity = hasOwnPayloadField(payload, 'city')
    ? normalizeChoiceTextField(payload?.city)
    : (existingSeedOverrides.city
      ? normalizeChoiceTextField(existingProfile?.city)
      : (normalizeChoiceTextField(existingProfile?.city) || normalizeChoiceTextField(seedProfile?.city)));
  const resolvedCoverageAreas = hasOwnPayloadField(payload, 'coverageAreas')
    ? normalizeChoiceCoverageAreas(payload?.coverageAreas)
    : (existingSeedOverrides.coverageAreas
      ? existingCoverageAreas
      : (existingCoverageAreas.length > 0 ? existingCoverageAreas : normalizeChoiceCoverageAreas(seedProfile?.coverageAreas)));
  const resolvedSeedOverrides = buildChoiceProfileSeedOverrides(seedProfile, {
    subType: resolvedSubType,
    description: resolvedDescription,
    services: resolvedServices,
    bundledServices: resolvedBundledServices,
    city: resolvedCity,
    coverageAreas: resolvedCoverageAreas,
  });

  const resolvedBudgetRangeMode = normalizeChoiceBudgetRangeMode(
    payload?.budgetRangeMode,
    inferChoiceBudgetRangeMode(existingProfile, {
      aggregatedBudgetRange: payload?.aggregatedBudgetRange || null,
      seedProfile,
    })
  );
  const resolvedBudgetRange = resolveChoiceBudgetRangeForMode(
    resolvedBudgetRangeMode,
    payload?.budgetRange !== undefined ? payload.budgetRange : existingProfile?.budgetRange,
    payload?.aggregatedBudgetRange || null
  );

  return {
    type: seedProfile.type,
    businessName: typeof payload?.businessName === 'string' && payload.businessName.trim()
      ? payload.businessName.trim()
      : typeof payload?.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : existingProfile?.businessName || existingProfile?.name || seedProfile.businessName,
    name: typeof payload?.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : typeof payload?.businessName === 'string' && payload.businessName.trim()
        ? payload.businessName.trim()
        : existingProfile?.name || existingProfile?.businessName || seedProfile.name,
    subType: resolvedSubType,
    description: resolvedDescription,
    services: resolvedServices,
    bundledServices: resolvedBundledServices,
    country: typeof payload?.country === 'string' ? payload.country.trim() : (existingProfile?.country || ''),
    state: typeof payload?.state === 'string' ? payload.state.trim() : (existingProfile?.state || ''),
    city: resolvedCity,
    googleMapsLink: typeof payload?.googleMapsLink === 'string' ? payload.googleMapsLink.trim() : (existingProfile?.googleMapsLink || ''),
    coverageAreas: resolvedCoverageAreas,
    budgetRangeMode: resolvedBudgetRangeMode,
    budgetRange: resolvedBudgetRange,
    phone: typeof payload?.phone === 'string' ? payload.phone.trim() : (existingProfile?.phone || ''),
    website: typeof payload?.website === 'string' ? payload.website.trim() : (existingProfile?.website || ''),
    availabilitySettings: payload?.availabilitySettings,
    sourceVendorIds: Array.isArray(payload?.sourceVendorIds) ? payload.sourceVendorIds : (Array.isArray(existingProfile?.sourceVendorIds) ? existingProfile.sourceVendorIds : seedProfile.sourceVendorIds),
    selectedVendorMedia: Array.isArray(payload?.selectedVendorMedia) ? payload.selectedVendorMedia : (Array.isArray(existingProfile?.selectedVendorMedia) ? existingProfile.selectedVendorMedia : seedProfile.selectedVendorMedia),
    media: Array.isArray(payload?.media) ? payload.media : (Array.isArray(existingProfile?.media) ? existingProfile.media : seedProfile.media),
    seedOverrides: resolvedSeedOverrides,
    isApproved: true,
    tier: 'Plus',
    isActive: payload?.isActive !== undefined ? payload.isActive !== false : existingProfile?.isActive !== false,
  };
}

async function bootstrapChoiceProfiles(ChoiceProfile) {
  if (!ChoiceProfile || typeof ChoiceProfile.find !== 'function') {
    return [];
  }

  const query = ChoiceProfile.find({ type: { $in: DEFAULT_VCA_TYPES } });
  if (query && typeof query.select === 'function') {
    return resolveLean(query.select('-__v'));
  }

  return resolveLean(query);
}

function serializeAdminChoiceProfile(choiceProfile, vendorsForType = []) {
  const sourceVendors = resolveChoiceSourceVendors(choiceProfile, vendorsForType);
  const aggregatedBudgetRange = buildAggregatedBudgetRange(sourceVendors);
  const aggregatedServices = buildAggregatedServices(sourceVendors);
  const aggregatedAvailabilitySettings = buildAggregatedAvailabilitySettings(sourceVendors);
  const seedProfile = buildDefaultChoiceProfileSeed(choiceProfile?.type);
  const selectedMedia = resolveAdminChoiceMedia(choiceProfile, vendorsForType);
  const selectedVendorMedia = selectedMedia.filter(item => item.sourceType === 'vendor').map((item) => ({
    vendorId: item.vendorId,
    vendorName: item.vendorName || '',
    sourceMediaId: item.sourceMediaId,
    r2Url: item.r2Url || buildChoiceMediaPreviewUrl(item),
    mediaType: normalizeChoiceMediaType(item.mediaType || item.type),
    sortOrder: item.sortOrder,
    filename: item.filename || '',
    size: typeof item.size === 'number' ? item.size : 0,
    caption: item.caption || '',
    altText: item.altText || '',
    isCover: Boolean(item.isCover),
    isVisible: item.isVisible !== false,
  }));
  const ownedMedia = selectedMedia.filter(item => item.sourceType !== 'vendor').map((item) => ({
    key: item.key || '',
    url: buildChoiceMediaPreviewUrl(item),
    type: normalizeChoiceMediaType(item.type),
    sortOrder: item.sortOrder,
    filename: item.filename || '',
    size: typeof item.size === 'number' ? item.size : 0,
    caption: item.caption || '',
    altText: item.altText || '',
    isCover: Boolean(item.isCover),
    isVisible: item.isVisible !== false,
  }));
  const normalizedServices = normalizeChoiceServices(choiceProfile?.services);
  const normalizedBundledServices = normalizeChoiceServices(choiceProfile?.bundledServices);

  return {
    id: String(choiceProfile?._id || ''),
    businessName: choiceProfile?.businessName || choiceProfile?.name || buildChoiceProfileName(choiceProfile?.type),
    type: choiceProfile?.type || '',
    name: choiceProfile?.name || choiceProfile?.businessName || buildChoiceProfileName(choiceProfile?.type),
    subType: choiceProfile?.subType || '',
    description: choiceProfile?.description || '',
    services: normalizedServices.length > 0 ? normalizedServices : aggregatedServices,
    bundledServices: normalizedBundledServices.length > 0 ? normalizedBundledServices : aggregatedServices,
    country: choiceProfile?.country || '',
    state: choiceProfile?.state || '',
    city: choiceProfile?.city || '',
    googleMapsLink: choiceProfile?.googleMapsLink || '',
    coverageAreas: Array.isArray(choiceProfile?.coverageAreas) ? choiceProfile.coverageAreas : [],
    phone: choiceProfile?.phone || '',
    website: choiceProfile?.website || '',
    budgetRangeMode: inferChoiceBudgetRangeMode(choiceProfile, { aggregatedBudgetRange, seedProfile }),
    budgetRange: normalizeChoiceBudgetRange(choiceProfile?.budgetRange, null),
    aggregatedBudgetRange,
    availabilitySettings: normalizeChoiceAvailabilitySettings(choiceProfile?.availabilitySettings, aggregatedAvailabilitySettings),
    aggregatedAvailabilitySettings,
    aggregatedServices,
    sourceVendorIds: sourceVendors.map(vendor => String(vendor._id || '')),
    sourceVendorCount: sourceVendors.length,
    selectedVendorMedia,
    media: ownedMedia,
    selectedMedia,
    mediaCount: selectedMedia.length,
    isApproved: choiceProfile?.isApproved !== false,
    tier: normalizeVendorTier(choiceProfile?.tier || 'Plus'),
    isActive: choiceProfile?.isActive !== false,
    createdAt: choiceProfile?.createdAt || null,
    updatedAt: choiceProfile?.updatedAt || null,
  };
}

function serializeBillingReceipt(receipt = {}) {
  return {
    id: String(receipt._id || ''),
    receiptNumber: receipt.receiptNumber || '',
    plan: receipt.plan || '',
    billingCycle: receipt.billingCycle || '',
    currency: receipt.currency || 'INR',
    baseAmount: Number(receipt.baseAmount || 0),
    amount: Number(receipt.amount || 0),
    couponCode: receipt.couponCode || '',
    discountPercent: Number(receipt.discountPercent || 0),
    paymentProvider: receipt.paymentProvider || 'internal',
    paymentReference: receipt.paymentReference || '',
    status: receipt.status || 'issued',
    emailDeliveryStatus: receipt.emailDeliveryStatus || 'pending',
    emailDeliveryError: receipt.emailDeliveryError || '',
    issuedAt: receipt.issuedAt || null,
    currentPeriodEnd: receipt.currentPeriodEnd || null,
  };
}

function serializeAdminSubscriber(user = {}, receipt = null) {
  return {
    id: String(user._id || user.googleId || ''),
    googleId: user.googleId || '',
    name: user.name || '',
    email: user.email || '',
    subscriptionTier: user.subscriptionTier || 'starter',
    subscriptionStatus: user.subscriptionStatus || 'active',
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
    subscriptionId: user.subscriptionId || '',
    latestReceipt: receipt ? serializeBillingReceipt(receipt) : null,
  };
}

/******************************************************************************
 * /api/admin/me
 ******************************************************************************/

async function handleAdminMe(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const session = await requireAdminSession(req, 'viewer');
    if (session.error) {
      return res.status(session.status).json({ error: session.error });
    }

    return res.status(200).json({
      user: sanitizeStaffUser(session.user),
      access: session.access,
    });
  } catch (error) {
    console.error('Admin session lookup failed:', error);
    return res.status(500).json({ error: 'Could not load admin access.' });
  }
}

/******************************************************************************
 * /api/admin/vendors
 ******************************************************************************/

async function handleAdminVendors(req, res) {
  setCacheControl(res, 'noStore');

  try {
    if (req.method === 'GET') {
      const session = await requireAdminSession(req, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const Vendor = getVendorModel();
      const vendors = await Vendor.find({})
        .select('-__v')
        .sort({ isApproved: 1, updatedAt: -1, createdAt: -1 })
        .lean();
      const serializedVendors = await Promise.all(vendors.map(async vendor => {
        try {
          return await serializeAdminVendor(vendor);
        } catch (error) {
          console.error('Admin vendor serialization failed:', {
            vendorId: String(vendor?._id || ''),
            vendorGoogleId: vendor?.googleId || '',
            error,
          });
          return buildFallbackAdminVendor(vendor);
        }
      }));

      return res.status(200).json({
        vendors: serializedVendors,
      });
    }

    if (req.method === 'PATCH') {
      const session = await requireAdminSession(req, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const vendorId = String(req.body?.vendorId || '').trim();
      const vendorGoogleId = String(req.body?.vendorGoogleId || '').trim();
      const isApproved = req.body?.isApproved;
      const verificationStatus = typeof req.body?.verificationStatus === 'string' ? req.body.verificationStatus.trim() : '';
      const verificationNotes = typeof req.body?.verificationNotes === 'string' ? req.body.verificationNotes.trim().slice(0, 1000) : null;
      const tier = typeof req.body?.tier === 'string' ? normalizeVendorTier(req.body.tier) : '';

      if (!vendorId && !vendorGoogleId) {
        return res.status(400).json({ error: 'vendorId or vendorGoogleId is required.' });
      }
      if (typeof isApproved !== 'boolean' && !verificationStatus && verificationNotes === null && !tier) {
        return res.status(400).json({ error: 'Provide isApproved, verificationStatus, verificationNotes, or tier.' });
      }
      if (verificationStatus && !['not_submitted', 'submitted', 'approved', 'rejected'].includes(verificationStatus)) {
        return res.status(400).json({ error: 'verificationStatus is invalid.' });
      }

      const updates = {};
      if (typeof isApproved === 'boolean') {
        updates.isApproved = isApproved;
      }
      if (verificationStatus) {
        updates.verificationStatus = verificationStatus;
        updates.verificationReviewedAt = new Date();
        updates.verificationReviewedBy = session.user.email || session.user.googleId || '';
      }
      if (verificationNotes !== null) {
        updates.verificationNotes = verificationNotes;
      }
      if (tier) {
        updates.tier = tier;
      }

      const Vendor = getVendorModel();
      const lookupFilters = [];
      if (vendorId && mongoose.isValidObjectId(vendorId)) {
        lookupFilters.push({ _id: vendorId });
      }
      if (vendorGoogleId || (vendorId && !mongoose.isValidObjectId(vendorId))) {
        lookupFilters.push({ googleId: vendorGoogleId || vendorId });
      }

      let vendor = null;
      for (const filter of lookupFilters) {
        vendor = await resolveLean(Vendor.findOneAndUpdate(
          filter,
          {
            $set: updates,
          },
          { new: true }
        ));

        if (vendor) {
          break;
        }
      }

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found.' });
      }

      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });

      return res.status(200).json({
        vendor: await serializeAdminVendor(vendor),
      });
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Admin vendor management failed:', error);
    return res.status(500).json({ error: 'Could not manage vendors.' });
  }
}

/******************************************************************************
 * /api/admin/choice
 ******************************************************************************/

async function handleAdminChoice(req, res) {
  setCacheControl(res, 'noStore');

  try {
    if (req.method === 'GET') {
      const session = await requireAdminSession(req, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const Vendor = getVendorModel();
      const ChoiceProfile = getChoiceProfileModel();
      const [vendors, choiceProfileDocs] = await Promise.all([
        Vendor.find({ isApproved: true })
          .select('-__v')
          .sort({ type: 1, businessName: 1, updatedAt: -1 })
          .lean(),
        bootstrapChoiceProfiles(ChoiceProfile),
      ]);

      const vendorsByType = vendors.reduce((map, vendor) => {
        const type = String(vendor?.type || '').trim();
        if (!type) {
          return map;
        }
        if (!map.has(type)) {
          map.set(type, []);
        }
        map.get(type).push(vendor);
        return map;
      }, new Map());
      const docsByType = new Map((Array.isArray(choiceProfileDocs) ? choiceProfileDocs : []).map(profile => [String(profile?.type || '').trim(), profile]));
      const profileTypes = DEFAULT_VCA_TYPES;

      return res.status(200).json({
        choiceProfiles: profileTypes.map(type => (
          serializeAdminChoiceProfile(
            docsByType.get(type) || buildDefaultChoiceProfileSeed(type),
            vendorsByType.get(type) || []
          )
        )),
      });
    }

    if (req.method === 'PATCH') {
      if (applyRateLimit(req, res, 'admin:choice:patch', {
        windowMs: 10 * 60 * 1000,
        max: 60,
        message: 'Too many Choice profile updates. Please try again shortly.',
      })) {
        return;
      }

      const session = await requireAdminSession(req, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const type = String(req.body?.type || '').trim();
      const requestedId = String(req.body?.id || req.body?.choiceProfileId || '').trim();
      const choiceProfileId = buildChoiceProfileId(type) || requestedId;

      if (!type || !choiceProfileId) {
        return res.status(400).json({ error: 'type and static VCA id are required.' });
      }

      const Vendor = getVendorModel();
      const ChoiceProfile = getChoiceProfileModel();
      const effectiveType = type;
      const existingProfile = await resolveLean(ChoiceProfile.findOne({
        $or: [
          { _id: choiceProfileId },
          { type: effectiveType },
        ],
      }));
      if (!effectiveType) {
        return res.status(400).json({ error: 'type is required.' });
      }

      const vendorsForType = await Vendor.find({ isApproved: true, type })
        .select('-__v')
        .sort({ businessName: 1, updatedAt: -1 })
        .lean();
      const vendorsById = new Map(vendorsForType.map(vendor => [String(vendor?._id || ''), vendor]));

      const rawSourceVendorIds = Array.isArray(req.body?.sourceVendorIds) ? req.body.sourceVendorIds : [];
      const sourceVendorIds = Array.from(new Set(
        rawSourceVendorIds
          .map(normalizeObjectId)
          .filter(Boolean)
      ));

      if (sourceVendorIds.some(id => !vendorsById.has(id))) {
        return res.status(400).json({ error: 'sourceVendorIds includes an unknown approved vendor.' });
      }

      const sourceVendors = sourceVendorIds.map(id => vendorsById.get(id)).filter(Boolean);
      const selectedVendorMediaInput = Array.isArray(req.body?.selectedVendorMedia)
        ? req.body.selectedVendorMedia
        : Array.isArray(req.body?.selectedMedia)
          ? req.body.selectedMedia.filter(item => item?.sourceType === 'vendor')
          : [];
      const ownedMediaInput = Array.isArray(req.body?.media)
        ? req.body.media
        : Array.isArray(req.body?.selectedMedia)
          ? req.body.selectedMedia.filter(item => item?.sourceType !== 'vendor')
          : [];
      const selectedVendorMedia = selectedVendorMediaInput.map((item, index) => normalizeChoiceSelectedVendorMediaInput(item, index, vendorsById));
      const ownedMedia = ownedMediaInput.map((item, index) => normalizeChoiceOwnedMediaInput(item, index));

      // When admins do not override these fields, we persist the live aggregate from the chosen vendors.
      const aggregatedBudgetRange = buildAggregatedBudgetRange(sourceVendors);
      const aggregatedAvailabilitySettings = buildAggregatedAvailabilitySettings(sourceVendors);
      const seedProfile = buildDefaultChoiceProfileSeed(effectiveType);
      const updatedProfile = await resolveLean(ChoiceProfile.findOneAndUpdate(
        { _id: existingProfile?._id || choiceProfileId },
        {
          $set: {
            ...buildChoiceProfileUpdateDocument(seedProfile, existingProfile, {
              ...req.body,
              businessName: req.body?.businessName || req.body?.name,
              budgetRange: normalizeChoiceBudgetRange(req.body?.budgetRange, aggregatedBudgetRange),
              aggregatedBudgetRange,
              budgetRangeMode: normalizeChoiceBudgetRangeMode(req.body?.budgetRangeMode, 'custom'),
              availabilitySettings: normalizeChoiceAvailabilitySettings(req.body?.availabilitySettings, aggregatedAvailabilitySettings),
              sourceVendorIds,
              selectedVendorMedia,
              media: ownedMedia,
            }),
            sourceVendorIds,
          },
          $setOnInsert: { _id: choiceProfileId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ));

      invalidatePublicCache(VENDOR_DIRECTORY_CACHE_TAG, { scope: 'tag' });

      return res.status(200).json({
        choiceProfile: serializeAdminChoiceProfile(updatedProfile, vendorsForType),
      });
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    if (error?.message && /(selectedMedia|selectedVendorMedia|media includes)/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message || 'Choice profile is invalid.' });
    }
    console.error('Admin choice management failed:', error);
    return res.status(500).json({ error: 'Could not manage Choice profiles.' });
  }
}

async function handleAdminChoiceMediaUpload(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (applyRateLimit(req, res, 'admin:choice:media-upload', {
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: 'Too many Choice media upload requests. Please try again shortly.',
  })) {
    return;
  }

  try {
    const session = await requireAdminSession(req, 'editor');
    if (session.error) {
      return res.status(session.status).json({ error: session.error });
    }

    const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';
    const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType.trim() : '';
    const size = Number(req.body?.size);
    const rawChoiceProfileId = String(req.body?.choiceProfileId || req.body?.id || '').trim();
    const type = String(req.body?.type || '').trim();
    const choiceProfileId = buildChoiceProfileId(type) || rawChoiceProfileId;

    if (!choiceProfileId) {
      return res.status(400).json({ error: 'choiceProfileId is required.' });
    }
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required.' });
    }
    if (!Number.isSafeInteger(size) || size <= 0 || size > (50 * 1024 * 1024)) {
      return res.status(400).json({ error: 'size must be a positive number up to 50 MB.' });
    }
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return res.status(400).json({ error: 'Only image and video files are allowed.' });
    }

    const rawExt = filename.includes('.') ? filename.split('.').pop() : '';
    const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
    const key = `choice-media/${choiceProfileId}/${randomUUID()}${ext ? `.${ext}` : ''}`;
    const uploadUrl = await createPresignedPutUrl(key, contentType, { contentLength: size });
    const publicUrl = createPublicObjectUrl(key);

    return res.status(200).json({
      uploadUrl,
      key,
      publicUrl,
      uploadedBy: session.user?.email || '',
    });
  } catch (error) {
    console.error('Admin choice media upload URL generation failed:', error);
    return res.status(500).json({ error: 'Could not generate VCA upload URL.' });
  }
}

/******************************************************************************
 * /api/admin/staff
 ******************************************************************************/

async function handleAdminStaff(req, res) {
  try {
    if (req.method === 'GET') {
      const session = await requireAdminSession(req, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const users = await session.User.find({ staffRole: { $in: ['owner', 'editor', 'viewer'] } })
        .select('-__v')
        .sort({ staffRole: 1, email: 1 })
        .lean();

      return res.status(200).json({
        staff: users.map(sanitizeStaffUser),
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const session = await requireAdminSession(req, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const email = normalizeEmail(req.body?.email);
      const staffRole = normalizeStaffRole(req.body?.staffRole);

      if (!email) {
        return res.status(400).json({ error: 'email is required.' });
      }
      if (!['editor', 'viewer'].includes(staffRole)) {
        return res.status(400).json({ error: 'staffRole must be viewer or editor.' });
      }
      if (email === normalizeEmail(session.user.email)) {
        return res.status(400).json({ error: 'Use the bootstrap owner account as the permanent owner.' });
      }

      const updated = await session.User.findOneAndUpdate(
        { email },
        {
          $set: {
            email,
            staffRole,
            staffAddedBy: session.user.googleId,
            staffGrantedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'User must sign in once with Google before staff access can be granted.' });
      }

      return res.status(200).json({
        staffUser: sanitizeStaffUser(await resolveLean(updated)),
      });
    }

    if (req.method === 'DELETE') {
      const session = await requireAdminSession(req, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const email = normalizeEmail(req.query?.email || req.body?.email);
      if (!email) {
        return res.status(400).json({ error: 'email is required.' });
      }
      if (email === normalizeEmail(session.user.email)) {
        return res.status(400).json({ error: 'The bootstrap owner cannot be removed.' });
      }

      const updated = await session.User.findOneAndUpdate(
        { email },
        {
          $set: {
            staffRole: 'none',
            staffAddedBy: '',
            staffGrantedAt: null,
          },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Admin staff management failed:', error);
    return res.status(500).json({ error: 'Could not manage staff.' });
  }
}

/******************************************************************************
 * /api/admin/applications
 ******************************************************************************/

async function handleAdminApplications(req, res) {
  try {
    if (req.method === 'GET') {
      const session = await requireAdminSession(req, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const CareerApplication = getCareerApplicationModel();
      const CareerEmailTemplate = getCareerEmailTemplateModel();
      const [applications, rejectionEmailTemplate] = await Promise.all([
        CareerApplication.find({})
          .select('-__v')
          .sort({ createdAt: -1 })
          .lean(),
        resolveCareerRejectionTemplate(CareerEmailTemplate),
      ]);

      return res.status(200).json({
        applications: applications.map(serializeApplication),
        rejectionEmailTemplate,
      });
    }

    if (req.method === 'PATCH') {
      const session = await requireAdminSession(req, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const action = normalizeAction(req.body?.action);
      const CareerEmailTemplate = getCareerEmailTemplateModel();

      if (action === 'save-rejection-template') {
        const rejectionEmailTemplate = await saveCareerRejectionTemplate(CareerEmailTemplate, req.body, session.user.email || session.user.googleId || '');
        return res.status(200).json({ ok: true, rejectionEmailTemplate });
      }

      if (action === 'reject-application') {
        const applicationId = normalizeObjectId(req.body?.applicationId);
        if (!applicationId) {
          return res.status(400).json({ error: 'applicationId is required.' });
        }

        const CareerApplication = getCareerApplicationModel();
        const application = await resolveLean(CareerApplication.findById(applicationId));
        if (!application) {
          return res.status(404).json({ error: 'Application not found.' });
        }
        if (application.status === 'rejected') {
          return res.status(400).json({ error: 'This application has already been rejected.' });
        }

        const rejectionEmailTemplate = await saveCareerRejectionTemplate(
          CareerEmailTemplate,
          req.body,
          session.user.email || session.user.googleId || ''
        );

        const delivery = await sendCareerRejectionEmail({
          toEmail: normalizeEmail(application.email),
          template: rejectionEmailTemplate,
          application,
        });

        const resumeKey = normalizeResumeStorageKey(application.resumeFileId);
        if (resumeKey) {
          // Remove the stored resume once the rejection email has been sent successfully.
          await deleteB2Object(resumeKey);
        }

        const updatedApplication = await resolveLean(CareerApplication.findByIdAndUpdate(
          applicationId,
          {
            $set: {
              status: 'rejected',
              rejectedAt: new Date(),
              rejectedBy: session.user.email || session.user.googleId || '',
              rejectionEmailSubject: delivery.subject,
              rejectionEmailSentAt: delivery.sentAt,
              resumeDeletedAt: resumeKey ? new Date() : application.resumeDeletedAt || null,
              resumeFileId: '',
              resumeFileName: '',
              resumeViewUrl: '',
              resumeDownloadUrl: '',
              resumeOriginalFileName: '',
              resumeMimeType: '',
              resumeSize: 0,
            },
          },
          { new: true }
        ));

        return res.status(200).json({
          ok: true,
          application: serializeApplication(updatedApplication),
          rejectionEmailTemplate,
        });
      }

      return res.status(400).json({ error: 'Unsupported application action.' });
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Admin application management failed:', error);
    const errorMessage = req.method === 'GET'
      ? 'Could not load applications.'
      : 'Could not manage applications.';
    return res.status(500).json({ error: errorMessage });
  }
}

/******************************************************************************
 * /api/admin/subscribers
 ******************************************************************************/

async function handleAdminSubscribers(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const session = await requireAdminSession(req, 'viewer');
    if (session.error) {
      return res.status(session.status).json({ error: session.error });
    }

    const BillingReceipt = getBillingReceiptModel();
    const users = await session.User.find({
      $or: [
        { subscriptionTier: { $in: ['premium', 'studio'] } },
        { subscriptionId: { $exists: true, $ne: '' } },
      ],
    })
      .select('-__v')
      .sort({ subscriptionCurrentPeriodEnd: -1, updatedAt: -1 })
      .lean();

    let receipts = [];
    try {
      receipts = await BillingReceipt.find({})
        .select('-__v')
        .sort({ issuedAt: -1, createdAt: -1 })
        .lean();
    } catch (error) {
      console.error('Admin receipt lookup failed:', error);
      receipts = [];
    }

    const latestReceiptByGoogleId = new Map();
    receipts.forEach(receipt => {
      if (receipt?.googleId && !latestReceiptByGoogleId.has(receipt.googleId)) {
        latestReceiptByGoogleId.set(receipt.googleId, receipt);
      }
    });

    return res.status(200).json({
      subscribers: users.map(user => serializeAdminSubscriber(user, latestReceiptByGoogleId.get(user.googleId) || null)),
    });
  } catch (error) {
    console.error('Admin subscriber management failed:', error);
    return res.status(500).json({ error: 'Could not load subscribers.' });
  }
}

/******************************************************************************
 * /api/admin/resume-download — presigned B2 redirect
 ******************************************************************************/

async function handleAdminResumeDownload(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const session = await requireAdminSession(req, 'viewer');
    if (session.error) {
      return res.status(session.status).json({ error: session.error });
    }

    const key = normalizeResumeStorageKey(req.query?.key);
    if (!key || !isAllowedResumeStorageKey(key)) {
      return res.status(400).json({ error: 'Invalid resume key.' });
    }

    const mode = normalizeResumeAccessMode(req.query?.mode);
    const responseMode = normalizeResumeResponseMode(req.query?.response);
    const fallbackFilename = key.split('/').filter(Boolean).pop() || 'resume.pdf';
    const filename = normalizeResumeFilename(req.query?.filename, fallbackFilename);
    const url = await createB2PresignedGetUrl(key, 300, {
      contentType: 'application/pdf',
      contentDisposition: `${mode === 'preview' ? 'inline' : 'attachment'}; filename="${filename}"`,
    });

    if (responseMode === 'json') {
      return res.status(200).json({
        url,
        mode,
        filename,
      });
    }

    return res.redirect(302, url);
  } catch (error) {
    console.error('Admin resume download failed:', error);
    return res.status(500).json({ error: 'Could not generate download link.' });
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
  setCacheControl(res, 'noStore');

  // This file multiplexes several legacy admin endpoints through one serverless entrypoint.
  const route = resolveAdminRoute(req);

  const shouldProtectAdminMutation = (route === 'vendors' && req.method === 'PATCH')
    || (route === 'choice' && req.method === 'PATCH')
    || (route === 'choice-media-upload' && req.method === 'POST')
    || (route === 'staff' && ['POST', 'PUT', 'DELETE'].includes(req.method))
    || (route === 'applications' && req.method === 'PATCH');

  if (shouldProtectAdminMutation && requireCsrfProtection(req, res)) {
    return;
  }

  if (route === 'me') {
    return handleAdminMe(req, res);
  }

  if (route === 'vendors') {
    return handleAdminVendors(req, res);
  }

  if (route === 'choice') {
    return handleAdminChoice(req, res);
  }

  if (route === 'choice-media-upload') {
    return handleAdminChoiceMediaUpload(req, res);
  }

  if (route === 'staff') {
    return handleAdminStaff(req, res);
  }

  if (route === 'applications') {
    return handleAdminApplications(req, res);
  }

  if (route === 'resume-download') {
    return handleAdminResumeDownload(req, res);
  }

  if (route === 'subscribers') {
    return handleAdminSubscribers(req, res);
  }

  res.setHeader('Allow', 'OPTIONS');
  return res.status(404).json({ error: 'Admin route not found.' });
}

module.exports = handler;
module.exports.handleAdminMe = handleAdminMe;
module.exports.handleAdminStaff = handleAdminStaff;
module.exports.handleAdminVendors = handleAdminVendors;
module.exports.handleAdminChoice = handleAdminChoice;
module.exports.handleAdminChoiceMediaUpload = handleAdminChoiceMediaUpload;
module.exports.handleAdminApplications = handleAdminApplications;
module.exports.handleAdminResumeDownload = handleAdminResumeDownload;
module.exports.handleAdminSubscribers = handleAdminSubscribers;
