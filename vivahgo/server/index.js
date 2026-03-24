import 'dotenv/config';

import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';

import Planner from './models/Planner.js';
import User from './models/User.js';

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';

const emptyWedding = {
  bride: '',
  groom: '',
  date: '',
  venue: '',
  guests: '',
  budget: '',
};

const ROLE_LEVEL = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeRole(value) {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return 'viewer';
}

export function buildEmptyPlanner(options = {}) {
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const ownerEmail = normalizeEmail(options.ownerEmail);

  return {
    marriages: [
      {
        id: planId,
        bride: '',
        groom: '',
        date: '',
        venue: '',
        budget: '',
        guests: '',
        template: 'blank',
        collaborators: ownerEmail
          ? [
            {
              email: ownerEmail,
              role: 'owner',
              addedBy: options.ownerId || '',
              addedAt: new Date(),
            },
          ]
          : [],
        createdAt: new Date(),
      },
    ],
    activePlanId: planId,
    wedding: { ...emptyWedding },
    events: [],
    expenses: [],
    guests: [],
    vendors: [],
    tasks: [],
  };
}

export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeCollection(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function sanitizeCollaborators(value, ownerEmail, ownerId) {
  const normalizedOwner = normalizeEmail(ownerEmail);
  const byEmail = new Map();

  if (Array.isArray(value)) {
    value
      .filter(isRecord)
      .forEach(collaborator => {
        const email = normalizeEmail(collaborator.email);
        if (!email) {
          return;
        }

        const requestedRole = normalizeRole(collaborator.role);
        const role = email === normalizedOwner ? 'owner' : requestedRole === 'owner' ? 'viewer' : requestedRole;
        byEmail.set(email, {
          email,
          role,
          addedBy: typeof collaborator.addedBy === 'string' ? collaborator.addedBy : '',
          addedAt: collaborator.addedAt || new Date(),
        });
      });
  }

  if (normalizedOwner) {
    byEmail.set(normalizedOwner, {
      email: normalizedOwner,
      role: 'owner',
      addedBy: ownerId || normalizedOwner,
      addedAt: byEmail.get(normalizedOwner)?.addedAt || new Date(),
    });
  }

  return [...byEmail.values()];
}

function sanitizeMarriages(value, ownerEmail, ownerId) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map(marriage => ({
      id: typeof marriage.id === 'string' && marriage.id.trim() ? marriage.id : null,
      bride: marriage.bride || '',
      groom: marriage.groom || '',
      date: marriage.date || '',
      venue: marriage.venue || '',
      budget: marriage.budget || '',
      guests: marriage.guests || '',
      template: marriage.template || 'blank',
      collaborators: sanitizeCollaborators(marriage.collaborators, ownerEmail, ownerId),
      createdAt: marriage.createdAt || new Date(),
    }))
    .filter(marriage => Boolean(marriage.id));
}

function sanitizePlanScopedCollection(items, validPlanIds, activePlanId) {
  return sanitizeCollection(items).map(item => {
    if (typeof item.planId === 'string' && validPlanIds.has(item.planId)) {
      return { ...item };
    }

    return {
      ...item,
      planId: activePlanId,
    };
  });
}

