const crypto = require('crypto');
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

const defaultWebsiteSettings = {
  isActive: true,
  showCountdown: true,
  showCalendar: true,
  theme: 'royal-maroon',
  heroTagline: 'You are invited to celebrate',
  welcomeMessage: '',
  scheduleTitle: 'Wedding Calendar',
};

const ROLE_LEVEL = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

const STAFF_ROLE_LEVEL = {
  none: 0,
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
      staffRole: { type: String, enum: ['none', 'viewer', 'editor', 'owner'], default: 'none' },
      staffAddedBy: { type: String, default: '' },
      staffGrantedAt: { type: Date, default: null },
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
      key: { type: String, default: '', trim: true },
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

  const coverageAreaSchema = new mongoose.Schema(
    {
      country: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
    },
    { _id: true }
  );

  const verificationDocumentSchema = new mongoose.Schema(
    {
      key: { type: String, required: true, trim: true },
      filename: { type: String, default: '', trim: true, maxlength: 255 },
      size: { type: Number, default: 0 },
      contentType: { type: String, default: '', trim: true, maxlength: 120 },
      documentType: {
        type: String,
        enum: ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER'],
        default: 'OTHER',
      },
      uploadedAt: { type: Date, default: () => new Date() },
    },
    { _id: true }
  );

  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, unique: true, index: true },
      businessName: { type: String, required: true, trim: true },
      type: {
        type: String,
        enum: ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bride', 'Groom'],
        required: true,
      },
      subType: { type: String, default: '', trim: true },
      bundledServices: { type: [String], default: [] },
      country: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      description: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      coverageAreas: { type: [coverageAreaSchema], default: [] },
      budgetRange: {
        min: { type: Number },
        max: { type: Number },
      },
      phone: { type: String, default: '', trim: true },
      website: { type: String, default: '', trim: true },
      isApproved: { type: Boolean, default: false },
      media: { type: [mediaSchema], default: [] },
      verificationStatus: {
        type: String,
        enum: ['not_submitted', 'submitted', 'approved', 'rejected'],
        default: 'not_submitted',
      },
      verificationNotes: { type: String, default: '', trim: true, maxlength: 1000 },
      verificationReviewedAt: { type: Date, default: null },
      verificationReviewedBy: { type: String, default: '', trim: true },
      verificationDocuments: { type: [verificationDocumentSchema], default: [] },
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
      customTemplates: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
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

function getBillingReceiptModel() {
  const schema = new mongoose.Schema(
    {
      googleId: { type: String, required: true, index: true },
      email: { type: String, required: true, trim: true, lowercase: true, index: true },
      receiptNumber: { type: String, required: true, unique: true, index: true },
      plan: { type: String, enum: ['premium', 'studio'], required: true },
      billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
      currency: { type: String, default: 'INR' },
      baseAmount: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      couponCode: { type: String, default: '' },
      discountPercent: { type: Number, default: 0 },
      paymentProvider: { type: String, enum: ['razorpay', 'internal'], default: 'internal' },
      paymentReference: { type: String, default: '' },
      status: { type: String, enum: ['paid', 'issued', 'payment_due', 'failed'], default: 'issued' },
      emailDeliveryStatus: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
      emailDeliveryError: { type: String, default: '' },
      issuedAt: { type: Date, default: () => new Date() },
      currentPeriodEnd: { type: Date, default: null },
      meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    },
    { timestamps: true, minimize: false }
  );

  return mongoose.models.BillingReceipt || mongoose.model('BillingReceipt', schema);
}

