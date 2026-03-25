import 'dotenv/config';

import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Razorpay from 'razorpay';

import Planner from './models/Planner.js';
import User from './models/User.js';
import Vendor from './models/Vendor.js';

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

const defaultWebsiteSettings = {
  isActive: true,
  showCountdown: true,
  showCalendar: true,
};

const ROLE_LEVEL = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

const VENDOR_TYPES = ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bride', 'Groom'];
const BUNDLED_SERVICE_OPTIONS = VENDOR_TYPES.filter(type => type !== 'Honeymoon');
const VENDOR_SUBTYPE_OPTIONS = {
  Venue: ['Wedding Lawns', 'Farmhouses', 'Hotels', 'Banquet Halls', 'Marriage Garden', 'Kalyana Mandapams', 'Wedding Resorts'],
  'Wedding Transportation': ['Guest Transport', 'Airport Transfers', 'Luxury Cars', 'Baraat Entry Vehicles'],
  'Wedding Entertainment': ['Live Performers', 'Celebrity Acts', 'Anchors / MC', 'Baraat Entertainment'],
  Music: ['Live Band', 'Dhol', 'Sufi Night', 'Instrumental Ensemble'],
  'Wedding Invitations': ['Luxury Box Invitations', 'Digital E-Invites', 'Traditional Cards', 'Invitation Hampers'],
  'Wedding Gifts': ['Guest Hampers', 'Shagun Gifts', 'Bridesmaid Gifts', 'Corporate Gifting'],
  Florists: ['Varmala Florals', 'Fresh Venue Florals', 'Car Florals', 'Table Arrangements'],
  'Wedding Planners': ['Full Planning', 'Partial Planning', 'Wedding Coordination', 'Destination Wedding Planning'],
  'Wedding Videography': ['Cinematic Wedding Films', 'Teaser Reels', 'Documentary Coverage', 'Drone Videography'],
  'Wedding Decorators': ['Mandap Decor', 'Floral Decor', 'Stage Decor', 'Theme Decor'],
  'Wedding Cakes': ['Tiered Wedding Cakes', 'Dessert Tables', 'Fondant Cakes', 'Eggless Cakes'],
  'Wedding DJ': ['Sangeet DJ', 'Cocktail DJ', 'After Party DJ', 'Sound & Lights'],
  Pandit: ['Wedding Pandit', 'Phera Specialist', 'South Indian Priest', 'Samagri Guidance'],
  Photobooth: ['Instant Print Booth', 'GIF Booth', 'Mirror Booth', '360 Video Booth'],
  Astrologers: ['Kundli Matching', 'Muhurat Consultation', 'Remedy Guidance', 'Online Consultation'],
  'Party Places': ['Cocktail Venues', 'Rooftop Venues', 'Private Dining', 'After Party Spaces'],
  Choreographer: ['Couple Choreography', 'Family Performances', 'Sangeet Concepts', 'At-Home Rehearsals'],
  Bride: ['Bridal Jewellery', 'Bridal Makeup Artists', 'Bridal Lehenga', 'Mehndi Artists', 'Makeup Salon', 'Trousseau Packing'],
  Groom: ['Sherwani'],
};
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 5000000;

const DEFAULT_SUBSCRIPTION_AMOUNT_MAP = {
  premium: { monthly: 200000, yearly: 1920000 },
  studio: { monthly: 500000, yearly: 4800000 },
};

const COUPON_FILE_PATH = new URL('../../config/subscription-coupons.json', import.meta.url);

function resolveSubscriptionAmount(plan, billingCycle) {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const envKey = `RAZORPAY_${plan.toUpperCase()}_${cycle.toUpperCase()}_AMOUNT`;
  const fromEnv = Number(process.env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }

  return DEFAULT_SUBSCRIPTION_AMOUNT_MAP[plan]?.[cycle] || 0;
}

