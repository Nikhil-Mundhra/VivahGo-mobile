const {
  connectDb,
  getPlannerModel,
  handlePreflight,
  sanitizePlanner,
  setCorsHeaders,
} = require('../_lib/core');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const slug = typeof req.query?.slug === 'string' ? req.query.slug.trim().toLowerCase() : '';
  if (!slug) {
    return res.status(400).json({ error: 'A website slug is required.' });
  }

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const plannerDoc = await Planner.findOne({ 'marriages.websiteSlug': slug });

    if (!plannerDoc) {
      return res.status(404).json({ error: 'Wedding website not found.' });
    }

    const planner = sanitizePlanner(plannerDoc.toObject(), { ownerId: plannerDoc.googleId || '' });
    const publicPlan = (planner.marriages || []).find(item => String(item.websiteSlug || '').toLowerCase() === slug);

    if (!publicPlan) {
      return res.status(404).json({ error: 'Wedding website not found.' });
    }

    if (publicPlan.websiteSettings?.isActive === false) {
      return res.status(404).json({ error: 'Wedding website not found.' });
    }

    const wedding = {
      ...planner.wedding,
      bride: publicPlan.bride || planner.wedding?.bride || '',
      groom: publicPlan.groom || planner.wedding?.groom || '',
      date: publicPlan.date || planner.wedding?.date || '',
      venue: publicPlan.venue || planner.wedding?.venue || '',
      guests: publicPlan.guests || planner.wedding?.guests || '',
      budget: publicPlan.budget || planner.wedding?.budget || '',
    };

    return res.status(200).json({
      wedding,
      plan: {
        id: publicPlan.id,
        bride: publicPlan.bride || '',
        groom: publicPlan.groom || '',
        date: publicPlan.date || '',
        venue: publicPlan.venue || '',
        websiteSlug: publicPlan.websiteSlug || '',
        websiteSettings: publicPlan.websiteSettings || {},
      },
      events: (planner.events || []).filter(item => item?.planId === publicPlan.id && item?.isPublicWebsiteVisible !== false),
    });
  } catch (error) {
    console.error('Public planner API failed:', error);
    return res.status(500).json({ error: 'Failed to load wedding website.' });
  }
};
