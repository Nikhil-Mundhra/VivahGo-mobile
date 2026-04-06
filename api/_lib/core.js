const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const PROCESS_BOOTED_AT = Date.now();
const PUBLIC_CACHE_POLICIES = Object.freeze({
  noStore: 'no-store',
  vendorDirectory: 'public, s-maxage=300, stale-while-revalidate=3600',
  plannerPublic: 'public, s-maxage=60, stale-while-revalidate=600',
  careersCatalog: 'public, s-maxage=300, stale-while-revalidate=3600',
});

const sharedPublicCacheState = globalThis.__vivahgoPublicCacheState || {
  entries: new Map(),
  tags: new Map(),
  versions: new Map(),
};
globalThis.__vivahgoPublicCacheState = sharedPublicCacheState;

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

const defaultReminderSettings = {
  enabled: false,
  eventDayBefore: true,
  eventHoursBefore: true,
  paymentThreeDaysBefore: true,
  paymentDayOf: true,
};

const defaultNotificationPreferences = {
  browserPushEnabled: false,
  eventReminders: true,
  paymentReminders: true,
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
let cachedConnectionReadyState = 'cold';
const rateLimitBuckets = new Map();
let lastRateLimitSweepAt = 0;
const SESSION_COOKIE_NAME = 'vivahgo_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const CSRF_COOKIE_NAME = 'vivahgo_csrf';
const CSRF_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

function getConfiguredSecret(envKey, fallbackValue) {
  const configuredValue = process.env[envKey];
  if (configuredValue && configuredValue !== fallbackValue) {
    return configuredValue;
  }

  if (isProductionEnv()) {
    throw new Error(`${envKey} must be configured in production.`);
  }

  return configuredValue || fallbackValue;
}

function getClientOrigins() {
  if (!process.env.CLIENT_ORIGIN) {
    return ['*'];
  }

  return process.env.CLIENT_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);
}