function getCareerApplicationModel() {
  const schema = new mongoose.Schema(
    {
      fullName: { type: String, required: true, trim: true, maxlength: 120 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
      phone: { type: String, default: '', trim: true, maxlength: 40 },
      location: { type: String, default: '', trim: true, maxlength: 120 },
      linkedInUrl: { type: String, default: '', trim: true, maxlength: 300 },
      portfolioUrl: { type: String, default: '', trim: true, maxlength: 300 },
      coverLetter: { type: String, default: '', trim: true, maxlength: 4000 },
      jobId: { type: String, required: true, trim: true, maxlength: 120, index: true },
      jobTitle: { type: String, required: true, trim: true, maxlength: 160 },
      resumeDriveFileId: { type: String, required: true, trim: true },
      resumeDriveFileName: { type: String, required: true, trim: true },
      resumeDriveViewUrl: { type: String, default: '', trim: true },
      resumeDriveDownloadUrl: { type: String, default: '', trim: true },
      resumeOriginalFileName: { type: String, default: '', trim: true, maxlength: 255 },
      resumeMimeType: { type: String, default: 'application/pdf', trim: true },
      resumeSize: { type: Number, default: 0 },
      source: { type: String, default: 'careers-page', trim: true },
      status: { type: String, enum: ['new', 'reviewing', 'shortlisted', 'rejected'], default: 'new' },
    },
    { timestamps: true }
  );

  return mongoose.models.CareerApplication || mongoose.model('CareerApplication', schema);
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
    customTemplates: [],
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

function normalizeStaffRole(value) {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return 'none';
}

function getBootstrapAdminEmail() {
  return normalizeEmail(process.env.ADMIN_OWNER_EMAIL || 'nikhilmundhra28@gmail.com');
}

function resolveStaffRole(email, currentRole = 'none') {
  if (normalizeEmail(email) === getBootstrapAdminEmail()) {
    return 'owner';
  }

  return normalizeStaffRole(currentRole);
}

function hasStaffRole(role, minimumRole) {
  return (STAFF_ROLE_LEVEL[normalizeStaffRole(role)] || 0) >= (STAFF_ROLE_LEVEL[normalizeStaffRole(minimumRole)] || 0);
}

function getStaffAccess(role) {
  const normalizedRole = normalizeStaffRole(role);
  return {
    role: normalizedRole,
    canViewAdmin: hasStaffRole(normalizedRole, 'viewer'),
    canManageVendors: hasStaffRole(normalizedRole, 'editor'),
    canManageStaff: hasStaffRole(normalizedRole, 'owner'),
  };
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
      websiteSlug: typeof marriage.websiteSlug === 'string' ? marriage.websiteSlug.trim() : '',
      websiteSettings: {
        ...defaultWebsiteSettings,
        ...(isRecord(marriage.websiteSettings) ? marriage.websiteSettings : {}),
      },
      template: marriage.template || 'blank',
      collaborators: sanitizeCollaborators(marriage.collaborators),
      createdAt: marriage.createdAt || new Date(),
    }))
    .filter(marriage => Boolean(marriage.id));
}

function sanitizeCustomTemplateEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((event, index) => ({
      name: String(event.name || '').trim(),
      emoji: String(event.emoji || '✨').trim() || '✨',
      sortOrder: Number.isFinite(Number(event.sortOrder)) ? Number(event.sortOrder) : index,
    }))
    .filter(event => event.name)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((event, index) => ({ ...event, sortOrder: index }));
}

