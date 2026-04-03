const { getBillingReceiptModel, getCareerApplicationModel, getCareerEmailTemplateModel, getChoiceProfileModel, getVendorModel, handlePreflight, normalizeEmail, normalizeStaffRole, requireCsrfProtection, setCorsHeaders } = require('./_lib/core');
const { requireAdminSession, sanitizeStaffUser } = require('./_lib/admin');
const { createPresignedGetUrl, normalizeMediaList, objectKeyMatchesScope } = require('./_lib/r2');
const { createB2PresignedGetUrl, deleteB2Object } = require('./_lib/b2');
const { getDefaultCareerRejectionTemplate, sanitizeCareerRejectionTemplate, sendCareerRejectionEmail } = require('./_lib/careers-admin');
const { serializeApplication } = require('./careers');
const { buildAggregatedBudgetRange, buildAggregatedServices, buildChoiceProfileName, normalizeVendorTier, sortChoiceMedia } = require('./_lib/vendor-choice');

const CAREER_REJECTION_TEMPLATE_KEY = 'career-application-rejection';

/******************************************************************************
 * Shared Helpers
 ******************************************************************************/

function resolveAdminRoute(req) {
  return String(req.query?.route || '').trim().toLowerCase();
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
        accessUrl = await createPresignedGetUrl(key);
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
    .filter(item => item.country && item.state && item.city);
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

function collectChoiceableVendorMedia(vendor, { includeHidden = true } = {}) {
  return normalizeMediaList(vendor?.media)
    .filter(item => includeHidden || item?.isVisible !== false)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
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

function buildDefaultChoiceMedia(sourceVendors) {
  return sourceVendors.flatMap(vendor => collectChoiceableVendorMedia(vendor, { includeHidden: false }).map((item, index) => ({
    sourceType: 'vendor',
    vendorId: String(vendor._id || ''),
    vendorName: vendor.businessName || '',
    sourceMediaId: String(item?._id || ''),
    key: item?.key || '',
    url: item?.url || '',
    type: item?.type || 'IMAGE',
    sortOrder: index,
    filename: item?.filename || '',
    size: typeof item?.size === 'number' ? item.size : 0,
    caption: item?.caption || '',
    altText: item?.altText || '',
    isCover: Boolean(item?.isCover),
    isVisible: item?.isVisible !== false,
  })));
}

function resolveAdminChoiceMedia(choiceProfile, vendorsForType) {
  const sourceVendorMap = new Map((Array.isArray(vendorsForType) ? vendorsForType : []).map(vendor => [String(vendor?._id || ''), vendor]));
  const savedMedia = Array.isArray(choiceProfile?.selectedMedia) ? sortChoiceMedia(choiceProfile.selectedMedia) : [];

  if (savedMedia.length === 0) {
    return buildDefaultChoiceMedia(resolveChoiceSourceVendors(choiceProfile, vendorsForType))
      .map((item, index) => ({ ...item, sortOrder: index, isCover: index === 0 }));
  }

  const resolvedMedia = savedMedia
    .map((item, index) => {
      if (item?.sourceType === 'vendor') {
        const vendor = sourceVendorMap.get(String(item?.vendorId || ''));
        const vendorMedia = collectChoiceableVendorMedia(vendor).find(mediaItem => String(mediaItem?._id || '') === String(item?.sourceMediaId || ''));
        if (!vendor || !vendorMedia) {
          return null;
        }

        return {
          sourceType: 'vendor',
          vendorId: String(vendor._id || ''),
          vendorName: vendor.businessName || '',
          sourceMediaId: String(vendorMedia?._id || ''),
          key: vendorMedia?.key || '',
          url: vendorMedia?.url || '',
          type: vendorMedia?.type || 'IMAGE',
          sortOrder: index,
          filename: vendorMedia?.filename || '',
          size: typeof vendorMedia?.size === 'number' ? vendorMedia.size : 0,
          caption: vendorMedia?.caption || '',
          altText: vendorMedia?.altText || '',
          isCover: Boolean(item?.isCover),
          isVisible: item?.isVisible !== false,
        };
      }

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
        type: item.type,
        sortOrder: index,
        filename: item?.filename || '',
        size: typeof item?.size === 'number' ? item.size : 0,
        caption: item?.caption || '',
        altText: item?.altText || '',
        isCover: Boolean(item?.isCover),
        isVisible: item?.isVisible !== false,
      };
    })
    .filter(Boolean);

  return resolvedMedia.map((item, index) => ({
    ...item,
    sortOrder: index,
    isCover: index === 0,
  }));
}

function serializeAdminChoiceProfile(choiceProfile, vendorsForType = []) {
  const sourceVendors = resolveChoiceSourceVendors(choiceProfile, vendorsForType);
  const aggregatedBudgetRange = buildAggregatedBudgetRange(sourceVendors);
  const aggregatedServices = buildAggregatedServices(sourceVendors);
  const selectedMedia = resolveAdminChoiceMedia(choiceProfile, vendorsForType);
  const normalizedServices = normalizeChoiceServices(choiceProfile?.services);
  const normalizedBundledServices = normalizeChoiceServices(choiceProfile?.bundledServices);

  return {
    id: String(choiceProfile?._id || ''),
    type: choiceProfile?.type || '',
    name: choiceProfile?.name || buildChoiceProfileName(choiceProfile?.type),
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
    budgetRange: normalizeChoiceBudgetRange(choiceProfile?.budgetRange, aggregatedBudgetRange),
    aggregatedBudgetRange,
    aggregatedServices,
    sourceVendorIds: sourceVendors.map(vendor => String(vendor._id || '')),
    sourceVendorCount: sourceVendors.length,
    selectedMedia,
    mediaCount: selectedMedia.length,
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

      return res.status(200).json({
        vendors: await Promise.all(vendors.map(serializeAdminVendor)),
      });
    }

    if (req.method === 'PATCH') {
      const session = await requireAdminSession(req, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const vendorId = String(req.body?.vendorId || '').trim();
      const isApproved = req.body?.isApproved;
      const verificationStatus = typeof req.body?.verificationStatus === 'string' ? req.body.verificationStatus.trim() : '';
      const verificationNotes = typeof req.body?.verificationNotes === 'string' ? req.body.verificationNotes.trim().slice(0, 1000) : null;
      const tier = typeof req.body?.tier === 'string' ? normalizeVendorTier(req.body.tier) : '';

      if (!vendorId) {
        return res.status(400).json({ error: 'vendorId is required.' });
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
      const vendor = await Vendor.findByIdAndUpdate(
        vendorId,
        {
          $set: updates,
        },
        { new: true }
      );

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found.' });
      }

      return res.status(200).json({
        vendor: await serializeAdminVendor(vendor.toObject()),
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
        ChoiceProfile.find({})
          .select('-__v')
          .sort({ name: 1, type: 1 })
          .lean(),
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
      const docsByType = new Map(choiceProfileDocs.map(profile => [String(profile?.type || '').trim(), profile]));
      const profileTypes = Array.from(new Set([
        ...Array.from(docsByType.keys()),
        ...Array.from(vendorsByType.keys()),
      ])).filter(Boolean).sort((a, b) => a.localeCompare(b));

      return res.status(200).json({
        choiceProfiles: profileTypes.map(type => (
          serializeAdminChoiceProfile(
            docsByType.get(type) || { type, name: buildChoiceProfileName(type), isActive: true },
            vendorsByType.get(type) || []
          )
        )),
      });
    }

    if (req.method === 'PATCH') {
      const session = await requireAdminSession(req, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const type = String(req.body?.type || '').trim();
      if (!type) {
        return res.status(400).json({ error: 'type is required.' });
      }

      const Vendor = getVendorModel();
      const ChoiceProfile = getChoiceProfileModel();
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
      const selectedMediaInput = Array.isArray(req.body?.selectedMedia) ? req.body.selectedMedia : [];
      const selectedMedia = selectedMediaInput.map((item, index) => {
        if (item?.sourceType === 'vendor') {
          const vendorId = normalizeObjectId(item.vendorId);
          const sourceMediaId = normalizeObjectId(item.sourceMediaId);
          const vendor = vendorsById.get(vendorId);
          const vendorMedia = collectChoiceableVendorMedia(vendor).find(mediaItem => String(mediaItem?._id || '') === sourceMediaId);

          if (!vendor || !vendorMedia) {
            throw new Error('selectedMedia includes vendor media that is not available.');
          }

          return {
            sourceType: 'vendor',
            vendorId,
            vendorName: vendor.businessName || '',
            sourceMediaId,
            key: vendorMedia?.key || '',
            url: vendorMedia?.url || '',
            type: vendorMedia?.type || 'IMAGE',
            sortOrder: index,
            filename: vendorMedia?.filename || '',
            size: typeof vendorMedia?.size === 'number' ? vendorMedia.size : 0,
            caption: vendorMedia?.caption || '',
            altText: vendorMedia?.altText || '',
            isCover: index === 0,
            isVisible: item?.isVisible !== false,
          };
        }

        if (!item?.url || !['IMAGE', 'VIDEO'].includes(String(item?.type || '').trim())) {
          throw new Error('selectedMedia includes an invalid admin media item.');
        }

        return {
          sourceType: 'admin',
          vendorId: '',
          vendorName: '',
          sourceMediaId: '',
          key: typeof item.key === 'string' ? item.key.trim() : '',
          url: String(item.url).trim(),
          type: String(item.type).trim(),
          sortOrder: index,
          filename: typeof item.filename === 'string' ? item.filename.trim().slice(0, 255) : '',
          size: typeof item.size === 'number' && item.size >= 0 ? item.size : 0,
          caption: typeof item.caption === 'string' ? item.caption.trim().slice(0, 280) : '',
          altText: typeof item.altText === 'string' ? item.altText.trim().slice(0, 180) : '',
          isCover: index === 0,
          isVisible: item?.isVisible !== false,
        };
      });

      const aggregatedBudgetRange = buildAggregatedBudgetRange(sourceVendors);
      const updatedProfile = await resolveLean(ChoiceProfile.findOneAndUpdate(
        { type },
        {
          $set: {
            type,
            name: typeof req.body?.name === 'string' && req.body.name.trim()
              ? req.body.name.trim()
              : buildChoiceProfileName(type),
            subType: typeof req.body?.subType === 'string' ? req.body.subType.trim() : '',
            description: typeof req.body?.description === 'string' ? req.body.description.trim() : '',
            services: normalizeChoiceServices(req.body?.services),
            bundledServices: normalizeChoiceServices(req.body?.bundledServices),
            country: typeof req.body?.country === 'string' ? req.body.country.trim() : '',
            state: typeof req.body?.state === 'string' ? req.body.state.trim() : '',
            city: typeof req.body?.city === 'string' ? req.body.city.trim() : '',
            googleMapsLink: typeof req.body?.googleMapsLink === 'string' ? req.body.googleMapsLink.trim() : '',
            coverageAreas: normalizeChoiceCoverageAreas(req.body?.coverageAreas),
            budgetRange: normalizeChoiceBudgetRange(req.body?.budgetRange, aggregatedBudgetRange),
            phone: typeof req.body?.phone === 'string' ? req.body.phone.trim() : '',
            website: typeof req.body?.website === 'string' ? req.body.website.trim() : '',
            sourceVendorIds,
            selectedMedia,
            isActive: req.body?.isActive !== false,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ));

      return res.status(200).json({
        choiceProfile: serializeAdminChoiceProfile(updatedProfile, vendorsForType),
      });
    }

    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    if (error?.message && /selectedMedia includes/i.test(error.message)) {
      return res.status(400).json({ error: error.message });
    }
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ error: error.message || 'Choice profile is invalid.' });
    }
    console.error('Admin choice management failed:', error);
    return res.status(500).json({ error: 'Could not manage Choice profiles.' });
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

  const route = resolveAdminRoute(req);

  const shouldProtectAdminMutation = (route === 'vendors' && req.method === 'PATCH')
    || (route === 'choice' && req.method === 'PATCH')
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
module.exports.handleAdminApplications = handleAdminApplications;
module.exports.handleAdminResumeDownload = handleAdminResumeDownload;
module.exports.handleAdminSubscribers = handleAdminSubscribers;
