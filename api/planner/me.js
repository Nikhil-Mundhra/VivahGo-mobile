const {
  assignWeddingWebsiteSlugs,
  buildEmptyPlanner,
  connectDb,
  getCollaboratorRoleForPlan,
  getPlannerModel,
  getPlanFromPlanner,
  getSubscriptionTier,
  handlePreflight,
  hasPlanRole,
  normalizeEmail,
  normalizePlannerOwnership,
  sanitizePlanner,
  setCorsHeaders,
  verifySession,
} = require('../_lib/core');

async function resolvePlannerForSession(Planner, auth) {
  const email = normalizeEmail(auth.email);
  const requestedOwnerId = typeof auth.plannerOwnerId === 'string' ? auth.plannerOwnerId : '';

  if (!requestedOwnerId || requestedOwnerId === auth.sub) {
    return Planner.findOneAndUpdate(
      { googleId: auth.sub },
      {
        $setOnInsert: {
          googleId: auth.sub,
          ...buildEmptyPlanner({ ownerEmail: email, ownerId: auth.sub }),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  if (!email) {
    return null;
  }

  return Planner.findOne({
    googleId: requestedOwnerId,
    'marriages.collaborators.email': email,
  });
}

function findOwnerEmail(plan, fallback) {
  if (!plan || !Array.isArray(plan.collaborators)) {
    return fallback;
  }
  return plan.collaborators.find(item => item.role === 'owner')?.email || fallback;
}

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

  auth.plannerOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || '';

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const email = normalizeEmail(auth.email);

    const plannerDoc = await resolvePlannerForSession(Planner, auth);
    if (!plannerDoc) {
      return res.status(404).json({ error: 'Planner not found.' });
    }
    const ownerId = plannerDoc.googleId || auth.sub;
    const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
    const activePlan = getPlanFromPlanner(normalized, normalized.activePlanId);
    const activeRole = getCollaboratorRoleForPlan(activePlan, email) || (ownerId === auth.sub ? 'owner' : null);

    if (req.method === 'GET') {
      if (!activeRole) {
        return res.status(403).json({ error: 'You do not have access to this plan.' });
      }

      return res.status(200).json({
        planner: sanitizePlanner(normalized, { ownerEmail: findOwnerEmail(activePlan, email), ownerId }),
        plannerOwnerId: ownerId,
        access: {
          role: activeRole,
          canManageSharing: activeRole === 'owner',
          canEdit: activeRole === 'owner' || activeRole === 'editor',
        },
      });
    }

    const sanitizedPlanner = sanitizePlanner(req.body?.planner, { ownerEmail: findOwnerEmail(activePlan, email), ownerId });
    const nextPlanner = await assignWeddingWebsiteSlugs(sanitizedPlanner, Planner, ownerId);
    const nextPlan = getPlanFromPlanner(nextPlanner, nextPlanner.activePlanId);
    const ownerFallback = !email && ownerId === auth.sub;
    if (!ownerFallback && !hasPlanRole(nextPlan, email, 'editor')) {
      return res.status(403).json({ error: 'You have view-only access to this plan.' });
    }

    // Subscription gate: Starter users may only have one plan
    const currentPlanCount = Array.isArray(normalized.marriages) ? normalized.marriages.length : 0;
    const nextPlanCount = Array.isArray(nextPlanner.marriages) ? nextPlanner.marriages.length : 0;
    if (nextPlanCount > currentPlanCount) {
      const tier = await getSubscriptionTier(auth.sub);
      if (tier === 'starter' && nextPlanCount > 1) {
        return res.status(403).json({ error: 'Starter plan supports 1 wedding. Upgrade to Premium for unlimited plans.', code: 'UPGRADE_REQUIRED' });
      }
    }

    const updated = await Planner.findOneAndUpdate(
      { _id: plannerDoc._id || ownerId },
      {
        $set: {
          ...nextPlanner,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const updatedOwnerId = updated.googleId || ownerId;
    const updatedNormalized = normalizePlannerOwnership(updated.toObject(), email, updatedOwnerId);
    return res.status(200).json({
      planner: sanitizePlanner(updatedNormalized, { ownerEmail: email, ownerId: updatedOwnerId }),
      plannerOwnerId: updatedOwnerId,
    });
  } catch (err) {
    console.error('Planner API failed:', err);
    return res.status(500).json({ error: 'Failed to process planner data.' });
  }
};
