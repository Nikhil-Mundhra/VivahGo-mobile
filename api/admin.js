const { getBillingReceiptModel, getVendorModel, handlePreflight, normalizeEmail, normalizeStaffRole, requireCsrfProtection, setCorsHeaders } = require('./_lib/core');
const { requireAdminSession, sanitizeStaffUser } = require('./_lib/admin');
const { createPresignedGetUrl, normalizeMediaList, objectKeyMatchesScope } = require('./_lib/r2');
const { createB2PresignedGetUrl } = require('./_lib/b2');
const { serializeApplication } = require('./careers');

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

      if (!vendorId) {
        return res.status(400).json({ error: 'vendorId is required.' });
      }
      if (typeof isApproved !== 'boolean' && !verificationStatus && verificationNotes === null) {
        return res.status(400).json({ error: 'Provide isApproved, verificationStatus, or verificationNotes.' });
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
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const session = await requireAdminSession(req, 'viewer');
    if (session.error) {
      return res.status(session.status).json({ error: session.error });
    }

    const { getCareerApplicationModel } = require('./_lib/core');
    const CareerApplication = getCareerApplicationModel();
    const applications = await CareerApplication.find({})
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      applications: applications.map(serializeApplication),
    });
  } catch (error) {
    console.error('Admin application management failed:', error);
    return res.status(500).json({ error: 'Could not load applications.' });
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

    const receipts = await BillingReceipt.find({})
      .select('-__v')
      .sort({ issuedAt: -1, createdAt: -1 })
      .lean();

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

    const url = await createB2PresignedGetUrl(key, 300);
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
    || (route === 'staff' && ['POST', 'PUT', 'DELETE'].includes(req.method));

  if (shouldProtectAdminMutation && requireCsrfProtection(req, res)) {
    return;
  }

  if (route === 'me') {
    return handleAdminMe(req, res);
  }

  if (route === 'vendors') {
    return handleAdminVendors(req, res);
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
module.exports.handleAdminApplications = handleAdminApplications;
module.exports.handleAdminResumeDownload = handleAdminResumeDownload;
module.exports.handleAdminSubscribers = handleAdminSubscribers;