export function sanitizePlanner(payload = {}, options = {}) {
  const ownerEmail = normalizeEmail(options.ownerEmail || payload.ownerEmail || '');
  const ownerId = typeof options.ownerId === 'string' ? options.ownerId : '';
  const marriages = sanitizeMarriages(payload.marriages, ownerEmail, ownerId);
  const fallbackPlanId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (marriages.length === 0) {
    marriages.push({
      id: fallbackPlanId,
      bride: '',
      groom: '',
      date: '',
      venue: '',
      budget: '',
      guests: '',
      template: 'blank',
      collaborators: sanitizeCollaborators([], ownerEmail, ownerId),
      createdAt: new Date(),
    });
  }

  const validPlanIds = new Set(marriages.map(marriage => marriage.id));
  const activePlanId = typeof payload.activePlanId === 'string' && validPlanIds.has(payload.activePlanId)
    ? payload.activePlanId
    : marriages[0].id;
  const wedding = isRecord(payload.wedding)
    ? { ...emptyWedding, ...payload.wedding }
    : { ...emptyWedding };

  return {
    marriages,
    activePlanId,
    wedding,
    events: sanitizePlanScopedCollection(payload.events, validPlanIds, activePlanId),
    expenses: sanitizePlanScopedCollection(payload.expenses, validPlanIds, activePlanId),
    guests: sanitizePlanScopedCollection(payload.guests, validPlanIds, activePlanId),
    vendors: sanitizePlanScopedCollection(payload.vendors, validPlanIds, activePlanId),
    tasks: sanitizePlanScopedCollection(payload.tasks, validPlanIds, activePlanId),
  };
}

export function getPlanFromPlanner(planner, planId) {
  if (!planner || !Array.isArray(planner.marriages)) {
    return null;
  }

  const targetPlanId = typeof planId === 'string' && planId ? planId : planner.activePlanId;
  return planner.marriages.find(marriage => marriage?.id === targetPlanId) || null;
}

export function getCollaboratorRoleForPlan(plan, email) {
  const normalized = normalizeEmail(email);
  if (!plan || !Array.isArray(plan.collaborators) || !normalized) {
    return null;
  }

  return plan.collaborators.find(item => normalizeEmail(item.email) === normalized)?.role || null;
}

export function hasPlanRole(plan, email, minimumRole) {
  const role = getCollaboratorRoleForPlan(plan, email);
  if (!role) {
    return false;
  }

  return (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[minimumRole] || 0);
}

export function createSessionToken(user, secret = jwtSecret) {
  return jwt.sign(
    {
      sub: user.googleId,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: '7d' }
  );
}

export function getClientOrigins(clientOrigin = process.env.CLIENT_ORIGIN) {
  if (!clientOrigin) {
    return true;
  }

  return clientOrigin.split(',').map(origin => origin.trim());
}

export function authMiddleware(req, res, next, secret = jwtSecret) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function hasPlannerContent(planner) {
  if (!planner) {
    return false;
  }

  if (Array.isArray(planner.events) && planner.events.length > 0) {
    return true;
  }
  if (Array.isArray(planner.expenses) && planner.expenses.length > 0) {
    return true;
  }
  if (Array.isArray(planner.guests) && planner.guests.length > 0) {
    return true;
  }
  if (Array.isArray(planner.vendors) && planner.vendors.length > 0) {
    return true;
  }
  if (Array.isArray(planner.tasks) && planner.tasks.length > 0) {
    return true;
  }

  if (!Array.isArray(planner.marriages)) {
    return false;
  }

  return planner.marriages.some(item => (
    Boolean(item?.bride) ||
    Boolean(item?.groom) ||
    Boolean(item?.date) ||
    Boolean(item?.venue) ||
    Boolean(item?.budget) ||
    Boolean(item?.guests)
  ));
}

function normalizePlannerOwnership(planner, ownerEmail, ownerId) {
  if (!planner || !Array.isArray(planner.marriages)) {
    return planner;
  }

  planner.marriages = planner.marriages.map(marriage => ({
    ...marriage,
    collaborators: sanitizeCollaborators(marriage.collaborators, ownerEmail, ownerId),
  }));

  return planner;
}

function findOwnerEmail(plan) {
  if (!plan || !Array.isArray(plan.collaborators)) {
    return '';
  }
  return plan.collaborators.find(item => item.role === 'owner')?.email || '';
}

