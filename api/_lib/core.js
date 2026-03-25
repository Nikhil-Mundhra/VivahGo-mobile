const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

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

let cachedConnection = null;

function getClientOrigins() {
  if (!process.env.CLIENT_ORIGIN) {
    return ['*'];
  }

  return process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);
}

function setCorsHeaders(req, res) {
  const origins = getClientOrigins();
  const requestOrigin = req.headers.origin;
  const allowAll = origins.includes('*');

  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && origins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

async function connectDb() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required.');
  }

  cachedConnection = mongoose.connect(mongoUri);
  return cachedConnection;
}

function getUserModel() {
  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true, index: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      name: { type: String, required: true, trim: true },
      picture: { type: String, default: '' },
      subscriptionId: { type: String, default: '' },
      subscriptionTier: { type: String, enum: ['starter', 'premium', 'studio'], default: 'starter' },
      subscriptionStatus: { type: String, enum: ['active', 'inactive', 'canceled', 'past_due'], default: 'active' },
      subscriptionCurrentPeriodEnd: { type: Date, default: null },
      isVendor: { type: Boolean, default: false },
      vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    },
    { timestamps: true }
  );

  return mongoose.models.User || mongoose.model('User', schema);
}

function getVendorModel() {
  const mediaSchema = new mongoose.Schema(
    {
      url: { type: String, required: true },
      type: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
      sortOrder: { type: Number, default: 0 },
      filename: { type: String, default: '' },
      size: { type: Number, default: 0 },
      caption: { type: String, default: '', trim: true, maxlength: 280 },
      altText: { type: String, default: '', trim: true, maxlength: 180 },
      isCover: { type: Boolean, default: false },
      isVisible: { type: Boolean, default: true },
    },
    { _id: true }
  );

  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true, index: true },
      businessName: { type: String, required: true, trim: true },
      type: {
        type: String,
        enum: ['Venue', 'Photography', 'Catering', 'Decoration', 'Music', 'Pandit'],
        required: true,
      },
      description: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
      website: { type: String, default: '', trim: true },
      isApproved: { type: Boolean, default: false },
      media: { type: [mediaSchema], default: [] },
    },
    { timestamps: true }
  );

  return mongoose.models.Vendor || mongoose.model('Vendor', schema);
}

function getPlannerModel() {
  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true, index: true },
      marriages: {
        type: [
          {
            id: String,
            bride: String,
            groom: String,
            date: String,
            venue: String,
            budget: String,
            guests: String,
            template: String,
            collaborators: {
              type: [
                {
                  email: { type: String, required: true, trim: true, lowercase: true },
                  role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'viewer' },
                  addedBy: { type: String, default: '' },
                  addedAt: { type: Date, default: () => new Date() },
                },
              ],
              default: [],
            },
            createdAt: { type: Date, default: () => new Date() },
          },
        ],
        default: [],
      },
      activePlanId: {
        type: String,
        default: null,
      },
      wedding: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      events: { type: [mongoose.Schema.Types.Mixed], default: [] },
      expenses: { type: [mongoose.Schema.Types.Mixed], default: [] },
      guests: { type: [mongoose.Schema.Types.Mixed], default: [] },
      vendors: { type: [mongoose.Schema.Types.Mixed], default: [] },
      tasks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    { timestamps: true, minimize: false }
  );

  return mongoose.models.Planner || mongoose.model('Planner', schema);
}

function buildEmptyPlanner(options = {}) {
  const ownerEmail = normalizeEmail(options.ownerEmail || '');
  const ownerId = typeof options.ownerId === 'string' ? options.ownerId : '';
  const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
              addedBy: ownerId,
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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeCollection(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeRole(value) {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return 'viewer';
}

function sanitizeCollaborators(value, ownerEmail, ownerId) {
  const owner = normalizeEmail(ownerEmail);
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
        const role = email === owner ? 'owner' : requestedRole === 'owner' ? 'viewer' : requestedRole;
        byEmail.set(email, {
          email,
          role,
          addedBy: typeof collaborator.addedBy === 'string' ? collaborator.addedBy : '',
          addedAt: collaborator.addedAt || new Date(),
        });
      });
  }

  if (owner) {
    byEmail.set(owner, {
      email: owner,
      role: 'owner',
      addedBy: ownerId || owner,
      addedAt: byEmail.get(owner)?.addedAt || new Date(),
    });
  }

  return [...byEmail.values()];
}

function sanitizeMarriages(value) {
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
      collaborators: sanitizeCollaborators(marriage.collaborators),
      createdAt: marriage.createdAt || new Date(),
    }))
    .filter(marriage => Boolean(marriage.id));
}

function sanitizePlanScopedCollection(items, validPlanIds, activePlanId) {
  return sanitizeCollection(items).map(item => {
    if (typeof item.planId === 'string' && validPlanIds.has(item.planId)) {
      return { ...item };
    }

    // Migrate legacy or malformed entries into the active plan scope.
    return {
      ...item,
      planId: activePlanId,
    };
  });
}

function sanitizePlanner(payload = {}, options = {}) {
  const ownerEmail = normalizeEmail(options.ownerEmail || payload.ownerEmail || '');
  const ownerId = typeof options.ownerId === 'string' ? options.ownerId : '';
  const marriages = sanitizeMarriages(payload.marriages).map(marriage => ({
    ...marriage,
    collaborators: sanitizeCollaborators(marriage.collaborators, ownerEmail, ownerId),
  }));
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

function getPlanFromPlanner(planner, planId) {
  if (!planner || !Array.isArray(planner.marriages)) {
    return null;
  }

  const targetPlanId = typeof planId === 'string' && planId ? planId : planner.activePlanId;
  return planner.marriages.find(marriage => marriage?.id === targetPlanId) || null;
}

function getCollaboratorRoleForPlan(plan, email) {
  const normalized = normalizeEmail(email);
  if (!plan || !Array.isArray(plan.collaborators) || !normalized) {
    return null;
  }

  return plan.collaborators.find(item => normalizeEmail(item.email) === normalized)?.role || null;
}

function hasPlanRole(plan, email, minimumRole) {
  const role = getCollaboratorRoleForPlan(plan, email);
  if (!role) {
    return false;
  }

  return (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[minimumRole] || 0);
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

function createSessionToken(user) {
  const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';
  return jwt.sign(
    {
      sub: user.googleId,
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return '';
  }
  return authHeader.slice(7);
}

async function getSubscriptionTier(googleId) {
  try {
    const User = getUserModel();
    const user = await User.findOne({ googleId }).lean();
    if (!user) {
      return 'starter';
    }
    const tier = user.subscriptionTier || 'starter';
    const status = user.subscriptionStatus || 'active';
    if (status !== 'active' && tier !== 'starter') {
      return 'starter';
    }
    return tier;
  } catch {
    return 'starter';
  }
}

function verifySession(req) {
  const token = readBearerToken(req);
  if (!token) {
    return { error: 'Authentication required.' };
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';
    return { auth: jwt.verify(token, jwtSecret) };
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }
}

module.exports = {
  buildEmptyPlanner,
  connectDb,
  createSessionToken,
  getCollaboratorRoleForPlan,
  getPlannerModel,
  getPlanFromPlanner,
  getSubscriptionTier,
  getUserModel,
  getVendorModel,
  handlePreflight,
  hasPlanRole,
  normalizeEmail,
  normalizePlannerOwnership,
  normalizeRole,
  sanitizePlanner,
  setCorsHeaders,
  verifySession,
};
