const {
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
} = require('../../_lib/core');

function findOwnerEmail(plan) {
  if (!plan || !Array.isArray(plan.collaborators)) {
    return '';
  }
  return plan.collaborators.find(item => item.role === 'owner')?.email || '';
}

function countOwners(collaborators) {
  if (!Array.isArray(collaborators)) {
    return 0;
  }
  return collaborators.filter(item => item?.role === 'owner').length;
}

module.exports = async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }

  setCorsHeaders(req, res);

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
};