async function resolvePlannerForSession(PlannerModel, auth) {
  const email = normalizeEmail(auth.email);
  const requestedOwnerId = typeof auth.plannerOwnerId === 'string' ? auth.plannerOwnerId : '';

  if (requestedOwnerId && requestedOwnerId !== auth.sub && typeof PlannerModel.findOne === 'function') {
    if (!email) {
      return null;
    }

    return PlannerModel.findOne({
      googleId: requestedOwnerId,
      'marriages.collaborators.email': email,
    });
  }

  if (typeof PlannerModel.findOne !== 'function') {
    return PlannerModel.findOneAndUpdate(
      { googleId: auth.sub },
      {
        $setOnInsert: {
          googleId: auth.sub,
          ...buildEmptyPlanner({ ownerEmail: email, ownerId: auth.sub }),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
  }

  const ownPlanner = await PlannerModel.findOne({ googleId: auth.sub });
  const sharedPlanner = email
    ? await PlannerModel.findOne({
      googleId: { $ne: auth.sub },
      'marriages.collaborators.email': email,
    })
    : null;

  if (ownPlanner && (!sharedPlanner || hasPlannerContent(ownPlanner))) {
    return ownPlanner;
  }

  if (sharedPlanner) {
    return sharedPlanner;
  }

  if (ownPlanner) {
    return ownPlanner;
  }

  return PlannerModel.findOneAndUpdate(
    { googleId: auth.sub },
    {
      $setOnInsert: {
        googleId: auth.sub,
        ...buildEmptyPlanner({ ownerEmail: email, ownerId: auth.sub }),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function listAccessiblePlanners(PlannerModel, auth) {
  const email = normalizeEmail(auth.email);
  const ownPlanner = await PlannerModel.findOneAndUpdate(
    { googleId: auth.sub },
    {
      $setOnInsert: {
        googleId: auth.sub,
        ...buildEmptyPlanner({ ownerEmail: email, ownerId: auth.sub }),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const shared = email && typeof PlannerModel.find === 'function'
    ? await PlannerModel.find({ googleId: { $ne: auth.sub }, 'marriages.collaborators.email': email })
    : [];

  const docs = [ownPlanner, ...shared].filter(Boolean);
  const seen = new Set();
  const planners = [];

  docs.forEach(doc => {
    const ownerId = doc.googleId;
    if (!ownerId || seen.has(ownerId)) {
      return;
    }
    seen.add(ownerId);

    const normalized = sanitizePlanner(normalizePlannerOwnership(doc.toObject(), email, ownerId), {
      ownerEmail: email,
      ownerId,
    });
    const activePlan = getPlanFromPlanner(normalized, normalized.activePlanId);
    const role = getCollaboratorRoleForPlan(activePlan, email) || 'owner';

    planners.push({
      plannerOwnerId: ownerId,
      activePlanId: normalized.activePlanId,
      activePlanName: activePlan ? `${activePlan.bride || 'Bride'} & ${activePlan.groom || 'Groom'}` : 'Wedding Plan',
      role,
    });
  });

  return planners;
}

export function createApp(options = {}) {
  const {
    googleClientId: injectedGoogleClientId = googleClientId,
    jwtSecret: injectedJwtSecret = jwtSecret,
    oauthClient: injectedOauthClient,
    PlannerModel = Planner,
    UserModel = User,
  } = options;

  const oauthClient =
    injectedOauthClient !== undefined
      ? injectedOauthClient
      : injectedGoogleClientId
        ? new OAuth2Client(injectedGoogleClientId)
        : null;

  const app = express();

  app.use(
    cors({
      origin: getClientOrigins(),
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/google', async (req, res) => {
    if (!oauthClient || !injectedGoogleClientId) {
      return res.status(500).json({ error: 'Google auth is not configured on the server.' });
    }

    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ error: 'Missing Google credential.' });
    }

    try {
      const ticket = await oauthClient.verifyIdToken({
        idToken: credential,
        audience: injectedGoogleClientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || !payload.name) {
        return res.status(400).json({ error: 'Google account details are incomplete.' });
      }

      const user = await UserModel.findOneAndUpdate(
        { googleId: payload.sub },
        {
          $set: {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture || '',
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      const planner = await PlannerModel.findOneAndUpdate(
        { googleId: payload.sub },
        {
          $setOnInsert: {
            googleId: payload.sub,
            ...buildEmptyPlanner({ ownerEmail: payload.email, ownerId: payload.sub }),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.json({
        token: createSessionToken(user, injectedJwtSecret),
        user: {
          id: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        planner: sanitizePlanner(planner.toObject(), { ownerEmail: user.email, ownerId: user.googleId }),
        plannerOwnerId: user.googleId,
      });
    } catch (error) {
      console.error('Google auth failed:', error);
      return res.status(401).json({ error: 'Google sign-in could not be verified.' });
    }
  });

  app.get('/api/planner/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      req.auth.plannerOwnerId = req.query?.plannerOwnerId || '';
      const plannerDoc = await resolvePlannerForSession(PlannerModel, req.auth);
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }
      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || req.auth.sub;
      const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const activePlan = getPlanFromPlanner(normalized, normalized.activePlanId);
      const role = getCollaboratorRoleForPlan(activePlan, email) || (ownerId === req.auth.sub ? 'owner' : null);

      if (!role) {
        return res.status(403).json({ error: 'You do not have access to this plan.' });
      }

      return res.json({
        planner: sanitizePlanner(normalized, { ownerEmail: findOwnerEmail(activePlan) || email, ownerId }),
        plannerOwnerId: ownerId,
        access: {
          role,
          canManageSharing: role === 'owner',
          canEdit: role === 'owner' || role === 'editor',
        },
      });
    } catch (error) {
      console.error('Failed to load planner:', error);
      return res.status(500).json({ error: 'Failed to load planner data.' });
    }
  });

  app.put('/api/planner/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      req.auth.plannerOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || '';
      const plannerDoc = await resolvePlannerForSession(PlannerModel, req.auth);
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }
      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || req.auth.sub;
      const normalizedCurrent = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const currentPlan = getPlanFromPlanner(normalizedCurrent, normalizedCurrent.activePlanId);
      const ownerEmail = findOwnerEmail(currentPlan) || email;
      const planner = sanitizePlanner(req.body?.planner, { ownerEmail, ownerId });
      const nextPlan = getPlanFromPlanner(planner, planner.activePlanId);

      const ownerFallback = !email && ownerId === req.auth.sub;
      if (!ownerFallback && !hasPlanRole(nextPlan, email, 'editor')) {
        return res.status(403).json({ error: 'You have view-only access to this plan.' });
      }

      // Subscription gate: Starter users may only have one plan
      const currentPlanCount = Array.isArray(normalizedCurrent.marriages) ? normalizedCurrent.marriages.length : 0;
      const nextPlanCount = Array.isArray(planner.marriages) ? planner.marriages.length : 0;
      if (nextPlanCount > currentPlanCount) {
        const tier = await getUserSubscriptionTier(UserModel, req.auth.sub);
        if (tier === 'starter' && nextPlanCount > 1) {
          return res.status(403).json({ error: 'Starter plan supports 1 wedding. Upgrade to Premium for unlimited plans.', code: 'UPGRADE_REQUIRED' });
        }
      }

      const updatedPlanner = await PlannerModel.findOneAndUpdate(
        { _id: plannerDoc._id || ownerId },
        {
          $set: {
            ...planner,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      return res.json({
        planner: sanitizePlanner(updatedPlanner.toObject(), { ownerEmail, ownerId }),
        plannerOwnerId: ownerId,
      });
    } catch (error) {
      console.error('Failed to save planner:', error);
      return res.status(500).json({ error: 'Failed to save planner data.' });
    }
  });

  app.get('/api/planner/access', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const planners = await listAccessiblePlanners(PlannerModel, req.auth);
      return res.json({ planners });
    } catch (error) {
      console.error('Failed to list accessible planners:', error);
      return res.status(500).json({ error: 'Failed to load accessible planners.' });
    }
  });

  app.get('/api/planner/me/collaborators', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      req.auth.plannerOwnerId = req.query?.plannerOwnerId || '';
      const plannerDoc = await resolvePlannerForSession(PlannerModel, req.auth);
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }
      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || req.auth.sub;
      const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const plan = getPlanFromPlanner(normalized, req.query?.planId || normalized.activePlanId);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found.' });
      }

      if (!hasPlanRole(plan, email, 'viewer')) {
        return res.status(403).json({ error: 'You do not have access to this plan.' });
      }

      return res.json({ collaborators: plan.collaborators || [], plannerOwnerId: ownerId });
    } catch (error) {
      console.error('Failed to load collaborators:', error);
      return res.status(500).json({ error: 'Failed to load sharing settings.' });
    }
  });

  app.post('/api/planner/me/collaborators', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const plannerOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || req.auth.sub;
      const plannerDoc = await PlannerModel.findOne({ googleId: plannerOwnerId });
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }

      // Subscription gate: only Premium / Studio can add collaborators
      const tier = await getUserSubscriptionTier(UserModel, req.auth.sub);
      if (tier === 'starter') {
        return res.status(403).json({ error: 'Collaborators require a Premium or Studio subscription.', code: 'UPGRADE_REQUIRED' });
      }

      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || req.auth.sub;
      const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const plan = getPlanFromPlanner(normalized, req.body?.planId || normalized.activePlanId);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found.' });
      }

      if (!( (!email && ownerId === req.auth.sub) || hasPlanRole(plan, email, 'owner') )) {
        return res.status(403).json({ error: 'Only owners can manage sharing.' });
      }

      const collaboratorEmail = normalizeEmail(req.body?.email);
      const role = normalizeRole(req.body?.role);

      if (!collaboratorEmail) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      if ((plan.collaborators || []).some(item => normalizeEmail(item.email) === collaboratorEmail)) {
        return res.status(409).json({ error: 'This person already has access.' });
      }

      const nextCollaborators = [
        ...(plan.collaborators || []),
        {
          email: collaboratorEmail,
          role,
          addedBy: req.auth.sub,
          addedAt: new Date(),
        },
      ];

      const marriages = (normalized.marriages || []).map(item => {
        if (item.id !== plan.id) {
          return item;
        }
        return {
          ...item,
          collaborators: nextCollaborators,
        };
      });

      const updated = await PlannerModel.findOneAndUpdate(
        { _id: plannerDoc._id },
        { $set: { marriages } },
        { new: true }
      );

      const updatedPlanner = sanitizePlanner(updated.toObject(), {
        ownerEmail: findOwnerEmail({ collaborators: nextCollaborators }) || email,
        ownerId,
      });
      const updatedPlan = getPlanFromPlanner(updatedPlanner, plan.id);
      return res.json({ collaborators: updatedPlan?.collaborators || [], plannerOwnerId: ownerId });
    } catch (error) {
      console.error('Failed to add collaborator:', error);
      return res.status(500).json({ error: 'Failed to update sharing settings.' });
    }
  });

  app.put('/api/planner/me/collaborators', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const plannerOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || req.auth.sub;
      const plannerDoc = await PlannerModel.findOne({ googleId: plannerOwnerId });
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }

      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || req.auth.sub;
      const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const plan = getPlanFromPlanner(normalized, req.body?.planId || normalized.activePlanId);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found.' });
      }

      if (!( (!email && ownerId === req.auth.sub) || hasPlanRole(plan, email, 'owner') )) {
        return res.status(403).json({ error: 'Only owners can manage sharing.' });
      }

      const collaboratorEmail = normalizeEmail(req.body?.email);
      const role = normalizeRole(req.body?.role);
      const nextCollaborators = [...(plan.collaborators || [])];
      const index = nextCollaborators.findIndex(item => normalizeEmail(item.email) === collaboratorEmail);

      if (index < 0) {
        return res.status(404).json({ error: 'Collaborator not found.' });
      }

      if (nextCollaborators[index].role === 'owner') {
        return res.status(400).json({ error: 'Owner role cannot be changed.' });
      }

      nextCollaborators[index] = {
        ...nextCollaborators[index],
        role,
      };

      const marriages = (normalized.marriages || []).map(item => {
        if (item.id !== plan.id) {
          return item;
        }
        return {
          ...item,
          collaborators: nextCollaborators,
        };
      });

      const updated = await PlannerModel.findOneAndUpdate(
        { _id: plannerDoc._id },
        { $set: { marriages } },
        { new: true }
      );

      const updatedPlanner = sanitizePlanner(updated.toObject(), {
        ownerEmail: findOwnerEmail({ collaborators: nextCollaborators }) || email,
        ownerId,
      });
      const updatedPlan = getPlanFromPlanner(updatedPlanner, plan.id);
      return res.json({ collaborators: updatedPlan?.collaborators || [], plannerOwnerId: ownerId });
    } catch (error) {
      console.error('Failed to change collaborator role:', error);
      return res.status(500).json({ error: 'Failed to update sharing settings.' });
    }
  });

  app.delete('/api/planner/me/collaborators', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const plannerOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || req.auth.sub;
      const plannerDoc = await PlannerModel.findOne({ googleId: plannerOwnerId });
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }

      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || req.auth.sub;
      const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const plan = getPlanFromPlanner(normalized, req.body?.planId || req.query?.planId || normalized.activePlanId);

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found.' });
      }

      if (!( (!email && ownerId === req.auth.sub) || hasPlanRole(plan, email, 'owner') )) {
        return res.status(403).json({ error: 'Only owners can manage sharing.' });
      }

      const collaboratorEmail = normalizeEmail(req.body?.email || req.query?.email);
      const nextCollaborators = [...(plan.collaborators || [])];
      const index = nextCollaborators.findIndex(item => normalizeEmail(item.email) === collaboratorEmail);

      if (index < 0) {
        return res.status(404).json({ error: 'Collaborator not found.' });
      }

      if (nextCollaborators[index].role === 'owner') {
        return res.status(400).json({ error: 'Owner cannot be removed.' });
      }

      nextCollaborators.splice(index, 1);

      const marriages = (normalized.marriages || []).map(item => {
        if (item.id !== plan.id) {
          return item;
        }
        return {
          ...item,
          collaborators: nextCollaborators,
        };
      });

      const updated = await PlannerModel.findOneAndUpdate(
        { _id: plannerDoc._id },
        { $set: { marriages } },
        { new: true }
      );

      const updatedPlanner = sanitizePlanner(updated.toObject(), {
        ownerEmail: findOwnerEmail({ collaborators: nextCollaborators }) || email,
        ownerId,
      });
      const updatedPlan = getPlanFromPlanner(updatedPlanner, plan.id);
      return res.json({ collaborators: updatedPlan?.collaborators || [], plannerOwnerId: ownerId });
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      return res.status(500).json({ error: 'Failed to update sharing settings.' });
    }
  });

  // ── Subscription routes ──────────────────────────────────────────────────

  const SUBSCRIPTION_PRICE_MAP = {
    premium: { monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID, yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID },
    studio: { monthly: process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID, yearly: process.env.STRIPE_STUDIO_YEARLY_PRICE_ID },
  };

  app.get('/api/subscription/status', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const user = await UserModel.findOne({ googleId: req.auth.sub }).lean();
      if (!user) {
        return res.json({ tier: 'starter', status: 'active', currentPeriodEnd: null });
      }
      return res.json({
        tier: user.subscriptionTier || 'starter',
        status: user.subscriptionStatus || 'active',
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
      });
    } catch (error) {
      console.error('Subscription status failed:', error);
      return res.status(500).json({ error: 'Failed to load subscription status.' });
    }
  });

  app.post('/api/subscription/checkout', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    const { plan, billingCycle } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const priceId = SUBSCRIPTION_PRICE_MAP[plan]?.[cycle];
    if (!priceId) {
      return res.status(500).json({ error: `Price ID for ${plan} (${cycle}) is not configured.` });
    }

    const clientOrigin = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim() || 'http://localhost:5173';
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || clientOrigin;

    try {
      const user = await UserModel.findOne({ googleId: req.auth.sub });
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const stripe = Stripe(stripeSecretKey);
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { googleId: user.googleId },
        });
        customerId = customer.id;
        await UserModel.updateOne({ googleId: req.auth.sub }, { $set: { stripeCustomerId: customerId } });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${returnUrl}/?subscription=success`,
        cancel_url: `${returnUrl}/?subscription=canceled`,
        subscription_data: { metadata: { googleId: req.auth.sub, plan } },
      });

      return res.json({ url: session.url });
    } catch (error) {
      console.error('Checkout session creation failed:', error);
      return res.status(500).json({ error: 'Failed to create checkout session.' });
    }
  });

  app.post('/api/subscription/portal', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    const clientOrigin = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim() || 'http://localhost:5173';
    const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || clientOrigin;

    try {
      const user = await UserModel.findOne({ googleId: req.auth.sub }).lean();
      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ error: 'No active subscription found to manage.' });
      }
      const stripe = Stripe(stripeSecretKey);
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });
      return res.json({ url: portalSession.url });
    } catch (error) {
      console.error('Portal session creation failed:', error);
      return res.status(500).json({ error: 'Failed to open subscription management portal.' });
    }
  });

  app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      return res.status(500).json({ error: 'Stripe webhook is not configured.' });
    }

    const stripe = Stripe(stripeSecretKey);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription && session.customer) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const googleId = subscription.metadata?.googleId;
          const plan = tierForPlan(subscription.metadata?.plan || '');
          if (googleId) {
            await UserModel.updateOne({ googleId }, {
              $set: {
                stripeCustomerId: session.customer,
                subscriptionId: session.subscription,
                subscriptionTier: plan,
                subscriptionStatus: 'active',
                subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
              },
            });
          }
        }
      }

      if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const googleId = subscription.metadata?.googleId;
        if (googleId) {
          const stripeStatus = subscription.status;
          const appStatus = ['active', 'past_due'].includes(stripeStatus) ? stripeStatus : 'inactive';
          const plan = tierForPlan(subscription.metadata?.plan || '');
          await UserModel.updateOne({ googleId }, {
            $set: {
              subscriptionId: subscription.id,
              subscriptionTier: appStatus === 'active' ? plan : 'starter',
              subscriptionStatus: appStatus,
              subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const googleId = subscription.metadata?.googleId;
        if (googleId) {
          await UserModel.updateOne({ googleId }, {
            $set: { subscriptionTier: 'starter', subscriptionStatus: 'inactive', subscriptionCurrentPeriodEnd: null },
          });
        }
      }

      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        if (invoice.customer) {
          await UserModel.updateOne({ stripeCustomerId: invoice.customer }, { $set: { subscriptionStatus: 'past_due' } });
        }
      }

      return res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook handler failed:', error);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  });

  return app;
}

function tierForPlan(plan) {
  if (plan === 'studio') return 'studio';
  if (plan === 'premium') return 'premium';
  return 'starter';
}

async function getUserSubscriptionTier(UserModel, googleId) {
  if (typeof UserModel?.findOne !== 'function') {
    return 'starter';
  }
  try {
    const user = await UserModel.findOne({ googleId }).lean();
    if (!user) return 'starter';
    const tier = user.subscriptionTier || 'starter';
    const status = user.subscriptionStatus || 'active';
    if (status !== 'active' && tier !== 'starter') return 'starter';
    return tier;
  } catch {
    return 'starter';
  }
}

export const app = createApp();

export async function start() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`VivahGo API listening on http://localhost:${port}`);
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