function sanitizeCustomTemplates(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((template, index) => {
      const id = typeof template.id === 'string' && template.id.trim()
        ? template.id.trim()
        : `custom_template_${index}`;
      const events = sanitizeCustomTemplateEvents(template.events);
      return {
        id,
        name: String(template.name || '').trim() || 'Custom Template',
        description: String(template.description || '').trim() || 'Built for your wedding flow',
        emoji: String(template.emoji || '✨').trim() || '✨',
        culture: String(template.culture || 'Custom').trim() || 'Custom',
        highlights: events.slice(0, 3).map(event => event.name),
        eventCount: events.length,
        events,
        createdAt: template.createdAt || new Date(),
      };
    });
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

async function assignWeddingWebsiteSlugs(planner, PlannerModel, ownerId = '') {
  if (!planner || !Array.isArray(planner.marriages) || !PlannerModel) {
    return planner;
  }

  const reservedCountersByBase = new Map();
  const nextMarriages = [];

  for (const marriage of planner.marriages) {
    const baseSlug = buildWeddingWebsiteBaseSlug(marriage);
    const reservedCounters = reservedCountersByBase.get(baseSlug) || new Set();
    const matchingDocs = await PlannerModel.find({
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
    customTemplates: sanitizeCustomTemplates(payload.customTemplates),
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
      staffRole: resolveStaffRole(user.email, user.staffRole),
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function getRsvpTokenSecret() {
  return process.env.RSVP_TOKEN_SECRET || process.env.JWT_SECRET || 'change-me-before-production';
}

const RSVP_TOKEN_VERSION = '1';
const RSVP_TOKEN_SIGNATURE_BYTES = 12;
const RSVP_TOKEN_DAY_MS = 24 * 60 * 60 * 1000;

function encodeRsvpTokenPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeRsvpTokenPart(value) {
  return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
}

function parseBase36BigInt(value) {
  let result = 0n;
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue) {
    throw new Error('Invalid RSVP token.');
  }

  for (const char of normalizedValue) {
    const digit = char >= '0' && char <= '9'
      ? BigInt(char.charCodeAt(0) - 48)
      : char >= 'a' && char <= 'z'
        ? BigInt(char.charCodeAt(0) - 87)
        : -1n;

    if (digit < 0n || digit >= 36n) {
      throw new Error('Invalid RSVP token.');
    }

    result = (result * 36n) + digit;
  }

  return result;
}

function encodeCompactRsvpId(value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  if (/^\d+$/.test(normalizedValue)) {
    return `n${BigInt(normalizedValue).toString(36)}`;
  }

  return `s${Buffer.from(normalizedValue, 'utf8').toString('base64url')}`;
}

function decodeCompactRsvpId(value) {
  const normalizedValue = String(value || '').trim();
  const kind = normalizedValue.charAt(0);
  const encodedValue = normalizedValue.slice(1);

  if (!kind || !encodedValue) {
    throw new Error('Invalid RSVP token.');
  }

  if (kind === 'n') {
    return parseBase36BigInt(encodedValue).toString(10);
  }

  if (kind === 's') {
    return Buffer.from(encodedValue, 'base64url').toString('utf8');
  }

  throw new Error('Invalid RSVP token.');
}

function signRsvpTokenBody(body) {
  return crypto
    .createHmac('sha256', getRsvpTokenSecret())
    .update(body)
    .digest()
    .subarray(0, RSVP_TOKEN_SIGNATURE_BYTES)
    .toString('base64url');
}

function verifyRsvpTokenSignature(body, signature) {
  const providedBuffer = Buffer.from(String(signature || ''), 'base64url');
  const expectedBuffer = Buffer.from(signRsvpTokenBody(body), 'base64url');

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid RSVP token.');
  }
}

function createGuestRsvpToken({ ownerId, guestId, version = 1, expiresInDays = 180 } = {}) {
  const normalizedOwnerId = typeof ownerId === 'string' ? ownerId.trim() : '';
  const normalizedGuestId = String(guestId || '').trim();

  if (!normalizedOwnerId || !normalizedGuestId) {
    throw new Error('ownerId and guestId are required to create an RSVP token.');
  }

  const normalizedVersion = Number.isFinite(Number(version)) ? Math.max(1, Math.trunc(Number(version))) : 1;
  const expirationDay = Math.ceil((Date.now() + (Math.max(1, Number(expiresInDays)) || 180) * RSVP_TOKEN_DAY_MS) / RSVP_TOKEN_DAY_MS);
  const body = [
    RSVP_TOKEN_VERSION,
    encodeCompactRsvpId(normalizedOwnerId),
    encodeCompactRsvpId(normalizedGuestId),
    normalizedVersion.toString(36),
    expirationDay.toString(36),
  ].join('.');

  return `${body}.${signRsvpTokenBody(body)}`;
}

function verifyLegacyGuestRsvpToken(token) {
  const [encodedPayload, signature] = String(token || '').split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid RSVP token.');
  }

  const expected = crypto
    .createHmac('sha256', getRsvpTokenSecret())
    .update(encodedPayload)
    .digest('base64url');

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error('Invalid RSVP token.');
  }

  const payload = decodeRsvpTokenPart(encodedPayload);
  if (!payload?.ownerId || !payload?.planId || !payload?.guestId) {
    throw new Error('Invalid RSVP token.');
  }

  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) {
    throw new Error('This RSVP link has expired.');
  }

  return payload;
}

function verifyGuestRsvpToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length === 2) {
    return verifyLegacyGuestRsvpToken(token);
  }

  if (parts.length !== 6) {
    throw new Error('Invalid RSVP token.');
  }

  const [tokenVersion, encodedOwnerId, encodedGuestId, encodedVersion, encodedExpirationDay, signature] = parts;
  if (tokenVersion !== RSVP_TOKEN_VERSION) {
    throw new Error('Invalid RSVP token.');
  }

  const body = parts.slice(0, 5).join('.');
  verifyRsvpTokenSignature(body, signature);

  const expirationDay = parseInt(encodedExpirationDay, 36);
  if (!Number.isFinite(expirationDay)) {
    throw new Error('Invalid RSVP token.');
  }

  const payload = {
    ownerId: decodeCompactRsvpId(encodedOwnerId),
    guestId: decodeCompactRsvpId(encodedGuestId),
    version: parseInt(encodedVersion, 36),
    exp: expirationDay * RSVP_TOKEN_DAY_MS,
  };

  if (!payload.ownerId || !payload.guestId || !Number.isFinite(payload.version)) {
    throw new Error('Invalid RSVP token.');
  }

  if (payload.exp < Date.now()) {
    throw new Error('This RSVP link has expired.');
  }

  return payload;
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
  assignWeddingWebsiteSlugs,
  buildWeddingWebsiteBaseSlug,
  buildEmptyPlanner,
  connectDb,
  createGuestRsvpToken,
  createSessionToken,
  getBillingReceiptModel,
  getCollaboratorRoleForPlan,
  getPlannerModel,
  getCareerApplicationModel,
  getPlanFromPlanner,
  getBootstrapAdminEmail,
  getStaffAccess,
  getSubscriptionTier,
  getUserModel,
  getVendorModel,
  handlePreflight,
  hasPlanRole,
  hasStaffRole,
  normalizeEmail,
  normalizePlannerOwnership,
  normalizeRole,
  normalizeStaffRole,
  resolveStaffRole,
  sanitizePlanner,
  setCorsHeaders,
  verifyGuestRsvpToken,
  verifySession,
};