function requestIsSecure(req) {
  const forwardedProto = typeof req?.headers?.['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim().toLowerCase()
    : '';

  return forwardedProto === 'https' || Boolean(req?.socket?.encrypted || req?.connection?.encrypted);
}

function readRequestOriginHeader(req) {
  return typeof req?.headers?.origin === 'string'
    ? req.headers.origin.trim()
    : '';
}

function readRequestHost(req) {
  if (typeof req?.headers?.['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host'].trim()) {
    return req.headers['x-forwarded-host'].split(',')[0].trim();
  }

  return typeof req?.headers?.host === 'string'
    ? req.headers.host.trim()
    : '';
}

function getRequestOrigin(req) {
  const host = readRequestHost(req);
  if (!host) {
    return '';
  }

  const protocol = requestIsSecure(req) ? 'https' : 'http';
  return `${protocol}://${host}`;
}

function getCookieSameSiteMode(req) {
  if (!requestIsSecure(req)) {
    return 'Lax';
  }

  const requestOrigin = readRequestOriginHeader(req);
  const responseOrigin = getRequestOrigin(req);
  if (!requestOrigin || !responseOrigin) {
    return 'Lax';
  }

  try {
    if (new URL(requestOrigin).origin !== new URL(responseOrigin).origin) {
      return 'None';
    }
  } catch {
    return 'Lax';
  }

  return 'Lax';
}

function parseCookieHeader(value) {
  return String(value || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf('=');
      if (separatorIndex <= 0) {
        return cookies;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const rawValue = pair.slice(separatorIndex + 1).trim();
      try {
        cookies[name] = decodeURIComponent(rawValue);
      } catch {
        cookies[name] = rawValue;
      }
      return cookies;
    }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(String(value || ''))}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.trunc(Number(options.maxAge) || 0))}`);
  }
  if (options.expires) {
    parts.push(`Expires=${new Date(options.expires).toUTCString()}`);
  }
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function appendSetCookieHeader(res, value) {
  const existing = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : res.headers?.['Set-Cookie'];

  if (!existing) {
    res.setHeader('Set-Cookie', value);
    return;
  }

  const nextValues = Array.isArray(existing) ? [...existing, value] : [existing, value];
  res.setHeader('Set-Cookie', nextValues);
}

function setSessionCookie(req, res, token) {
  appendSetCookieHeader(res, serializeCookie(SESSION_COOKIE_NAME, token, {
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: Date.now() + (SESSION_MAX_AGE_SECONDS * 1000),
    httpOnly: true,
    sameSite: getCookieSameSiteMode(req),
    secure: requestIsSecure(req),
    path: '/',
  }));
}

function setCsrfCookie(req, res, token) {
  appendSetCookieHeader(res, serializeCookie(CSRF_COOKIE_NAME, token, {
    maxAge: CSRF_MAX_AGE_SECONDS,
    expires: Date.now() + (CSRF_MAX_AGE_SECONDS * 1000),
    httpOnly: false,
    sameSite: getCookieSameSiteMode(req),
    secure: requestIsSecure(req),
    path: '/',
  }));
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function readCsrfCookieToken(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);
  return typeof cookies[CSRF_COOKIE_NAME] === 'string' ? cookies[CSRF_COOKIE_NAME] : '';
}

function readCsrfHeaderToken(req) {
  const headerValue = req?.headers?.['x-csrf-token'];
  if (typeof headerValue === 'string') {
    return headerValue.trim();
  }
  if (Array.isArray(headerValue)) {
    return String(headerValue[0] || '').trim();
  }
  return '';
}

function ensureCsrfToken(req, res, options = {}) {
  const existingToken = readCsrfCookieToken(req);
  if (existingToken) {
    if (options.refresh) {
      setCsrfCookie(req, res, existingToken);
    }
    return existingToken;
  }

  const nextToken = generateCsrfToken();
  setCsrfCookie(req, res, nextToken);
  return nextToken;
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
}

function hasBearerToken(req) {
  return Boolean(readBearerToken(req));
}

function requireCsrfProtection(req, res, options = {}) {
  if (options.skip === true || isSafeMethod(req?.method)) {
    return false;
  }

  if (options.skipForBearer !== false && hasBearerToken(req)) {
    return false;
  }

  const cookieToken = readCsrfCookieToken(req);
  const headerToken = readCsrfHeaderToken(req);

  if (!cookieToken || !headerToken) {
    res.status(403).json({ error: 'CSRF token required.', code: 'CSRF_REQUIRED' });
    return true;
  }

  if (cookieToken.length !== headerToken.length) {
    res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
    return true;
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
      return true;
    }
  } catch {
    res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
    return true;
  }

  return false;
}

function clearSessionCookie(req, res) {
  appendSetCookieHeader(res, serializeCookie(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    expires: 0,
    httpOnly: true,
    sameSite: getCookieSameSiteMode(req),
    secure: requestIsSecure(req),
    path: '/',
  }));
}

function setSecurityHeaders(req, res, options = {}) {
  res.setHeader('Referrer-Policy', options.referrerPolicy || 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', options.frameOptions || 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', options.permissionsPolicy || 'camera=(), microphone=(), geolocation=()');

  if (options.contentSecurityPolicy) {
    res.setHeader('Content-Security-Policy', options.contentSecurityPolicy);
  }

  if (requestIsSecure(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
}

function setCorsHeaders(req, res) {
  const origins = getClientOrigins();
  const requestOrigin = req.headers.origin;
  const allowAll = origins.includes('*');

  setSecurityHeaders(req, res);

  if (allowAll && requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && origins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
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

  const startedAt = Date.now();
  cachedConnectionReadyState = 'connecting';
  cachedConnection = mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    maxIdleTimeMS: 60000,
  })
    .then((connection) => {
      cachedConnectionReadyState = 'connected';
      console.info('[perf] connectDb ready', {
        coldStart: process.uptime() < 15,
        durationMs: Date.now() - startedAt,
        processUptimeMs: Math.round(process.uptime() * 1000),
        processBootAgeMs: Date.now() - PROCESS_BOOTED_AT,
      });
      return connection;
    })
    .catch((error) => {
      cachedConnection = null;
      cachedConnectionReadyState = 'cold';
      console.error('[perf] connectDb failed', {
        durationMs: Date.now() - startedAt,
        message: error?.message || 'Unknown Mongo error',
      });
      throw error;
    });
  return cachedConnection;
}

function getCacheControlPolicy(policyName) {
  return PUBLIC_CACHE_POLICIES[policyName] || PUBLIC_CACHE_POLICIES.noStore;
}

function setCacheControl(res, policyName) {
  const value = getCacheControlPolicy(policyName);
  if (value && typeof res?.setHeader === 'function') {
    res.setHeader('Cache-Control', value);
  }
  return value;
}

function getPublicCacheVersion(key) {
  return sharedPublicCacheState.versions.get(String(key || '')) || 0;
}

function getPublicCache(cacheKey) {
  const normalizedKey = String(cacheKey || '').trim();
  if (!normalizedKey) {
    return null;
  }

  const entry = sharedPublicCacheState.entries.get(normalizedKey);
  if (!entry) {
    return null;
  }

  if (entry.version !== getPublicCacheVersion(normalizedKey)) {
    sharedPublicCacheState.entries.delete(normalizedKey);
    return null;
  }

  return entry;
}

function setPublicCache(cacheKey, value, options = {}) {
  const normalizedKey = String(cacheKey || '').trim();
  if (!normalizedKey) {
    return null;
  }

  const tags = Array.isArray(options.tags)
    ? options.tags.map(tag => String(tag || '').trim()).filter(Boolean)
    : [];

  const existing = sharedPublicCacheState.entries.get(normalizedKey);
  if (existing && Array.isArray(existing.tags)) {
    for (const oldTag of existing.tags) {
      const tagSet = sharedPublicCacheState.tags.get(oldTag);
      if (tagSet) {
        tagSet.delete(normalizedKey);
        if (tagSet.size === 0) {
          sharedPublicCacheState.tags.delete(oldTag);
        }
      }
    }
  }

  const entry = {
    key: normalizedKey,
    value,
    tags,
    updatedAt: Date.now(),
    version: getPublicCacheVersion(normalizedKey),
  };

  sharedPublicCacheState.entries.set(normalizedKey, entry);
  for (const tag of tags) {
    if (!sharedPublicCacheState.tags.has(tag)) {
      sharedPublicCacheState.tags.set(tag, new Set());
    }
    sharedPublicCacheState.tags.get(tag).add(normalizedKey);
  }

  return entry;
}

function invalidatePublicCache(target, options = {}) {
  const normalizedTarget = String(target || '').trim();
  if (!normalizedTarget) {
    return [];
  }

  const keys = new Set();
  if (options.scope === 'tag') {
    const taggedKeys = sharedPublicCacheState.tags.get(normalizedTarget);
    if (taggedKeys) {
      for (const key of taggedKeys) {
        keys.add(key);
      }
    }
    sharedPublicCacheState.tags.delete(normalizedTarget);
  } else {
    keys.add(normalizedTarget);
  }

  for (const key of keys) {
    const entry = sharedPublicCacheState.entries.get(key);
    if (entry && Array.isArray(entry.tags)) {
      for (const tag of entry.tags) {
        const tagSet = sharedPublicCacheState.tags.get(tag);
        if (tagSet) {
          tagSet.delete(key);
          if (tagSet.size === 0) {
            sharedPublicCacheState.tags.delete(tag);
          }
        }
      }
    }
    sharedPublicCacheState.entries.delete(key);
    sharedPublicCacheState.versions.set(key, getPublicCacheVersion(key) + 1);
  }

  return [...keys];
}

function resetPublicCache() {
  sharedPublicCacheState.entries.clear();
  sharedPublicCacheState.tags.clear();
  sharedPublicCacheState.versions.clear();
}

async function withRequestMetrics(name, operation) {
  const startedAt = Date.now();
  try {
    const result = await operation();
    console.info('[perf] request', {
      handler: name,
      durationMs: Date.now() - startedAt,
      dbState: cachedConnectionReadyState,
      processUptimeMs: Math.round(process.uptime() * 1000),
    });
    return result;
  } catch (error) {
    console.error('[perf] request failed', {
      handler: name,
      durationMs: Date.now() - startedAt,
      dbState: cachedConnectionReadyState,
      message: error?.message || 'Unknown request error',
    });
    throw error;
  }
}

function getClientIp(req) {
  const forwardedFor = typeof req?.headers?.['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',')[0].trim()
    : '';
  const realIp = typeof req?.headers?.['x-real-ip'] === 'string'
    ? req.headers['x-real-ip'].trim()
    : '';
  const socketIp = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';

  return forwardedFor || realIp || socketIp || 'unknown';
}

function sweepRateLimitBuckets(now = Date.now()) {
  if (now - lastRateLimitSweepAt < 60 * 1000) {
    return;
  }

  lastRateLimitSweepAt = now;
  for (const [bucketKey, bucket] of rateLimitBuckets.entries()) {
    if (!bucket?.length || bucket.expiresAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }
}

function applyRateLimit(req, res, key, options = {}) {
  const windowMs = Number.isFinite(Number(options.windowMs)) ? Math.max(1000, Math.trunc(Number(options.windowMs))) : 60 * 1000;
  const max = Number.isFinite(Number(options.max)) ? Math.max(1, Math.trunc(Number(options.max))) : 10;
  const message = options.message || 'Too many requests. Please try again shortly.';
  const now = Date.now();

  sweepRateLimitBuckets(now);

  const bucketKey = `${key}:${getClientIp(req)}`;
  const existingBucket = rateLimitBuckets.get(bucketKey);
  const timestamps = Array.isArray(existingBucket?.timestamps)
    ? existingBucket.timestamps.filter(timestamp => now - timestamp < windowMs)
    : [];

  if (timestamps.length >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - timestamps[0])) / 1000));
    rateLimitBuckets.set(bucketKey, {
      timestamps,
      expiresAt: timestamps[0] + windowMs,
    });
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ error: message });
    return true;
  }

  timestamps.push(now);
  rateLimitBuckets.set(bucketKey, {
    timestamps,
    expiresAt: timestamps[0] + windowMs,
  });
  return false;
}

function resetRateLimitBuckets() {
  rateLimitBuckets.clear();
  lastRateLimitSweepAt = 0;
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
      notificationPreferences: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({ ...defaultNotificationPreferences }),
      },
      notificationDevices: {
        type: [
          {
            token: { type: String, required: true, trim: true },
            platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
            deviceLabel: { type: String, default: '', trim: true },
            appVersion: { type: String, default: '', trim: true },
            createdAt: { type: Date, default: () => new Date() },
            lastSeenAt: { type: Date, default: () => new Date() },
            disabledAt: { type: Date, default: null },
          },
        ],
        default: [],
      },
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

  const availabilityOverrideSchema = new mongoose.Schema(
    {
      date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
      maxCapacity: { type: Number, required: true, min: 0, max: 99 },
      bookingsCount: { type: Number, default: 0, min: 0, max: 99 },
    },
    { _id: true }
  );

  const availabilitySettingsSchema = new mongoose.Schema(
    {
      hasDefaultCapacity: { type: Boolean, default: true },
      defaultMaxCapacity: { type: Number, default: 1, min: 0, max: 99 },
      dateOverrides: { type: [availabilityOverrideSchema], default: [] },
    },
    { _id: false }
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
        enum: ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bridal & Pre-Bridal', 'Groom Services', 'Bride', 'Groom'],
        required: true,
      },
      subType: { type: String, default: '', trim: true },
      bundledServices: { type: [String], default: [] },
      country: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      description: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      googleMapsLink: { type: String, default: '', trim: true },
      coverageAreas: { type: [coverageAreaSchema], default: [] },
      budgetRange: {
        min: { type: Number },
        max: { type: Number },
      },
      phone: { type: String, default: '', trim: true },
      website: { type: String, default: '', trim: true },
      isApproved: { type: Boolean, default: false },
      tier: {
        type: String,
        enum: ['Free', 'Plus'],
        default: 'Free',
      },
      vendorRevision: { type: Number, default: 0, min: 0 },
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
      availabilitySettings: { type: availabilitySettingsSchema, default: () => ({}) },
    },
    { timestamps: true }
  );

  return mongoose.models.Vendor || mongoose.model('Vendor', schema);
}

function getChoiceProfileModel() {
  const selectedVendorMediaSchema = new mongoose.Schema(
    {
      vendorId: { type: String, default: '', trim: true },
      vendorName: { type: String, default: '', trim: true },
      sourceMediaId: { type: String, default: '', trim: true },
      r2Url: { type: String, required: true, trim: true },
      mediaType: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
      sortOrder: { type: Number, default: 0 },
      filename: { type: String, default: '', trim: true, maxlength: 255 },
      size: { type: Number, default: 0, min: 0 },
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

  const availabilityOverrideSchema = new mongoose.Schema(
    {
      date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
      maxCapacity: { type: Number, required: true, min: 0, max: 99 },
      bookingsCount: { type: Number, default: 0, min: 0, max: 99 },
    },
    { _id: true }
  );

  const availabilitySettingsSchema = new mongoose.Schema(
    {
      hasDefaultCapacity: { type: Boolean, default: true },
      defaultMaxCapacity: { type: Number, default: 1, min: 0, max: 99 },
      dateOverrides: { type: [availabilityOverrideSchema], default: [] },
    },
    { _id: false }
  );

  const mediaSchema = new mongoose.Schema(
    {
      key: { type: String, default: '', trim: true },
      url: { type: String, required: true, trim: true },
      type: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
      sortOrder: { type: Number, default: 0 },
      filename: { type: String, default: '', trim: true, maxlength: 255 },
      size: { type: Number, default: 0, min: 0 },
      caption: { type: String, default: '', trim: true, maxlength: 280 },
      altText: { type: String, default: '', trim: true, maxlength: 180 },
      isCover: { type: Boolean, default: false },
      isVisible: { type: Boolean, default: true },
    },
    { _id: true }
  );

  const schema = new mongoose.Schema(
    {
      _id: { type: String, required: true, trim: true },
      type: {
        type: String,
        enum: ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bridal & Pre-Bridal', 'Groom Services', 'Bride', 'Groom'],
        required: true,
        unique: true,
        index: true,
      },
      businessName: { type: String, required: true, trim: true },
      name: { type: String, required: true, trim: true },
      subType: { type: String, default: '', trim: true },
      description: { type: String, default: '', trim: true },
      services: { type: [String], default: [] },
      bundledServices: { type: [String], default: [] },
      country: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      googleMapsLink: { type: String, default: '', trim: true },
      coverageAreas: { type: [coverageAreaSchema], default: [] },
      budgetRange: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
      },
      phone: { type: String, default: '', trim: true },
      website: { type: String, default: '', trim: true },
      availabilitySettings: { type: availabilitySettingsSchema, default: () => ({}) },
      sourceVendorIds: { type: [String], default: [] },
      selectedVendorMedia: { type: [selectedVendorMediaSchema], default: [] },
      media: { type: [mediaSchema], default: [] },
      isApproved: { type: Boolean, default: true },
      tier: {
        type: String,
        enum: ['Free', 'Plus'],
        default: 'Plus',
      },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  );

  return mongoose.models.ChoiceProfile || mongoose.model('ChoiceProfile', schema);
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
            reminderSettings: {
              type: mongoose.Schema.Types.Mixed,
              default: () => ({ ...defaultReminderSettings }),
            },
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
      plannerRevision: {
        type: Number,
        default: 0,
        min: 0,
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

function getReminderJobModel() {
  const schema = new mongoose.Schema(
    {
      ownerGoogleId: { type: String, required: true, index: true },
      recipientEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
      planId: { type: String, required: true, trim: true, index: true },
      type: { type: String, enum: ['event_day_before', 'event_hours_before', 'payment_three_days_before', 'payment_day_of'], required: true },
      entityId: { type: String, required: true, trim: true },
      title: { type: String, required: true, trim: true, maxlength: 140 },
      body: { type: String, required: true, trim: true, maxlength: 300 },
      clickPath: { type: String, default: '/', trim: true, maxlength: 300 },
      scheduledFor: { type: Date, required: true, index: true },
      status: { type: String, enum: ['pending', 'processing', 'sent', 'failed', 'canceled', 'skipped'], default: 'pending', index: true },
      dedupeKey: { type: String, required: true, trim: true, unique: true, index: true },
      meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
      processingStartedAt: { type: Date, default: null },
      processedAt: { type: Date, default: null },
      lastError: { type: String, default: '', trim: true, maxlength: 500 },
    },
    { timestamps: true, minimize: false }
  );

  return mongoose.models.ReminderJob || mongoose.model('ReminderJob', schema);
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
      resumeFileId: { type: String, required: true, trim: true },
      resumeFileName: { type: String, required: true, trim: true },
      resumeViewUrl: { type: String, default: '', trim: true },
      resumeDownloadUrl: { type: String, default: '', trim: true },
      resumeOriginalFileName: { type: String, default: '', trim: true, maxlength: 255 },
      resumeMimeType: { type: String, default: 'application/pdf', trim: true },
      resumeSize: { type: Number, default: 0 },
      source: { type: String, default: 'careers-page', trim: true },
      status: { type: String, enum: ['new', 'reviewing', 'shortlisted', 'rejected'], default: 'new' },
      rejectedAt: { type: Date, default: null },
      rejectedBy: { type: String, default: '', trim: true },
      rejectionEmailSubject: { type: String, default: '', trim: true, maxlength: 200 },
      rejectionEmailSentAt: { type: Date, default: null },
      resumeDeletedAt: { type: Date, default: null },
    },
    { timestamps: true }
  );

  return mongoose.models.CareerApplication || mongoose.model('CareerApplication', schema);
}

function getCareerEmailTemplateModel() {
  const schema = new mongoose.Schema(
    {
      templateKey: { type: String, required: true, unique: true, trim: true, maxlength: 80, index: true },
      subject: { type: String, required: true, trim: true, maxlength: 200 },
      body: { type: String, required: true, trim: true, maxlength: 12000 },
      updatedBy: { type: String, default: '', trim: true, maxlength: 160 },
    },
    { timestamps: true }
  );

  return mongoose.models.CareerEmailTemplate || mongoose.model('CareerEmailTemplate', schema);
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
        reminderSettings: { ...defaultReminderSettings },
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

function normalizeConfiguredEmail(value) {
  const normalized = normalizeEmail(value);
  return normalized.replace(/^['"]+|['"]+$/g, '');
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
  return normalizeConfiguredEmail(process.env.ADMIN_OWNER_EMAIL || 'nikhilmundhra28@gmail.com');
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

function sanitizeReminderSettings(value) {
  const source = isRecord(value) ? value : {};
  return {
    ...defaultReminderSettings,
    ...source,
    enabled: Boolean(source.enabled),
    eventDayBefore: source.eventDayBefore !== false,
    eventHoursBefore: source.eventHoursBefore !== false,
    paymentThreeDaysBefore: source.paymentThreeDaysBefore !== false,
    paymentDayOf: source.paymentDayOf !== false,
  };
}

function sanitizeNotificationPreferences(value) {
  const source = isRecord(value) ? value : {};
  return {
    ...defaultNotificationPreferences,
    ...source,
    browserPushEnabled: Boolean(source.browserPushEnabled),
    eventReminders: source.eventReminders !== false,
    paymentReminders: source.paymentReminders !== false,
  };
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
      reminderSettings: sanitizeReminderSettings(marriage.reminderSettings),
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
      reminderSettings: { ...defaultReminderSettings },
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
    reminderSettings: sanitizeReminderSettings(marriage.reminderSettings),
    collaborators: sanitizeCollaborators(marriage.collaborators, ownerEmail, ownerId),
  }));

  return planner;
}

function createSessionToken(user) {
  const jwtSecret = getConfiguredSecret('JWT_SECRET', 'change-me-before-production');
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
  try {
    return getConfiguredSecret('RSVP_TOKEN_SECRET', getConfiguredSecret('JWT_SECRET', 'change-me-before-production'));
  } catch (error) {
    if (error?.message === 'RSVP_TOKEN_SECRET must be configured in production.') {
      return getConfiguredSecret('JWT_SECRET', 'change-me-before-production');
    }
    throw error;
  }
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

function readSessionCookieToken(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);
  return typeof cookies[SESSION_COOKIE_NAME] === 'string' ? cookies[SESSION_COOKIE_NAME] : '';
}

function readAuthToken(req) {
  return readBearerToken(req) || readSessionCookieToken(req);
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
  const token = readAuthToken(req);
  if (!token) {
    return { status: 401, error: 'Authentication required.' };
  }

  try {
    const jwtSecret = getConfiguredSecret('JWT_SECRET', 'change-me-before-production');
    return { auth: jwt.verify(token, jwtSecret) };
  } catch (error) {
    if (error?.message === 'JWT_SECRET must be configured in production.') {
      return { status: 500, error: 'Server auth is not configured.' };
    }
    return { status: 401, error: 'Session expired. Please sign in again.' };
  }
}

module.exports = {
  applyRateLimit,
  assignWeddingWebsiteSlugs,
  buildWeddingWebsiteBaseSlug,
  buildEmptyPlanner,
  CSRF_COOKIE_NAME,
  clearSessionCookie,
  connectDb,
  createGuestRsvpToken,
  createSessionToken,
  ensureCsrfToken,
  generateCsrfToken,
  getCacheControlPolicy,
  getBillingReceiptModel,
  getCareerEmailTemplateModel,
  getChoiceProfileModel,
  getCollaboratorRoleForPlan,
  getPlannerModel,
  getCareerApplicationModel,
  getPlanFromPlanner,
  getBootstrapAdminEmail,
  getStaffAccess,
  getSubscriptionTier,
  getUserModel,
  getVendorModel,
  getPublicCache,
  getReminderJobModel,
  invalidatePublicCache,
  handlePreflight,
  hasPlanRole,
  hasStaffRole,
  normalizeEmail,
  normalizePlannerOwnership,
  normalizeRole,
  normalizeStaffRole,
  readCsrfHeaderToken,
  resetRateLimitBuckets,
  requireCsrfProtection,
  resetPublicCache,
  resolveStaffRole,
  sanitizeNotificationPreferences,
  sanitizePlanner,
  sanitizeReminderSettings,
  SESSION_COOKIE_NAME,
  setCacheControl,
  setSecurityHeaders,
  setCorsHeaders,
  setCsrfCookie,
  setSessionCookie,
  setPublicCache,
  verifyGuestRsvpToken,
  verifySession,
  withRequestMetrics,
};
