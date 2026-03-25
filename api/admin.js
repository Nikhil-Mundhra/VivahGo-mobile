const { getVendorModel, handlePreflight, normalizeEmail, normalizeStaffRole, setCorsHeaders } = require('./_lib/core');
const { requireAdminSession, sanitizeStaffUser } = require('./_lib/admin');
const { normalizeMediaList } = require('./_lib/r2');

/******************************************************************************
 * Shared Helpers
 ******************************************************************************/

function resolveAdminRoute(req) {
  return String(req.query?.route || '').trim().toLowerCase();
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

function serializeAdminVendor(vendor = {}) {
  const media = normalizeMediaList(vendor.media)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));

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
    mediaCount: media.length,
    media,
    createdAt: vendor.createdAt || null,
    updatedAt: vendor.updatedAt || null,
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
        vendors: vendors.map(serializeAdminVendor),
      });
    }

    if (req.method === 'PATCH') {
      const session = await requireAdminSession(req, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const vendorId = String(req.body?.vendorId || '').trim();
      const isApproved = req.body?.isApproved;

      if (!vendorId) {
        return res.status(400).json({ error: 'vendorId is required.' });
      }
      if (typeof isApproved !== 'boolean') {
        return res.status(400).json({ error: 'isApproved must be true or false.' });
      }

      const Vendor = getVendorModel();
      const vendor = await Vendor.findByIdAndUpdate(
        vendorId,
        {
          $set: {
            isApproved,
          },
        },
        { new: true }
      );

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found.' });
      }

      return res.status(200).json({
        vendor: serializeAdminVendor(vendor.toObject()),
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
 * Main Entrypoint
 ******************************************************************************/

async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }
  setCorsHeaders(req, res);

  const route = resolveAdminRoute(req);

  if (route === 'me') {
    return handleAdminMe(req, res);
  }

  if (route === 'vendors') {
    return handleAdminVendors(req, res);
  }

  if (route === 'staff') {
    return handleAdminStaff(req, res);
  }

  res.setHeader('Allow', 'OPTIONS');
  return res.status(404).json({ error: 'Admin route not found.' });
}

module.exports = handler;
module.exports.handleAdminMe = handleAdminMe;
module.exports.handleAdminStaff = handleAdminStaff;
module.exports.handleAdminVendors = handleAdminVendors;
