const {
  buildEmptyPlanner,
  connectDb,
  getPlannerModel,
  handlePreflight,
  sanitizePlanner,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error } = verifySession(req);
  if (error) {
    return res.status(401).json({ error });
  }

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const googleId = auth.sub;

    if (req.method === 'GET') {
      const planner = await Planner.findOneAndUpdate(
        { googleId },
        {
          $setOnInsert: {
            googleId,
            ...buildEmptyPlanner(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ planner: sanitizePlanner(planner.toObject()) });
    }

    const nextPlanner = sanitizePlanner(req.body?.planner);
    const updated = await Planner.findOneAndUpdate(
      { googleId },
      {
        $set: {
          ...nextPlanner,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ planner: sanitizePlanner(updated.toObject()) });
  } catch (err) {
    console.error('Planner API failed:', err);
    return res.status(500).json({ error: 'Failed to process planner data.' });
  }
};
