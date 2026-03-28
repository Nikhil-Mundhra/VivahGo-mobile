const { connectDb, getUserModel, getVendorModel, handlePreflight, setCorsHeaders, verifySession } = require('./_lib/core');
const { createPresignedGetUrl, extractObjectKeyFromUrl, normalizeMediaList } = require('./_lib/r2');

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

/******************************************************************************
 * Shared Helpers
 ******************************************************************************/

function resolveVendorRoute(req) {
  return String(req.query?.route || '').trim().toLowerCase();
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

function normalizeVerificationStatus(value, { hasDocuments = false } = {}) {
  if (value === 'approved' || value === 'rejected' || value === 'submitted') {
    return value;
  }
  return hasDocuments ? 'submitted' : 'not_submitted';
}

function normalizeMediaForResponse(vendor) {
  if (!vendor || !Array.isArray(vendor.media)) {
    return vendor;
  }

  return {
    ...vendor,
    media: normalizeMediaList([...vendor.media].sort((a, b) => {
      const orderA = typeof a?.sortOrder === 'number' ? a.sortOrder : 0;
      const orderB = typeof b?.sortOrder === 'number' ? b.sortOrder : 0;
      return orderA - orderB;
    })),
  };
}

async function serializeVerificationDocuments(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  return Promise.all(documents.map(async document => {
    const key = typeof document?.key === 'string' ? document.key.replace(/^\/+/, '') : '';
    let accessUrl = '';

    if (key) {
      try {
        accessUrl = await createPresignedGetUrl(key);
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

  return {
    ...normalizedVendor,
    type: normalizeVendorType(normalizedVendor?.type),
    bundledServices: Array.isArray(normalizedVendor?.bundledServices) ? normalizedVendor.bundledServices.map(normalizeVendorType) : [],
    verificationStatus: normalizeVerificationStatus(normalizedVendor?.verificationStatus, {
      hasDocuments: Array.isArray(normalizedVendor?.verificationDocuments) && normalizedVendor.verificationDocuments.length > 0,
    }),
    verificationNotes: sanitizeVerificationNotes(normalizedVendor?.verificationNotes),
    verificationReviewedAt: normalizedVendor?.verificationReviewedAt || null,
    verificationReviewedBy: normalizedVendor?.verificationReviewedBy || '',
    verificationDocuments: await serializeVerificationDocuments(normalizedVendor?.verificationDocuments),
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

  try {
    await connectDb();
    const Vendor = getVendorModel();

    const raw = await Vendor.find({ isApproved: true })
      .select('-__v')
      .lean();

    const vendors = raw.map(v => {
      const media = normalizeMediaList(v.media)
        .filter(item => item?.isVisible !== false)
        .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
      const coverMedia = media.find(item => item?.isCover) || media[0] || null;

      return {
        id: `db_${v._id}`,
        name: v.businessName,
        type: normalizeVendorType(v.type),
        subType: v.subType || '',
        bundledServices: Array.isArray(v.bundledServices) ? v.bundledServices.map(normalizeVendorType) : [],
        description: v.description || '',
        country: v.country || '',
        state: v.state || '',
        city: v.city || '',
        googleMapsLink: v.googleMapsLink || '',
        phone: v.phone || '',
        website: v.website || '',
        emoji: '🏷️',
        rating: 0,
        priceLevel: null,
        booked: false,
        locations: [
          [v.city, v.state, v.country].filter(Boolean).join(', '),
          ...(Array.isArray(v.coverageAreas)
            ? v.coverageAreas.map(item => [item.city, item.state, item.country].filter(Boolean).join(', '))
            : []),
        ].filter(Boolean),
        media,
        coverImageUrl: coverMedia?.type === 'IMAGE' ? coverMedia.url : '',
      };
    });

    return res.status(200).json({ vendors });
  } catch (error) {
    console.error('Approved vendors fetch failed:', error);
    return res.status(500).json({ error: 'Could not fetch vendors.' });
  }
}

/******************************************************************************
 * /api/vendor/me
 ******************************************************************************/

async function handleVendorMe(req, res) {
  const { auth, error: authError } = verifySession(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  try {
    await connectDb();
    const Vendor = getVendorModel();
    const User = getUserModel();

    if (req.method === 'GET') {
      const vendor = await Vendor.findOne({ googleId: auth.sub }).lean();
      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
      return res.status(200).json({
        vendor: await serializeVendor(vendor),
      });
    }

    if (req.method === 'POST') {
      const { businessName, type, subType, description, country, state, city, googleMapsLink, phone, website, coverageAreas, bundledServices, budgetRange } = req.body || {};

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

      const existing = await Vendor.findOne({ googleId: auth.sub }).lean();
      if (existing) {
        return res.status(409).json({ error: 'Vendor profile already exists. Use PATCH to update.' });
      }

      let normalizedBudgetRange;
      try {
        normalizedBudgetRange = normalizeBudgetRange(budgetRange || {});
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
      });

      await User.findOneAndUpdate(
        { googleId: auth.sub },
        { $set: { isVendor: true, vendorId: vendor._id } }
      );

      return res.status(201).json({
        vendor: await serializeVendor(vendor),
      });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const updates = {};
      const existingVendor = await Vendor.findOne({ googleId: auth.sub }).lean();

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
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

      if (updates.type && !VENDOR_TYPES.includes(updates.type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
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
        { googleId: auth.sub },
        { $set: updates },
        { new: true }
      );
      return res.status(200).json({
        vendor: await serializeVendor(vendor),
      });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
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
  const { auth, error: authError } = verifySession(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  try {
    await connectDb();
    const Vendor = getVendorModel();

    if (req.method === 'POST') {
      const { key, url, type, sortOrder, filename, size, caption, altText, isVisible } = req.body || {};
      const normalizedKey = typeof key === 'string' && key ? key.replace(/^\/+/, '') : extractObjectKeyFromUrl(url);

      if (!normalizedKey) {
        return res.status(400).json({ error: 'A valid media key is required.' });
      }
      if (!ALLOWED_MEDIA_TYPES.includes(type)) {
        return res.status(400).json({ error: 'type must be IMAGE or VIDEO.' });
      }

      const vendor = await Vendor.findOne({ googleId: auth.sub });

      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const nextSortOrder = Array.isArray(vendor.media)
        ? vendor.media.reduce((highest, item, index) => {
          const current = typeof item?.sortOrder === 'number' ? item.sortOrder : index;
          return Math.max(highest, current);
        }, -1) + 1
        : 0;

      vendor.media.push({
        key: normalizedKey,
        url: typeof url === 'string' ? url : '',
        type,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : nextSortOrder,
        filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
        size: typeof size === 'number' && size >= 0 ? size : 0,
        caption: sanitizeText(caption, MAX_CAPTION_LENGTH),
        altText: sanitizeText(altText, MAX_ALT_TEXT_LENGTH),
        isVisible: typeof isVisible === 'boolean' ? isVisible : true,
        isCover: !vendor.media.some(item => item?.isCover),
      });

      await vendor.save();
      return res.status(201).json({ vendor: await serializeVendor(vendor) });
    }

    if (req.method === 'PUT') {
      const { mediaId, caption, altText, isVisible, makeCover, mediaIds } = req.body || {};
      const vendor = await Vendor.findOne({ googleId: auth.sub });

      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      if (Array.isArray(mediaIds)) {
        const normalizedIds = mediaIds.filter(id => typeof id === 'string' && id);
        if (normalizedIds.length !== vendor.media.length) {
          return res.status(400).json({ error: 'mediaIds must include every portfolio item exactly once.' });
        }

        const seen = new Set();
        for (const id of normalizedIds) {
          if (seen.has(id)) {
            return res.status(400).json({ error: 'mediaIds must not contain duplicates.' });
          }
          seen.add(id);
        }

        const itemsById = new Map(vendor.media.map(item => [String(item._id), item]));
        if (normalizedIds.some(id => !itemsById.has(id))) {
          return res.status(400).json({ error: 'mediaIds includes an unknown portfolio item.' });
        }

        normalizedIds.forEach((id, index) => {
          itemsById.get(id).sortOrder = index;
        });

        await vendor.save();
        return res.status(200).json({ vendor: await serializeVendor(vendor) });
      }

      if (!mediaId || typeof mediaId !== 'string') {
        return res.status(400).json({ error: 'mediaId is required.' });
      }

      const target = vendor.media.id(mediaId);
      if (!target) {
        return res.status(404).json({ error: 'Media item not found.' });
      }

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
        vendor.media.forEach(item => {
          item.isCover = String(item._id) === mediaId;
        });
      }

      await vendor.save();
      return res.status(200).json({ vendor: await serializeVendor(vendor) });
    }

    if (req.method === 'DELETE') {
      const { mediaId } = req.body || {};

      if (!mediaId || typeof mediaId !== 'string') {
        return res.status(400).json({ error: 'mediaId is required.' });
      }

      const vendor = await Vendor.findOne({ googleId: auth.sub });

      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const target = vendor.media.id(mediaId);
      if (!target) {
        return res.status(404).json({ error: 'Media item not found.' });
      }

      const wasCover = Boolean(target.isCover);
      target.deleteOne();

      const sortedMedia = [...vendor.media].sort((a, b) => {
        const orderA = typeof a?.sortOrder === 'number' ? a.sortOrder : 0;
        const orderB = typeof b?.sortOrder === 'number' ? b.sortOrder : 0;
        return orderA - orderB;
      });

      if (wasCover && sortedMedia.length > 0) {
        vendor.media.forEach(item => {
          item.isCover = false;
        });
        sortedMedia[0].isCover = true;
      }

      sortedMedia.forEach((item, index) => {
        item.sortOrder = index;
      });

      await vendor.save();
      return res.status(200).json({ vendor: await serializeVendor(vendor) });
    }

    res.setHeader('Allow', 'POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Vendor media error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}

/******************************************************************************
 * /api/vendor/verification
 ******************************************************************************/

async function handleVendorVerification(req, res) {
  const { auth, error: authError } = verifySession(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  try {
    await connectDb();
    const Vendor = getVendorModel();
    const vendor = await Vendor.findOne({ googleId: auth.sub });

    if (!vendor) {
      return res.status(404).json({ error: 'No vendor profile found.' });
    }

    if (req.method === 'POST') {
      const { key, filename, size, contentType, documentType } = req.body || {};
      const normalizedKey = typeof key === 'string' ? key.replace(/^\/+/, '') : '';

      if (!normalizedKey) {
        return res.status(400).json({ error: 'A valid verification document key is required.' });
      }
      if (!ALLOWED_VERIFICATION_DOCUMENT_TYPES.includes(documentType)) {
        return res.status(400).json({ error: `documentType must be one of: ${ALLOWED_VERIFICATION_DOCUMENT_TYPES.join(', ')}.` });
      }

      vendor.verificationDocuments.push({
        key: normalizedKey,
        filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
        size: typeof size === 'number' && size >= 0 ? size : 0,
        contentType: typeof contentType === 'string' ? contentType.slice(0, 120) : '',
        documentType,
        uploadedAt: new Date(),
      });
      vendor.verificationStatus = 'submitted';
      vendor.verificationReviewedAt = null;
      vendor.verificationReviewedBy = '';

      await vendor.save();
      return res.status(201).json({ vendor: await serializeVendor(vendor) });
    }

    if (req.method === 'DELETE') {
      const { documentId } = req.body || {};
      if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ error: 'documentId is required.' });
      }

      const target = vendor.verificationDocuments.id(documentId);
      if (!target) {
        return res.status(404).json({ error: 'Verification document not found.' });
      }

      target.deleteOne();
      if (vendor.verificationDocuments.length === 0) {
        vendor.verificationStatus = 'not_submitted';
        vendor.verificationNotes = '';
        vendor.verificationReviewedAt = null;
        vendor.verificationReviewedBy = '';
      } else if (vendor.verificationStatus === 'approved') {
        vendor.verificationStatus = 'submitted';
      }

      await vendor.save();
      return res.status(200).json({ vendor: await serializeVendor(vendor) });
    }

    res.setHeader('Allow', 'POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
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
