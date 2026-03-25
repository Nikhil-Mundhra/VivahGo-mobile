const { connectDb, handlePreflight, setCorsHeaders, verifySession, getVendorModel } = require('../_lib/core');
const { extractObjectKeyFromUrl, normalizeMediaList } = require('../_lib/r2');

const ALLOWED_MEDIA_TYPES = ['IMAGE', 'VIDEO'];

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

    if (req.method === 'POST') {
      const { key, url, type, sortOrder, filename, size } = req.body || {};
      const normalizedKey = typeof key === 'string' && key ? key.replace(/^\/+/, '') : extractObjectKeyFromUrl(url);

      if (!normalizedKey) {
        return res.status(400).json({ error: 'A valid media key is required.' });
      }
      if (!ALLOWED_MEDIA_TYPES.includes(type)) {
        return res.status(400).json({ error: 'type must be IMAGE or VIDEO.' });
      }

      const vendor = await Vendor.findOneAndUpdate(
        { googleId: auth.sub },
        {
          $push: {
            media: {
              key: normalizedKey,
              url,
              type,
              sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
              filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
              size: typeof size === 'number' && size >= 0 ? size : 0,
            },
          },
        },
        { new: true }
      );

      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
      const vendorObject = typeof vendor.toObject === 'function' ? vendor.toObject() : vendor;
      return res.status(201).json({
        vendor: {
          ...vendorObject,
          media: normalizeMediaList(vendorObject.media),
        },
      });
    }

    if (req.method === 'DELETE') {
      const { mediaId } = req.body || {};

      if (!mediaId || typeof mediaId !== 'string') {
        return res.status(400).json({ error: 'mediaId is required.' });
      }

      const vendor = await Vendor.findOneAndUpdate(
        { googleId: auth.sub },
        // Mongoose uses the _id field name from the embedded document
        { $pull: { media: { _id: mediaId } } },
        { new: true }
      );

      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
      const vendorObject = typeof vendor.toObject === 'function' ? vendor.toObject() : vendor;
      return res.status(200).json({
        vendor: {
          ...vendorObject,
          media: normalizeMediaList(vendorObject.media),
        },
      });
    }

    res.setHeader('Allow', 'POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Vendor media error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
