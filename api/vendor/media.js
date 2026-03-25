const { connectDb, handlePreflight, setCorsHeaders, verifySession, getVendorModel } = require('../_lib/core');

const ALLOWED_MEDIA_TYPES = ['IMAGE', 'VIDEO'];
const MAX_CAPTION_LENGTH = 280;
const MAX_ALT_TEXT_LENGTH = 180;

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function normalizeMediaForResponse(vendor) {
  if (!vendor || !Array.isArray(vendor.media)) {
    return vendor;
  }

  vendor.media = [...vendor.media].sort((a, b) => {
    const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
    const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
    return orderA - orderB;
  });

  return vendor;
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

    if (req.method === 'POST') {
      const { url, type, sortOrder, filename, size, caption, altText, isVisible } = req.body || {};

      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return res.status(400).json({ error: 'A valid url is required.' });
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

      const mediaItem = {
        url,
        type,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : nextSortOrder,
        filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
        size: typeof size === 'number' && size >= 0 ? size : 0,
        caption: sanitizeText(caption, MAX_CAPTION_LENGTH),
        altText: sanitizeText(altText, MAX_ALT_TEXT_LENGTH),
        isVisible: typeof isVisible === 'boolean' ? isVisible : true,
        isCover: !vendor.media.some(item => item?.isCover),
      };

      vendor.media.push(mediaItem);
      await vendor.save();

      return res.status(201).json({ vendor: normalizeMediaForResponse(vendor.toObject()) });
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
        return res.status(200).json({ vendor: normalizeMediaForResponse(vendor.toObject()) });
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
      return res.status(200).json({ vendor: normalizeMediaForResponse(vendor.toObject()) });
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
      return res.status(200).json({ vendor: normalizeMediaForResponse(vendor.toObject()) });
    }

    res.setHeader('Allow', 'POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Vendor media error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
