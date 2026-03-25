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
  normalizeRole,
  sanitizePlanner,
  setCorsHeaders,
  verifySession,
} = require('./_lib/core');

/******************************************************************************
 * Shared Helpers
 ******************************************************************************/

function resolvePlannerRoute(req) {
  return String(req.query?.route || '').trim().toLowerCase();
}

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

function findOwnerEmail(plan, fallback = '') {
  if (!plan || !Array.isArray(plan.collaborators)) {
    return fallback;
  }
  return plan.collaborators.find(item => item.role === 'owner')?.email || fallback;
}

function countOwners(collaborators) {
  if (!Array.isArray(collaborators)) {
    return 0;
  }
  return collaborators.filter(item => item?.role === 'owner').length;
}

/******************************************************************************
 * /api/planner/me
 ******************************************************************************/

async function handlePlannerMe(req, res) {
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
}

/******************************************************************************
 * /api/planner/access
 ******************************************************************************/

async function handlePlannerAccess(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error } = verifySession(req);
  if (error) {
    return res.status(401).json({ error });
  }

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const email = normalizeEmail(auth.email);

    const ownPlanner = await Planner.findOneAndUpdate(
      { googleId: auth.sub },
      {
        $setOnInsert: {
          googleId: auth.sub,
          ...buildEmptyPlanner({ ownerEmail: email, ownerId: auth.sub }),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const sharedPlanners = email
      ? await Planner.find({
        googleId: { $ne: auth.sub },
        'marriages.collaborators.email': email,
      })
      : [];

    const allPlanners = [ownPlanner, ...sharedPlanners]
      .filter(Boolean)
      .map(doc => {
        const planner = sanitizePlanner(normalizePlannerOwnership(doc.toObject(), email, doc.googleId), {
          ownerEmail: email,
          ownerId: doc.googleId,
        });
        const activePlan = getPlanFromPlanner(planner, planner.activePlanId);
        const role = getCollaboratorRoleForPlan(activePlan, email) || 'owner';
        return {
          plannerOwnerId: doc.googleId,
          activePlanId: planner.activePlanId,
          activePlanName: activePlan ? `${activePlan.bride || 'Bride'} & ${activePlan.groom || 'Groom'}` : 'Wedding Plan',
          role,
        };
      });

    const deduped = [];
    const seen = new Set();
    for (const item of allPlanners) {
      const ownerId = item.plannerOwnerId || auth.sub;
      if (seen.has(ownerId)) {
        continue;
      }
      seen.add(ownerId);
      deduped.push({
        ...item,
        plannerOwnerId: ownerId,
      });
    }

    return res.status(200).json({ planners: deduped });
  } catch (err) {
    console.error('Planner access API failed:', err);
    return res.status(500).json({ error: 'Failed to load accessible planners.' });
  }
}

/******************************************************************************
 * /api/planner/public
 ******************************************************************************/

async function handlePlannerPublic(req, res) {
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
}

/******************************************************************************
 * /api/planner/me/collaborators
 *
 * Sharing logic stays in its own section because it is the most policy-heavy
 * planner endpoint and is the likeliest place to grow with invitations,
 * notifications, or audit logging later.
 ******************************************************************************/

async function handlePlannerCollaborators(req, res) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error } = verifySession(req);
  if (error) {
    return res.status(401).json({ error });
  }

  const requestedOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || '';

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const email = normalizeEmail(auth.email);

    const plannerOwnerId = requestedOwnerId || auth.sub;
    const planner = await Planner.findOne({ googleId: plannerOwnerId });
    if (!planner) {
      return res.status(404).json({ error: 'Planner not found.' });
    }

    const plannerObject = planner.toObject();
    const requestedPlanId = req.method === 'GET' ? req.query?.planId : req.body?.planId;
    const sourcePlan = getPlanFromPlanner(plannerObject, requestedPlanId || plannerObject.activePlanId);

    if (!sourcePlan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    const planOwnerEmail = findOwnerEmail(sourcePlan);
    const normalizedPlanner = normalizePlannerOwnership(plannerObject, planOwnerEmail, planner.googleId || plannerOwnerId);
    const planId = requestedPlanId || normalizedPlanner.activePlanId;
    const plan = getPlanFromPlanner(normalizedPlanner, planId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    if (!hasPlanRole(plan, email, 'viewer')) {
      return res.status(403).json({ error: 'You do not have access to this plan.' });
    }

    const actorRole = getCollaboratorRoleForPlan(plan, email);

    if (req.method === 'GET') {
      return res.status(200).json({ collaborators: plan.collaborators || [], plannerOwnerId });
    }

    if (!(actorRole === 'owner' || actorRole === 'editor')) {
      return res.status(403).json({ error: 'Only owners and editors can manage sharing.' });
    }

    const nextCollaborators = [...(plan.collaborators || [])];

    if (req.method === 'POST') {
      const tier = await getSubscriptionTier(auth.sub);
      if (tier === 'starter') {
        return res.status(403).json({ error: 'Collaborators require a Premium or Studio subscription.', code: 'UPGRADE_REQUIRED' });
      }

      const collaboratorEmail = normalizeEmail(req.body?.email);
      const role = normalizeRole(req.body?.role);

      if (!collaboratorEmail) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      if (role === 'owner') {
        return res.status(400).json({ error: 'Owner role cannot be assigned.' });
      }

      if (nextCollaborators.some(item => normalizeEmail(item.email) === collaboratorEmail)) {
        return res.status(409).json({ error: 'This person already has access.' });
      }

      nextCollaborators.push({
        email: collaboratorEmail,
        role,
        addedBy: auth.sub,
        addedAt: new Date(),
      });
    }

    if (req.method === 'PUT') {
      if (actorRole === 'editor') {
        return res.status(403).json({ error: 'Editors can only add collaborators.' });
      }

      const collaboratorEmail = normalizeEmail(req.body?.email);
      const role = normalizeRole(req.body?.role);
      const index = nextCollaborators.findIndex(item => normalizeEmail(item.email) === collaboratorEmail);

      if (index < 0) {
        return res.status(404).json({ error: 'Collaborator not found.' });
      }

      if (nextCollaborators[index].role === 'owner') {
        return res.status(400).json({ error: 'Owner role cannot be changed.' });
      }

      if (role === 'owner') {
        return res.status(400).json({ error: 'Owner role cannot be assigned.' });
      }

      nextCollaborators[index] = {
        ...nextCollaborators[index],
        role,
      };
    }

    if (req.method === 'DELETE') {
      if (actorRole === 'editor') {
        return res.status(403).json({ error: 'Editors can only add collaborators.' });
      }

      const collaboratorEmail = normalizeEmail(req.query?.email || req.body?.email);
      const index = nextCollaborators.findIndex(item => normalizeEmail(item.email) === collaboratorEmail);

      if (index < 0) {
        return res.status(404).json({ error: 'Collaborator not found.' });
      }

      if (nextCollaborators[index].role === 'owner') {
        return res.status(400).json({ error: 'Owner cannot be removed.' });
      }

      nextCollaborators.splice(index, 1);
    }

    if (countOwners(nextCollaborators) !== 1) {
      return res.status(400).json({ error: 'Exactly one owner is required for each plan.' });
    }

    const updatedMarriages = (normalizedPlanner.marriages || []).map(item => {
      if (item.id !== plan.id) {
        return item;
      }
      return {
        ...item,
        collaborators: nextCollaborators,
      };
    });

    const ownerEmail = findOwnerEmail({ collaborators: nextCollaborators });
    const updated = await Planner.findOneAndUpdate(
      { _id: planner._id },
      { $set: { marriages: updatedMarriages } },
      { new: true }
    );

    const sanitized = sanitizePlanner(updated.toObject(), { ownerEmail, ownerId: planner.googleId || plannerOwnerId });
    const updatedPlan = getPlanFromPlanner(sanitized, plan.id);

    return res.status(200).json({
      collaborators: updatedPlan?.collaborators || [],
      role: getCollaboratorRoleForPlan(updatedPlan, email),
      plannerOwnerId,
    });
  } catch (err) {
    console.error('Collaborators API failed:', err);
    return res.status(500).json({ error: 'Failed to process sharing settings.' });
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

  const route = resolvePlannerRoute(req);

  if (route === 'me') {
    return handlePlannerMe(req, res);
  }

  if (route === 'access') {
    return handlePlannerAccess(req, res);
  }

  if (route === 'public') {
    return handlePlannerPublic(req, res);
  }

  if (route === 'collaborators') {
    return handlePlannerCollaborators(req, res);
  }

  res.setHeader('Allow', 'OPTIONS');
  return res.status(404).json({ error: 'Planner route not found.' });
}

module.exports = handler;
module.exports.handlePlannerAccess = handlePlannerAccess;
module.exports.handlePlannerCollaborators = handlePlannerCollaborators;
module.exports.handlePlannerMe = handlePlannerMe;
module.exports.handlePlannerPublic = handlePlannerPublic;