function readCouponCatalog() {
  try {
    return JSON.parse(fs.readFileSync(COUPON_FILE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function resolveCoupon(couponCode) {
  const normalizedCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
  if (!normalizedCode) {
    return null;
  }

  const coupon = readCouponCatalog().find((entry) => entry?.code === normalizedCode);
  if (!coupon) {
    throw new Error('Coupon code is invalid.');
  }

  const expiresAt = Date.parse(coupon.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    throw new Error('Coupon code has expired.');
  }

  const discountPercent = Number(coupon.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent >= 100) {
    throw new Error('Coupon discount is invalid.');
  }

  return {
    code: normalizedCode,
    expiresAt: coupon.expiresAt,
    discountPercent,
  };
}

function applyCouponDiscount(amount, coupon) {
  if (!coupon) {
    return amount;
  }

  return Math.round(amount * (100 - coupon.discountPercent) / 100);
}

function buildSubscriptionPeriodEnd(billingCycle, startDate = new Date()) {
  const next = new Date(startDate);
  if (billingCycle === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expected === signature;
}

function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
}

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
        websiteSlug: '',
        websiteSettings: { ...defaultWebsiteSettings },
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

function slugifyWeddingNamePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildWeddingWebsiteBaseSlug(plan = {}) {
  const bride = slugifyWeddingNamePart(plan.bride);
  const groom = slugifyWeddingNamePart(plan.groom);
  const combined = [bride, groom].filter(Boolean).join('-');
  return combined || 'our-wedding';
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSlugCounter(slug, baseSlug) {
  const match = String(slug || '').match(new RegExp(`^${escapeRegex(baseSlug)}-(\\d+)$`, 'i'));
  return match ? Number(match[1]) : null;
}

async function assignWeddingWebsiteSlugs(planner, ownerId = '', plannerModel = Planner) {
  if (!planner || !Array.isArray(planner.marriages)) {
    return planner;
  }

  const reservedCountersByBase = new Map();
  const nextMarriages = [];

  for (const marriage of planner.marriages) {
    const baseSlug = buildWeddingWebsiteBaseSlug(marriage);
    const reservedCounters = reservedCountersByBase.get(baseSlug) || new Set();
    const matchingDocs = await plannerModel.find({
      'marriages.websiteSlug': { $regex: `^${escapeRegex(baseSlug)}-`, $options: 'i' },
    }).lean();

    const usedCounters = new Set(reservedCounters);
    for (const doc of matchingDocs) {
      for (const plan of Array.isArray(doc?.marriages) ? doc.marriages : []) {
        if (doc?.googleId === ownerId && plan?.id === marriage.id) {
          continue;
        }
        const counter = extractSlugCounter(plan?.websiteSlug, baseSlug);
        if (counter) {
          usedCounters.add(counter);
        }
      }
    }

    let preferredCounter = extractSlugCounter(marriage.websiteSlug, baseSlug);
    if (!preferredCounter || usedCounters.has(preferredCounter)) {
      preferredCounter = 1;
      while (usedCounters.has(preferredCounter)) {
        preferredCounter += 1;
      }
    }

    usedCounters.add(preferredCounter);
    reservedCountersByBase.set(baseSlug, usedCounters);
    nextMarriages.push({
      ...marriage,
      websiteSlug: `${baseSlug}-${preferredCounter}`,
    });
  }

  return {
    ...planner,
    marriages: nextMarriages,
  };
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
      websiteSlug: typeof marriage.websiteSlug === 'string' ? marriage.websiteSlug.trim() : '',
      websiteSettings: {
        ...defaultWebsiteSettings,
        ...(isRecord(marriage.websiteSettings) ? marriage.websiteSettings : {}),
      },
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
      websiteSlug: '',
      websiteSettings: { ...defaultWebsiteSettings },
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

function normalizeVendorSubtype(type, subType) {
  const allowedSubtypes = VENDOR_SUBTYPE_OPTIONS[type] || [];
  const normalizedSubType = typeof subType === 'string' ? subType.trim() : '';

  if (!normalizedSubType) {
    return '';
  }

  if (!allowedSubtypes.includes(normalizedSubType)) {
    throw new Error(`subType must be one of: ${allowedSubtypes.join(', ')}.`);
  }

  return normalizedSubType;
}

function normalizeCoverageAreas(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      country: typeof item.country === 'string' ? item.country.trim() : '',
      state: typeof item.state === 'string' ? item.state.trim() : '',
      city: typeof item.city === 'string' ? item.city.trim() : '',
    }))
    .filter(item => item.country && item.state && item.city);
}

function normalizeBundledServices(type, value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => item && item !== type && BUNDLED_SERVICE_OPTIONS.includes(item))
  ));
}

