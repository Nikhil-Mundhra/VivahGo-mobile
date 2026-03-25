const { connectDb, handlePreflight, setCorsHeaders, verifySession, getUserModel, getVendorModel } = require('../_lib/core');
const { normalizeMediaList } = require('../_lib/r2');

const VENDOR_TYPES = ['Venue', 'Photography', 'Catering', 'Decoration', 'Music', 'Pandit'];
const ALLOWED_UPDATE_FIELDS = ['businessName', 'type', 'description', 'city', 'phone', 'website'];

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
      const { businessName, type, description, city, phone, website } = req.body || {};

      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        return res.status(400).json({ error: 'businessName is required.' });
      }
      if (!VENDOR_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      const existing = await Vendor.findOne({ googleId: auth.sub }).lean();
      if (existing) {
        return res.status(409).json({ error: 'Vendor profile already exists. Use PATCH to update.' });
      }

      const vendor = await Vendor.create({
        googleId: auth.sub,
        businessName: businessName.trim(),
        type,
        description: (description || '').trim(),
        city: (city || '').trim(),
        phone: (phone || '').trim(),
        website: (website || '').trim(),
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

      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (typeof body[field] === 'string') {
          updates[field] = body[field].trim();
        }
      }

      if (updates.type && !VENDOR_TYPES.includes(updates.type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      const vendor = await Vendor.findOneAndUpdate(
        { googleId: auth.sub },
        { $set: updates },
        { new: true }
      );

      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
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
