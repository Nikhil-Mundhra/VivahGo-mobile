const { connectDb, handlePreflight, setCorsHeaders, verifySession, getUserModel, getVendorModel } = require('../_lib/core');
const { normalizeMediaList } = require('../_lib/r2');

const VENDOR_TYPES = ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bride', 'Groom'];
const BUNDLED_SERVICE_OPTIONS = VENDOR_TYPES.filter(type => type !== 'Honeymoon');
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
  Bride: ['Bridal Jewellery', 'Bridal Makeup Artists', 'Bridal Lehenga', 'Mehndi Artists', 'Makeup Salon', 'Trousseau Packing'],
  Groom: ['Sherwani'],
};
const ALLOWED_UPDATE_FIELDS = ['businessName', 'type', 'subType', 'description', 'country', 'state', 'city', 'phone', 'website'];
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 5000000;

function normalizeVendorSubtype(type, subType) {
  const allowedSubtypes = VENDOR_SUBTYPE_OPTIONS[type] || [];
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

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) { return; }
  setCorsHeaders(req, res);

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
        vendor: {
          ...vendor,
          media: normalizeMediaList(vendor.media),
        },
      });
    }

    if (req.method === 'POST') {
      const { businessName, type, subType, description, country, state, city, phone, website, coverageAreas, bundledServices, budgetRange } = req.body || {};

      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        return res.status(400).json({ error: 'businessName is required.' });
      }
      if (!VENDOR_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      let normalizedSubType = '';
      try {
        normalizedSubType = normalizeVendorSubtype(type, subType);
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
        type,
        subType: normalizedSubType,
        bundledServices: normalizeBundledServices(type, bundledServices),
        country: (country || '').trim(),
        state: (state || '').trim(),
        description: (description || '').trim(),
        city: (city || '').trim(),
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
        vendor: {
          ...vendor.toObject(),
          media: normalizeMediaList(vendor.media),
        },
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

      if (Array.isArray(body.coverageAreas)) {
        updates.coverageAreas = normalizeCoverageAreas(body.coverageAreas);
      }

      if (Array.isArray(body.bundledServices)) {
        updates.bundledServices = normalizeBundledServices(updates.type || existingVendor.type, body.bundledServices);
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
        const resolvedType = updates.type || existingVendor.type;
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
        vendor: {
          ...vendor.toObject(),
          media: normalizeMediaList(vendor.media),
        },
      });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Vendor profile error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