function normalizeBudgetRange(value) {
  if (!value || typeof value !== 'object') {
    return { min: 100000, max: 300000 };
  }

  const min = Number(value.min);
  const max = Number(value.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('budgetRange.min and budgetRange.max must be numbers.');
  }

  const safeMin = Math.max(MIN_BUDGET_LIMIT, Math.min(Math.round(min), MAX_BUDGET_LIMIT));
  const safeMax = Math.max(safeMin, Math.min(Math.round(max), MAX_BUDGET_LIMIT));

  return { min: safeMin, max: safeMax };
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

  app.delete('/api/auth/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      await Promise.all([
        UserModel.deleteOne({ googleId: req.auth.sub }),
        PlannerModel.deleteOne({ googleId: req.auth.sub }),
      ]);
      return res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/auth/me error:', err);
      return res.status(500).json({ error: 'Failed to delete account. Please try again.' });
    }
  });

  app.get('/api/vendor/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const vendor = await Vendor.findOne({ googleId: req.auth.sub }).lean();
      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
      return res.json({ vendor });
    } catch (error) {
      console.error('Failed to load vendor profile:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.post('/api/vendor/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const {
        businessName,
        type,
        subType,
        description,
        country,
        state,
        city,
        phone,
        website,
        coverageAreas,
        bundledServices,
        budgetRange,
      } = req.body || {};

      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        return res.status(400).json({ error: 'businessName is required.' });
      }
      if (!VENDOR_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      let normalizedSubType = '';
      let normalizedBudgetRange;
      try {
        normalizedSubType = normalizeVendorSubtype(type, subType);
        normalizedBudgetRange = normalizeBudgetRange(budgetRange || {});
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const existing = await Vendor.findOne({ googleId: req.auth.sub }).lean();
      if (existing) {
        return res.status(409).json({ error: 'Vendor profile already exists. Use PATCH to update.' });
      }

      const vendor = await Vendor.create({
        googleId: req.auth.sub,
        businessName: businessName.trim(),
        type,
        subType: normalizedSubType,
        bundledServices: normalizeBundledServices(type, bundledServices),
        country: (country || '').trim(),
        state: (state || '').trim(),
        description: (description || '').trim(),
        city: (city || '').trim(),
        coverageAreas: normalizeCoverageAreas(coverageAreas),
        phone: (phone || '').trim(),
        website: (website || '').trim(),
        budgetRange: normalizedBudgetRange,
      });

      await UserModel.findOneAndUpdate(
        { googleId: req.auth.sub },
        { $set: { isVendor: true, vendorId: vendor._id } }
      );

      return res.status(201).json({ vendor });
    } catch (error) {
      console.error('Vendor registration failed:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.patch('/api/vendor/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const body = req.body || {};
      const updates = {};
      const existingVendor = await Vendor.findOne({ googleId: req.auth.sub }).lean();

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const allowedUpdateFields = ['businessName', 'type', 'subType', 'description', 'country', 'state', 'city', 'phone', 'website'];
      for (const field of allowedUpdateFields) {
        if (typeof body[field] === 'string') {
          updates[field] = body[field].trim();
        }
      }

      if (Array.isArray(body.coverageAreas)) {
        updates.coverageAreas = normalizeCoverageAreas(body.coverageAreas);
      }

      if (Array.isArray(body.bundledServices)) {
        updates.bundledServices = normalizeBundledServices(updates.type || existingVendor.type, body.bundledServices);
      }

      if (body.budgetRange && typeof body.budgetRange === 'object') {
        try {
          updates.budgetRange = normalizeBudgetRange(body.budgetRange);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      if (updates.type && !VENDOR_TYPES.includes(updates.type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      try {
        const resolvedType = updates.type || existingVendor.type;
        if ('subType' in updates || updates.type) {
          updates.subType = normalizeVendorSubtype(resolvedType, updates.subType ?? body.subType ?? '');
        }
        if (updates.type && !('bundledServices' in updates)) {
          updates.bundledServices = normalizeBundledServices(resolvedType, existingVendor.bundledServices);
        }
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const vendor = await Vendor.findOneAndUpdate(
        { googleId: req.auth.sub },
        { $set: updates },
        { new: true }
      );

      return res.json({ vendor });
    } catch (error) {
      console.error('Vendor profile update failed:', error);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.get('/api/vendors', async (_req, res) => {
    try {
      const raw = await Vendor.find({ isApproved: true }).select('-__v').lean();
      const vendors = raw.map(vendor => ({
        id: `db_${vendor._id}`,
        name: vendor.businessName,
        type: vendor.type,
        subType: vendor.subType || '',
        bundledServices: Array.isArray(vendor.bundledServices) ? vendor.bundledServices : [],
        description: vendor.description || '',
        country: vendor.country || '',
        state: vendor.state || '',
        city: vendor.city || '',
        phone: vendor.phone || '',
        website: vendor.website || '',
        emoji: '🏷️',
        rating: 0,
        priceLevel: null,
        booked: false,
        locations: [
          [vendor.city, vendor.state, vendor.country].filter(Boolean).join(', '),
          ...(Array.isArray(vendor.coverageAreas)
            ? vendor.coverageAreas.map(item => [item.city, item.state, item.country].filter(Boolean).join(', '))
            : []),
        ].filter(Boolean),
        media: Array.isArray(vendor.media) ? vendor.media : [],
        coverImageUrl: Array.isArray(vendor.media)
          ? (vendor.media.find(item => item?.type === 'IMAGE')?.url || '')
          : '',
      }));

      return res.json({ vendors });
    } catch (error) {
      console.error('Approved vendors fetch failed:', error);
      return res.status(500).json({ error: 'Could not fetch vendors.' });
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
      const sanitizedPlanner = sanitizePlanner(req.body?.planner, { ownerEmail, ownerId });
      const planner = await assignWeddingWebsiteSlugs(sanitizedPlanner, ownerId, PlannerModel);
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

  app.get('/api/planner/public', async (req, res) => {
    try {
      const slug = typeof req.query?.slug === 'string' ? req.query.slug.trim().toLowerCase() : '';
      if (!slug) {
        return res.status(400).json({ error: 'A website slug is required.' });
      }

      const plannerDoc = await PlannerModel.findOne({ 'marriages.websiteSlug': slug });
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

      return res.json({
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
      console.error('Failed to load public planner website:', error);
      return res.status(500).json({ error: 'Failed to load wedding website.' });
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

  app.post('/api/subscription/quote', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    const { plan, billingCycle, couponCode } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const baseAmount = resolveSubscriptionAmount(plan, cycle);
    if (!baseAmount) {
      return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });
    }

    try {
      const coupon = resolveCoupon(couponCode);
      const amount = applyCouponDiscount(baseAmount, coupon);
      return res.json({
        amount,
        baseAmount,
        currency: 'INR',
        appliedCoupon: coupon,
        plan,
        billingCycle: cycle,
      });
    } catch (error) {
      const statusCode = /coupon/i.test(error?.message || '') ? 400 : 500;
      return res.status(statusCode).json({ error: error?.message || 'Failed to calculate checkout quote.' });
    }
  });

  app.post('/api/subscription/checkout', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    const { plan, billingCycle, couponCode } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "premium" or "studio".' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const baseAmount = resolveSubscriptionAmount(plan, cycle);
    if (!baseAmount) {
      return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });
    }

    try {
      const user = await UserModel.findOne({ googleId: req.auth.sub }).lean();
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const coupon = resolveCoupon(couponCode);
      const amount = applyCouponDiscount(baseAmount, coupon);

      const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
      const order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `vivahgo_${plan}_${Date.now()}`,
        notes: {
          googleId: req.auth.sub,
          plan,
          billingCycle: cycle,
          email: user.email,
          couponCode: coupon?.code || '',
        },
      });

      return res.json({
        keyId: razorpayKeyId,
        orderId: order.id,
        amount: order.amount,
        baseAmount,
        currency: order.currency,
        name: 'VivahGo',
        description: `${plan === 'studio' ? 'Studio' : 'Premium'} ${cycle === 'yearly' ? 'yearly' : 'monthly'} plan`,
        appliedCoupon: coupon,
        prefill: {
          name: user.name,
          email: user.email,
        },
        notes: order.notes || {},
      });
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      const statusCode = /coupon/i.test(error?.message || '') ? 400 : 500;
      return res.status(statusCode).json({ error: error?.message || 'Failed to create checkout order.' });
    }
  });

  app.post('/api/subscription/confirm', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeySecret) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    const { plan, billingCycle, orderId, paymentId, signature } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan.' });
    }

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Payment confirmation is incomplete.' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const isValid = verifyRazorpayPaymentSignature(orderId, paymentId, signature, razorpayKeySecret);
    if (!isValid) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    try {
      await UserModel.updateOne(
        { googleId: req.auth.sub },
        {
          $set: {
            subscriptionId: paymentId,
            subscriptionTier: tierForPlan(plan),
            subscriptionStatus: 'active',
            subscriptionCurrentPeriodEnd: buildSubscriptionPeriodEnd(cycle),
          },
        }
      );

      return res.json({ success: true });
    } catch (error) {
      console.error('Razorpay payment confirmation failed:', error);
      return res.status(500).json({ error: 'Failed to confirm payment.' });
    }
  });

  app.post('/api/subscription/portal', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    return res.status(501).json({ error: 'Razorpay self-serve subscription management is not configured. Choose a new plan from pricing instead.' });
  });

  app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(500).json({ error: 'Razorpay webhook is not configured.' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature || !verifyRazorpayWebhookSignature(req.body, signature, webhookSecret)) {
      return res.status(400).json({ error: 'Webhook signature verification failed.' });
    }

    try {
      const event = JSON.parse(req.body.toString('utf8'));
      const payment = event?.payload?.payment?.entity;
      const notes = payment?.notes || {};

      if (event?.event === 'payment.captured' && notes.googleId && notes.plan) {
        await UserModel.updateOne(
          { googleId: notes.googleId },
          {
            $set: {
              subscriptionId: payment.id,
              subscriptionTier: tierForPlan(notes.plan),
              subscriptionStatus: 'active',
              subscriptionCurrentPeriodEnd: buildSubscriptionPeriodEnd(notes.billingCycle),
            },
          }
        );
      }

      if (event?.event === 'payment.failed' && notes.googleId) {
        await UserModel.updateOne(
          { googleId: notes.googleId },
          { $set: { subscriptionStatus: 'inactive' } }
        );
      }

      if (event?.event === 'refund.processed' && notes.googleId) {
        await UserModel.updateOne(
          { googleId: notes.googleId },
          {
            $set: {
              subscriptionTier: 'starter',
              subscriptionStatus: 'inactive',
              subscriptionCurrentPeriodEnd: null,
            },
          }
        );
      }

      return res.json({ received: true });
    } catch (error) {
      console.error('Razorpay webhook handler failed:', error);
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
