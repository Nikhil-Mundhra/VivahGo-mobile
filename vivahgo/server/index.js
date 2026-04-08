import 'dotenv/config';

import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { OAuth2Client } from 'google-auth-library';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Razorpay from 'razorpay';

import Planner from './models/Planner.js';
import User from './models/User.js';
import Vendor from './models/Vendor.js';
import CareerApplication from './models/CareerApplication.js';
import CareerEmailTemplate from './models/CareerEmailTemplate.js';
import BillingReceipt from './models/BillingReceipt.js';
import b2Helpers from '../../api/_lib/b2.js';
import careersAdminHelpers from '../../api/_lib/careers-admin.js';
import r2Helpers from '../../api/_lib/r2.js';
import {
  captureServerException,
  createFinalErrorMiddleware,
  flushServerSentry,
  sentryRequestContextMiddleware,
  setSentryRequestUser,
  setupSentryErrorHandlers,
} from './sentry.js';
import {
  flushServerLogger,
  logServerError,
  logServerInfo,
  requestLoggingMiddleware,
} from './logger.js';

const require = createRequire(import.meta.url);
const adminHandler = require('../../api/admin.js');
const plannerHandler = require('../../api/planner.js');
const vendorHandler = require('../../api/vendor.js');

const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const jwtSecret = process.env.JWT_SECRET || 'change-me-before-production';
const SESSION_COOKIE_NAME = 'vivahgo_session';
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_COOKIE_NAME = 'vivahgo_csrf';
const CSRF_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

const VENDOR_TYPES = ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bridal & Pre-Bridal', 'Groom Services'];
const BUNDLED_SERVICE_OPTIONS = VENDOR_TYPES.filter(type => type !== 'Honeymoon');
const LEGACY_VENDOR_TYPE_ALIASES = {
  Bride: 'Bridal & Pre-Bridal',
  Groom: 'Groom Services',
};
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
  'Bridal & Pre-Bridal': ['Bridal Jewellery', 'Bridal Makeup Artists', 'Bridal Lehenga', 'Mehndi Artists', 'Makeup Salon', 'Trousseau Packing'],
  'Groom Services': ['Sherwani', 'Salon'],
};
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 5000000;

const DEFAULT_SUBSCRIPTION_AMOUNT_MAP = {
  premium: { monthly: 200000, yearly: 1920000 },
  studio: { monthly: 500000, yearly: 4800000 },
};

const COUPON_SECRET_FILE_PATH = new URL('../../config/subscription-coupons.local.json', import.meta.url);
const CAREERS_FILE_PATH = new URL('../../config/careers.json', import.meta.url);
const { uploadResumeToB2, createB2PresignedGetUrl, createB2PresignedPutUrl, deleteB2Object } = b2Helpers;
const { getDefaultCareerRejectionTemplate, sanitizeCareerRejectionTemplate, sendCareerRejectionEmail } = careersAdminHelpers;
const { objectKeyMatchesScope } = r2Helpers;
const MAX_CAREER_RESUME_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_VERIFICATION_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_VERIFICATION_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VERIFICATION_DOCUMENT_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER'];
const CAREER_REJECTION_TEMPLATE_KEY = 'career-application-rejection';

function isObservabilitySmokeTestEnabled() {
  return String(process.env.ENABLE_OBSERVABILITY_SMOKE_TESTS || '').trim().toLowerCase() === 'true';
}

function captureServerExceptionForStatus(error, statusCode, context = {}) {
  if (!Number.isFinite(statusCode) || Number(statusCode) < 500) {
    return '';
  }

  return captureServerException(error, context);
}

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
  const rawCatalog = process.env.SUBSCRIPTION_COUPONS_JSON;
  if (rawCatalog) {
    try {
      return JSON.parse(rawCatalog);
    } catch {
      return [];
    }
  }

  try {
    return JSON.parse(fs.readFileSync(COUPON_SECRET_FILE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function readCareerCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CAREERS_FILE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function resolveCoupon(couponCode, plan) {
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
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    throw new Error('Coupon discount is invalid.');
  }

  const applicablePlans = Array.isArray(coupon.applicablePlans)
    ? coupon.applicablePlans.filter(entry => entry === 'premium' || entry === 'studio')
    : [];
  if (plan && applicablePlans.length > 0 && !applicablePlans.includes(plan)) {
    throw new Error('Coupon code is not valid for this plan.');
  }

  return {
    code: normalizedCode,
    expiresAt: coupon.expiresAt,
    discountPercent,
    applicablePlans,
  };
}

function applyCouponDiscount(amount, coupon) {
  if (!coupon) {
    return amount;
  }

  return Math.round(amount * (100 - coupon.discountPercent) / 100);
}

function sanitizeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeVerificationNotes(value) {
  return typeof value === 'string' ? value.trim().slice(0, 1000) : '';
}

function normalizeVendorTier(value) {
  return String(value || '').trim().toLowerCase() === 'plus' ? 'Plus' : 'Free';
}

function normalizeVerificationStatus(value, { hasDocuments = false } = {}) {
  if (value === 'approved' || value === 'rejected' || value === 'submitted') {
    return value;
  }
  return hasDocuments ? 'submitted' : 'not_submitted';
}

async function serializeVerificationDocuments(documents, ownerId) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const ownedDocuments = documents.filter(document => objectKeyMatchesScope(document?.key, 'vendor-verification', ownerId));

  return Promise.all(ownedDocuments.map(async document => {
    const key = typeof document?.key === 'string' ? document.key.replace(/^\/+/, '') : '';
    let accessUrl = '';

    if (key) {
      try {
        accessUrl = await createB2PresignedGetUrl(key);
      } catch {
        accessUrl = '';
      }
    }

    return {
      _id: String(document?._id || ''),
      key,
      filename: document?.filename || '',
      size: typeof document?.size === 'number' ? document.size : 0,
      contentType: document?.contentType || '',
      documentType: document?.documentType || 'OTHER',
      uploadedAt: document?.uploadedAt || null,
      accessUrl,
    };
  }));
}

async function serializeVendorWithVerification(vendor) {
  const plain = typeof vendor?.toObject === 'function' ? vendor.toObject() : vendor;
  const verificationDocuments = await serializeVerificationDocuments(plain?.verificationDocuments, plain?.googleId);
  return {
    ...plain,
    type: normalizeVendorType(plain?.type),
    bundledServices: Array.isArray(plain?.bundledServices) ? plain.bundledServices.map(normalizeVendorType) : [],
    availabilitySettings: normalizeAvailabilitySettings(plain?.availabilitySettings),
    verificationStatus: normalizeVerificationStatus(plain?.verificationStatus, {
      hasDocuments: verificationDocuments.length > 0,
    }),
    verificationNotes: sanitizeVerificationNotes(plain?.verificationNotes),
    verificationReviewedAt: plain?.verificationReviewedAt || null,
    verificationReviewedBy: plain?.verificationReviewedBy || '',
    verificationDocuments,
  };
}

async function serializeAdminVendorRecord(vendor) {
  const plain = typeof vendor?.toObject === 'function' ? vendor.toObject() : vendor;
  const serialized = await serializeVendorWithVerification(plain);
  const media = Array.isArray(serialized?.media) ? serialized.media : [];
  const verificationDocuments = Array.isArray(serialized?.verificationDocuments) ? serialized.verificationDocuments : [];

  return {
    id: String(serialized?._id || ''),
    googleId: serialized?.googleId || '',
    businessName: serialized?.businessName || '',
    type: serialized?.type || '',
    subType: serialized?.subType || '',
    description: serialized?.description || '',
    country: serialized?.country || '',
    state: serialized?.state || '',
    city: serialized?.city || '',
    phone: serialized?.phone || '',
    website: serialized?.website || '',
    googleMapsLink: serialized?.googleMapsLink || '',
    bundledServices: Array.isArray(serialized?.bundledServices) ? serialized.bundledServices : [],
    coverageAreas: Array.isArray(serialized?.coverageAreas) ? serialized.coverageAreas : [],
    budgetRange: serialized?.budgetRange || null,
    isApproved: Boolean(serialized?.isApproved),
    tier: normalizeVendorTier(serialized?.tier),
    verificationStatus: serialized?.verificationStatus || (verificationDocuments.length > 0 ? 'submitted' : 'not_submitted'),
    verificationNotes: serialized?.verificationNotes || '',
    verificationReviewedAt: serialized?.verificationReviewedAt || null,
    verificationReviewedBy: serialized?.verificationReviewedBy || '',
    verificationDocuments,
    verificationDocumentCount: verificationDocuments.length,
    mediaCount: media.length,
    media,
    createdAt: serialized?.createdAt || null,
    updatedAt: serialized?.updatedAt || null,
  };
}

function buildFallbackAdminVendorRecord(vendor = {}) {
  return {
    id: String(vendor?._id || ''),
    googleId: vendor?.googleId || '',
    businessName: vendor?.businessName || '',
    type: vendor?.type || '',
    subType: vendor?.subType || '',
    description: vendor?.description || '',
    country: vendor?.country || '',
    state: vendor?.state || '',
    city: vendor?.city || '',
    phone: vendor?.phone || '',
    website: vendor?.website || '',
    googleMapsLink: vendor?.googleMapsLink || '',
    bundledServices: Array.isArray(vendor?.bundledServices) ? vendor.bundledServices : [],
    coverageAreas: Array.isArray(vendor?.coverageAreas) ? vendor.coverageAreas : [],
    budgetRange: vendor?.budgetRange || null,
    isApproved: Boolean(vendor?.isApproved),
    tier: normalizeVendorTier(vendor?.tier),
    verificationStatus: vendor?.verificationStatus || 'not_submitted',
    verificationNotes: vendor?.verificationNotes || '',
    verificationReviewedAt: vendor?.verificationReviewedAt || null,
    verificationReviewedBy: vendor?.verificationReviewedBy || '',
    verificationDocuments: [],
    verificationDocumentCount: 0,
    mediaCount: 0,
    media: [],
    createdAt: vendor?.createdAt || null,
    updatedAt: vendor?.updatedAt || null,
  };
}

function isLikelyHttpUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeCareerResume(base64) {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Resume PDF is required.');
  }

  const cleaned = base64.includes(',') ? base64.split(',').pop() : base64;
  const buffer = Buffer.from(cleaned, 'base64');

  if (!buffer.length) {
    throw new Error('Resume PDF is empty.');
  }
  if (buffer.length > MAX_CAREER_RESUME_SIZE_BYTES) {
    throw new Error('Resume PDF exceeds the 2 MB size limit.');
  }
  if (buffer.slice(0, 4).toString() !== '%PDF') {
    throw new Error('Resume must be a valid PDF file.');
  }

  return buffer;
}

function serializeCareer(job = {}) {
  return {
    id: job.id || '',
    title: job.title || '',
    team: job.team || '',
    location: job.location || '',
    type: job.type || '',
    summary: job.summary || '',
    highlights: Array.isArray(job.highlights) ? job.highlights : [],
  };
}

function serializeCareerApplication(application = {}) {
  const plain = typeof application?.toObject === 'function' ? application.toObject() : application;
  return {
    id: String(plain._id || ''),
    fullName: plain.fullName || '',
    email: plain.email || '',
    phone: plain.phone || '',
    location: plain.location || '',
    linkedInUrl: plain.linkedInUrl || '',
    portfolioUrl: plain.portfolioUrl || '',
    coverLetter: plain.coverLetter || '',
    jobId: plain.jobId || '',
    jobTitle: plain.jobTitle || '',
    resumeFileId: plain.resumeFileId || '',
    resumeFileName: plain.resumeFileName || '',
    resumeViewUrl: plain.resumeViewUrl || '',
    resumeDownloadUrl: plain.resumeDownloadUrl || '',
    resumeOriginalFileName: plain.resumeOriginalFileName || '',
    resumeMimeType: plain.resumeMimeType || '',
    resumeSize: plain.resumeSize || 0,
    source: plain.source || '',
    status: plain.status || 'new',
    rejectedAt: plain.rejectedAt || null,
    rejectedBy: plain.rejectedBy || '',
    rejectionEmailSubject: plain.rejectionEmailSubject || '',
    rejectionEmailSentAt: plain.rejectionEmailSentAt || null,
    resumeDeletedAt: plain.resumeDeletedAt || null,
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  };
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

function normalizeConfiguredEmail(value) {
  const normalized = normalizeEmail(value);
  return normalized.replace(/^['"]+|['"]+$/g, '');
}

export function normalizeRole(value) {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return 'viewer';
}

export function normalizeStaffRole(value) {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value;
  }
  return 'none';
}

export function getBootstrapAdminEmail() {
  return normalizeConfiguredEmail(process.env.ADMIN_OWNER_EMAIL || 'nikhilmundhra28@gmail.com');
}

export function resolveStaffRole(email, currentRole = 'none') {
  if (normalizeEmail(email) === getBootstrapAdminEmail()) {
    return 'owner';
  }

  return normalizeStaffRole(currentRole);
}

export function hasStaffRole(role, minimumRole) {
  return (STAFF_ROLE_LEVEL[normalizeStaffRole(role)] || 0) >= (STAFF_ROLE_LEVEL[normalizeStaffRole(minimumRole)] || 0);
}

export function getStaffAccess(role) {
  const normalizedRole = normalizeStaffRole(role);
  return {
    role: normalizedRole,
    canViewAdmin: hasStaffRole(normalizedRole, 'viewer'),
    canManageVendors: hasStaffRole(normalizedRole, 'editor'),
    canManageStaff: hasStaffRole(normalizedRole, 'owner'),
  };
}

function normalizeAction(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeObjectId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveCareerRejectionTemplate(CareerEmailTemplateModel) {
  const defaults = getDefaultCareerRejectionTemplate();
  if (!CareerEmailTemplateModel || typeof CareerEmailTemplateModel.findOne !== 'function') {
    return defaults;
  }

  const existing = await resolveLeanDocument(CareerEmailTemplateModel.findOne({ templateKey: CAREER_REJECTION_TEMPLATE_KEY }));
  if (!existing) {
    return defaults;
  }

  return sanitizeCareerRejectionTemplate(existing);
}

async function saveCareerRejectionTemplate(CareerEmailTemplateModel, template, updatedBy) {
  const sanitized = sanitizeCareerRejectionTemplate(template);
  if (!CareerEmailTemplateModel || typeof CareerEmailTemplateModel.findOneAndUpdate !== 'function') {
    return sanitized;
  }

  const updated = await resolveLeanDocument(CareerEmailTemplateModel.findOneAndUpdate(
    { templateKey: CAREER_REJECTION_TEMPLATE_KEY },
    {
      $set: {
        templateKey: CAREER_REJECTION_TEMPLATE_KEY,
        subject: sanitized.subject,
        body: sanitized.body,
        updatedBy: updatedBy || '',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ));

  return sanitizeCareerRejectionTemplate(updated || sanitized);
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
        reminderSettings: { ...defaultReminderSettings },
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
    customTemplates: [],
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

async function _assignWeddingWebsiteSlugs(planner, ownerId = '', plannerModel = Planner) {
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
      reminderSettings: sanitizeReminderSettings(marriage.reminderSettings),
      template: marriage.template || 'blank',
      collaborators: sanitizeCollaborators(marriage.collaborators, ownerEmail, ownerId),
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
      staffRole: resolveStaffRole(user.email, user.staffRole),
    },
    secret,
    { expiresIn: '7d' }
  );
}

function getRsvpTokenSecret() {
  return process.env.RSVP_TOKEN_SECRET || jwtSecret;
}

const RSVP_TOKEN_VERSION = '1';
const RSVP_TOKEN_SIGNATURE_BYTES = 12;
const RSVP_TOKEN_DAY_MS = 24 * 60 * 60 * 1000;

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

export function getClientOrigins(clientOrigin = process.env.CLIENT_ORIGIN) {
  if (!clientOrigin) {
    return true;
  }

  return clientOrigin.split(',').map(origin => origin.trim());
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

function isSecureRequest(req) {
  const forwardedProto = typeof req?.headers?.['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim().toLowerCase()
    : '';

  return forwardedProto === 'https' || Boolean(req?.secure || req?.socket?.encrypted);
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

  const protocol = isSecureRequest(req) ? 'https' : 'http';
  return `${protocol}://${host}`;
}

function getCookieSameSiteMode(req) {
  if (!isSecureRequest(req)) {
    return 'lax';
  }

  const requestOrigin = readRequestOriginHeader(req);
  const responseOrigin = getRequestOrigin(req);
  if (!requestOrigin || !responseOrigin) {
    return 'lax';
  }

  try {
    if (new URL(requestOrigin).origin !== new URL(responseOrigin).origin) {
      return 'none';
    }
  } catch {
    return 'lax';
  }

  return 'lax';
}

function readSessionCookieToken(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);
  return typeof cookies[SESSION_COOKIE_NAME] === 'string' ? cookies[SESSION_COOKIE_NAME] : '';
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

function setSessionCookie(req, res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: getCookieSameSiteMode(req),
    secure: isSecureRequest(req),
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function setCsrfCookie(req, res, token) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: getCookieSameSiteMode(req),
    secure: isSecureRequest(req),
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function ensureCsrfToken(req, res, options = {}) {
  const existingToken = readCsrfCookieToken(req);
  if (existingToken) {
    if (options.refresh) {
      setCsrfCookie(req, res, existingToken);
    }
    return existingToken;
  }

  const nextToken = crypto.randomBytes(32).toString('hex');
  setCsrfCookie(req, res, nextToken);
  return nextToken;
}

function clearSessionCookie(req, res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: getCookieSameSiteMode(req),
    secure: isSecureRequest(req),
    path: '/',
  });
}

export function authMiddleware(req, res, next, secret = jwtSecret) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : readSessionCookieToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.auth = jwt.verify(token, secret);
    setSentryRequestUser(req.auth);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(String(method || '').toUpperCase());
}

function hasBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ');
}

export function csrfProtectionMiddleware(req, res, next) {
  if (
    isSafeMethod(req.method)
    || req.path === '/api/subscription/webhook'
    || hasBearerToken(req)
  ) {
    return next();
  }

  const cookieToken = readCsrfCookieToken(req);
  const headerToken = readCsrfHeaderToken(req);

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'CSRF token required.', code: 'CSRF_REQUIRED' });
  }

  if (cookieToken.length !== headerToken.length) {
    return res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      return res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
    }
  } catch {
    return res.status(403).json({ error: 'Invalid CSRF token.', code: 'CSRF_INVALID' });
  }

  return next();
}

async function resolveLeanDocument(result) {
  if (!result) {
    return null;
  }
  if (typeof result.lean === 'function') {
    return result.lean();
  }
  if (typeof result.toObject === 'function') {
    return result.toObject();
  }
  return result;
}

function sanitizeStaffUser(user = {}) {
  const staffRole = resolveStaffRole(user.email, user.staffRole);
  return {
    id: String(user._id || user.googleId || ''),
    googleId: user.googleId || '',
    email: normalizeEmail(user.email || ''),
    name: user.name || '',
    picture: user.picture || '',
    staffRole,
    staffAddedBy: user.staffAddedBy || '',
    staffGrantedAt: user.staffGrantedAt || null,
    isBootstrapOwner: normalizeEmail(user.email || '') === getBootstrapAdminEmail(),
  };
}

async function resolveAdminSession(UserModel, auth, minimumRole = 'viewer') {
  const user = await resolveLeanDocument(UserModel.findOne({ googleId: auth.sub }));

  if (!user) {
    return { status: 401, error: 'Account not found.' };
  }

  const staffRole = resolveStaffRole(user.email || auth.email, user.staffRole);
  if (staffRole !== user.staffRole && typeof UserModel.updateOne === 'function') {
    await UserModel.updateOne(
      { googleId: user.googleId },
      {
        $set: {
          staffRole,
          ...(staffRole === 'owner' ? { staffGrantedAt: user.staffGrantedAt || new Date() } : {}),
        },
      }
    );
  }

  if (!hasStaffRole(staffRole, minimumRole)) {
    return { status: 403, error: 'Staff access required.' };
  }

  return {
    auth,
    User: UserModel,
    user: {
      ...user,
      staffRole,
    },
    access: getStaffAccess(staffRole),
  };
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

function getPublicWeddingData(planner, publicPlan) {
  const wedding = {
    ...planner.wedding,
    bride: publicPlan.bride || planner.wedding?.bride || '',
    groom: publicPlan.groom || planner.wedding?.groom || '',
    date: publicPlan.date || planner.wedding?.date || '',
    venue: publicPlan.venue || planner.wedding?.venue || '',
    guests: publicPlan.guests || planner.wedding?.guests || '',
    budget: publicPlan.budget || planner.wedding?.budget || '',
  };

  return {
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
  };
}

function getGuestDisplayName(guest) {
  const fromParts = [guest?.title, guest?.firstName, guest?.middleName, guest?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fromParts || String(guest?.name || '').trim() || 'Guest';
}

function resolveAttendingGuestCount(guest, requestedCount, nextRsvp) {
  const invitedGuestCount = Math.max(1, Number(guest?.guestCount) || 1);
  if (nextRsvp !== 'yes') {
    return 0;
  }

  const parsed = Number(requestedCount);
  if (!Number.isFinite(parsed)) {
    return Math.min(invitedGuestCount, Math.max(1, Number(guest?.attendingGuestCount) || invitedGuestCount));
  }

  return Math.min(invitedGuestCount, Math.max(1, Math.round(parsed)));
}

function normalizeGuestGroupMembers(groupMembers, count) {
  const maxCount = Math.max(0, Math.trunc(Number(count) || 0));
  if (!Array.isArray(groupMembers) || maxCount === 0) {
    return [];
  }

  return groupMembers
    .map((member) => String(member || '').trim())
    .filter(Boolean)
    .slice(0, maxCount);
}

function buildGuestRsvpLink(req, token) {
  const requestOrigin = typeof req.headers?.origin === 'string' ? req.headers.origin.trim().replace(/\/$/, '') : '';
  const forwardedProto = typeof req.headers?.['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'].split(',')[0].trim() : '';
  const forwardedHost = typeof req.headers?.['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'].split(',')[0].trim() : '';
  const host = forwardedHost || req.headers?.host || '';

  if (requestOrigin) {
    return `${requestOrigin}/rsvp/${encodeURIComponent(token)}`;
  }

  if (forwardedProto && host) {
    return `${forwardedProto}://${host}/rsvp/${encodeURIComponent(token)}`;
  }

  return `/rsvp/${encodeURIComponent(token)}`;
}

function normalizeVendorType(type) {
  if (typeof type !== 'string') {
    return '';
  }

  const trimmed = type.trim();
  return LEGACY_VENDOR_TYPE_ALIASES[trimmed] || trimmed;
}

function normalizeVendorSubtype(type, subType) {
  const normalizedType = normalizeVendorType(type);
  const allowedSubtypes = VENDOR_SUBTYPE_OPTIONS[normalizedType] || [];
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

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeCapacityNumber(value, { min = 0, fieldName = 'capacity' } = {}) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (number < min || number > 99) {
    throw new Error(`${fieldName} must be between ${min} and 99.`);
  }

  return number;
}

function normalizeAvailabilitySettings(value) {
  if (!value || typeof value !== 'object') {
    return {
      hasDefaultCapacity: true,
      defaultMaxCapacity: 1,
      dateOverrides: [],
    };
  }

  const hasDefaultCapacity = value.hasDefaultCapacity !== false;
  const defaultMaxCapacity = hasDefaultCapacity
    ? normalizeCapacityNumber(
      value.defaultMaxCapacity ?? 1,
      { min: 1, fieldName: 'availabilitySettings.defaultMaxCapacity' }
    )
    : 0;

  if (value.dateOverrides != null && !Array.isArray(value.dateOverrides)) {
    throw new Error('availabilitySettings.dateOverrides must be an array.');
  }

  const seenDates = new Set();
  const dateOverrides = (Array.isArray(value.dateOverrides) ? value.dateOverrides : [])
    .map((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('availabilitySettings.dateOverrides must contain objects.');
      }

      const date = typeof item.date === 'string' ? item.date.trim() : '';
      if (!isValidDateKey(date)) {
        throw new Error('availabilitySettings.dateOverrides[].date must use YYYY-MM-DD.');
      }
      if (seenDates.has(date)) {
        throw new Error('availabilitySettings.dateOverrides must not contain duplicate dates.');
      }
      seenDates.add(date);

      return {
        date,
        maxCapacity: normalizeCapacityNumber(
          item.maxCapacity,
          { min: 0, fieldName: 'availabilitySettings.dateOverrides[].maxCapacity' }
        ),
        rawBookingsCount: item.bookingsCount ?? 0,
      };
    })
    .map((item) => {
      const bookingsCount = normalizeCapacityNumber(
        item && typeof item === 'object' ? item.rawBookingsCount ?? 0 : 0,
        { min: 0, fieldName: 'availabilitySettings.dateOverrides[].bookingsCount' }
      );

      return {
        date: item.date,
        maxCapacity: item.maxCapacity,
        bookingsCount: item.maxCapacity > 0 ? Math.min(bookingsCount, item.maxCapacity) : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    hasDefaultCapacity,
    defaultMaxCapacity,
    dateOverrides,
  };
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
    VendorModel = Vendor,
    CareerApplicationModel = CareerApplication,
    CareerEmailTemplateModel = CareerEmailTemplate,
    BillingReceiptModel = BillingReceipt,
    uploadCareerResume = uploadResumeToB2,
    deleteCareerResume = deleteB2Object,
    sendCareerRejectionEmailFn = sendCareerRejectionEmail,
  } = options;

  const oauthClient =
    injectedOauthClient !== undefined
      ? injectedOauthClient
      : injectedGoogleClientId
        ? new OAuth2Client(injectedGoogleClientId)
        : null;

  const app = express();
  const originalListen = app.listen.bind(app);

  app.listen = (...args) => {
    if (args.length === 0) {
      return originalListen(0, '127.0.0.1');
    }
    if (typeof args[0] === 'number' && args.length === 1) {
      return originalListen(args[0], '127.0.0.1');
    }
    if (typeof args[0] === 'number' && typeof args[1] === 'function') {
      return originalListen(args[0], '127.0.0.1', args[1]);
    }
    return originalListen(...args);
  };

  app.use(
    cors({
      origin: getClientOrigins(),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(requestLoggingMiddleware);
  app.use(sentryRequestContextMiddleware);
  app.use(csrfProtectionMiddleware);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/observability/smoke-error', (req, res) => {
    if (!isObservabilitySmokeTestEnabled()) {
      return res.status(404).json({ error: 'Not found.' });
    }

    const source = sanitizeText(req.body?.source, 120) || 'unknown';
    const routePath = sanitizeText(req.body?.routePath, 300);
    const bodyRoute = sanitizeText(req.body?.bodyRoute, 40);
    const error = new Error(`Observability smoke test triggered (${source}).`);

    error.name = 'ObservabilitySmokeTestError';

    const eventId = captureServerException(error, {
      tags: {
        smoke_test: 'true',
        'smoke_test.target': 'backend',
        'smoke_test.source': source,
      },
      extra: {
        source,
        routePath,
        bodyRoute,
        requestId: req.requestId || '',
      },
    });

    logServerError('Observability smoke test triggered', {
      error,
      req,
      fields: {
        smoke_test: true,
        smoke_test_source: source,
        smoke_test_route_path: routePath || undefined,
        smoke_test_body_route: bodyRoute || undefined,
        sentry_event_id: eventId || undefined,
      },
      root: {
        smoke_test: true,
        smoke_test_source: source,
      },
    });

    res.set('Cache-Control', 'no-store');
    return res.status(500).json({
      error: 'Observability smoke test triggered.',
      code: 'OBSERVABILITY_SMOKE_TEST',
      eventId: eventId || '',
      requestId: req.requestId || '',
    });
  });

  app.get('/api/auth/csrf', (req, res) => {
    const csrfToken = ensureCsrfToken(req, res, { refresh: true });
    res.set('Cache-Control', 'no-store');
    return res.json({ csrfToken });
  });

  app.get('/api/careers', (_req, res) => {
    return res.json({
      careers: readCareerCatalog().map(serializeCareer),
      limits: {
        resumeMimeType: 'application/pdf',
        resumeMaxSizeBytes: MAX_CAREER_RESUME_SIZE_BYTES,
      },
    });
  });

  app.post('/api/careers', async (req, res) => {
    const body = req.body || {};
    const careers = readCareerCatalog();
    const fullName = sanitizeText(body.fullName, 120);
    const email = normalizeEmail(body.email);
    const phone = sanitizeText(body.phone, 40);
    const location = sanitizeText(body.location, 120);
    const linkedInUrl = sanitizeText(body.linkedInUrl, 300);
    const portfolioUrl = sanitizeText(body.portfolioUrl, 300);
    const coverLetter = sanitizeText(body.coverLetter, 4000);
    const jobId = sanitizeText(body.jobId, 120);
    const resumeFilename = sanitizeText(body.resumeFilename, 255) || 'resume.pdf';
    const resumeMimeType = sanitizeText(body.resumeMimeType, 80) || 'application/pdf';

    if (!fullName) {
      return res.status(400).json({ error: 'fullName is required.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required.' });
    }
    if (resumeMimeType !== 'application/pdf') {
      return res.status(400).json({ error: 'Resume must be uploaded as a PDF.' });
    }
    if (!isLikelyHttpUrl(linkedInUrl) || !isLikelyHttpUrl(portfolioUrl)) {
      return res.status(400).json({ error: 'Profile links must start with http:// or https://.' });
    }

    const job = careers.find((item) => item.id === jobId);
    if (!job) {
      return res.status(400).json({ error: 'Selected role is not available.' });
    }

    let resumeBuffer;
    try {
      resumeBuffer = decodeCareerResume(body.resumeBase64);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    try {
      const uploadedResume = await uploadCareerResume({
        buffer: resumeBuffer,
        filename: resumeFilename,
        fullName,
        jobId,
      });

      const created = await CareerApplicationModel.create({
        fullName,
        email,
        phone,
        location,
        linkedInUrl,
        portfolioUrl,
        coverLetter,
        jobId: job.id,
        jobTitle: job.title,
        resumeFileId: uploadedResume.id,
        resumeFileName: uploadedResume.name,
        resumeViewUrl: uploadedResume.viewUrl,
        resumeDownloadUrl: uploadedResume.downloadUrl,
        resumeOriginalFileName: resumeFilename,
        resumeMimeType,
        resumeSize: resumeBuffer.length,
        source: 'careers-page',
      });

      return res.status(201).json({
        ok: true,
        application: serializeCareerApplication(created),
      });
    } catch (error) {
      logServerError('POST /api/careers failed', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/careers' } });
      return res.status(500).json({ error: error.message || 'Could not submit application.' });
    }
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
      if (!(payload.email_verified === true || payload.email_verified === 'true')) {
        return res.status(400).json({ error: 'Google account email must be verified.' });
      }

      const normalizedEmail = normalizeEmail(payload.email);
      const existingUser = typeof UserModel.findOne === 'function'
        ? await resolveLeanDocument(UserModel.findOne({ googleId: payload.sub }))
        : null;
      const staffRole = resolveStaffRole(normalizedEmail, normalizeStaffRole(existingUser?.staffRole));

      const user = await UserModel.findOneAndUpdate(
        { googleId: payload.sub },
        {
          $set: {
            googleId: payload.sub,
            email: normalizedEmail,
            name: payload.name,
            picture: payload.picture || '',
            staffRole,
            staffGrantedAt: staffRole === 'owner' ? existingUser?.staffGrantedAt || new Date() : existingUser?.staffGrantedAt || null,
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

      ensureCsrfToken(req, res, { refresh: true });
      setSessionCookie(req, res, createSessionToken(user, injectedJwtSecret));

      return res.json({
        user: {
          id: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture,
          staffRole: resolveStaffRole(user.email, user.staffRole),
        },
        planner: sanitizePlanner(planner.toObject(), { ownerEmail: user.email, ownerId: user.googleId }),
        plannerOwnerId: user.googleId,
      });
    } catch (error) {
      logServerError('Google auth failed', { error, req });
      return res.status(401).json({ error: 'Google sign-in could not be verified.' });
    }
  });

  app.post('/api/auth/clerk', async (req, res) => {
    const clerkJwtToken = req.body?.token;
    const providedUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    const providedEmail = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const providedPicture = typeof req.body?.picture === 'string' ? req.body.picture.trim() : '';

    if (!clerkJwtToken) {
      return res.status(400).json({ error: 'Missing Clerk token.' });
    }

    try {
      const decodedToken = jwt.decode(clerkJwtToken, { complete: true });
      const sessionClaims = decodedToken?.payload || {};
      const clerkUserId = providedUserId || sessionClaims.sid || sessionClaims.sub;
      const clerkEmail = providedEmail || sessionClaims.email || '';

      if (!clerkEmail) {
        return res.status(400).json({ error: 'Clerk token does not contain email.' });
      }

      const normalizedEmail = normalizeEmail(clerkEmail);
      const clerkUniqueKey = `clerk:${clerkUserId || normalizedEmail}`;
      const derivedName = providedName || normalizedEmail.split('@')[0];

      let user = await resolveLeanDocument(UserModel.findOne({ email: normalizedEmail, googleId: { $regex: '^clerk:' } }));
      if (!user) {
        const existingByKey = await UserModel.findOneAndUpdate(
          { googleId: clerkUniqueKey },
          {
            $setOnInsert: {
              googleId: clerkUniqueKey,
              email: normalizedEmail,
              name: derivedName,
              picture: providedPicture || '',
              staffRole: resolveStaffRole(normalizedEmail),
              staffGrantedAt: new Date(),
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        );
        user = existingByKey?.toObject ? existingByKey.toObject() : existingByKey;
      }

      const planner = await PlannerModel.findOneAndUpdate(
        { googleId: clerkUniqueKey },
        {
          $setOnInsert: {
            googleId: clerkUniqueKey,
            ...buildEmptyPlanner({ ownerEmail: normalizedEmail, ownerId: clerkUniqueKey }),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      ensureCsrfToken(req, res, { refresh: true });
      setSessionCookie(req, res, createSessionToken(user, injectedJwtSecret));

      return res.json({
        user: {
          id: user.googleId,
          email: user.email,
          name: user.name,
          picture: user.picture || '',
          staffRole: resolveStaffRole(user.email, user.staffRole),
        },
        planner: sanitizePlanner(planner.toObject(), { ownerEmail: user.email, ownerId: user.googleId }),
        plannerOwnerId: user.googleId,
      });
    } catch (error) {
      logServerError('Clerk auth failed', { error, req });
      return res.status(401).json({ error: 'Clerk sign-in could not be verified.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    return res.json({ ok: true });
  });

  app.delete('/api/auth/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const normalizedEmail = normalizeEmail(req.auth.email || '');
      const deletionTasks = [];

      if (typeof UserModel?.deleteOne === 'function') {
        deletionTasks.push(UserModel.deleteOne({ googleId: req.auth.sub }));
      }

      if (typeof PlannerModel?.deleteOne === 'function') {
        deletionTasks.push(PlannerModel.deleteOne({ googleId: req.auth.sub }));
      }

      if (normalizedEmail && typeof PlannerModel?.updateMany === 'function') {
        deletionTasks.push(
          PlannerModel.updateMany(
            {
              googleId: { $ne: req.auth.sub },
              'marriages.collaborators.email': normalizedEmail,
            },
            {
              $pull: {
                'marriages.$[].collaborators': { email: normalizedEmail },
              },
            }
          )
        );
      }

      if (typeof VendorModel?.deleteOne === 'function') {
        deletionTasks.push(VendorModel.deleteOne({ googleId: req.auth.sub }));
      }

      if (typeof BillingReceiptModel?.deleteMany === 'function') {
        deletionTasks.push(BillingReceiptModel.deleteMany({ googleId: req.auth.sub }));
      }

      await Promise.all(deletionTasks);
      clearSessionCookie(req, res);
      return res.json({ ok: true });
    } catch (err) {
      logServerError('DELETE /api/auth/me failed', { error: err, req });
      captureServerException(err, { tags: { route: 'DELETE /api/auth/me' } });
      return res.status(500).json({ error: 'Failed to delete account. Please try again.' });
    }
  });

  app.get('/api/vendor/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const vendor = await VendorModel.findOne({ googleId: req.auth.sub }).lean();
      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }
      return res.json({ vendor: await serializeVendorWithVerification(vendor) });
    } catch (error) {
      logServerError('Failed to load vendor profile', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/vendor/me' } });
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
        googleMapsLink,
        phone,
        website,
        coverageAreas,
        bundledServices,
        budgetRange,
        availabilitySettings,
      } = req.body || {};

      if (!businessName || typeof businessName !== 'string' || !businessName.trim()) {
        return res.status(400).json({ error: 'businessName is required.' });
      }
      const normalizedType = normalizeVendorType(type);
      if (!VENDOR_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      let normalizedSubType = '';
      let normalizedBudgetRange;
      let normalizedAvailabilitySettings;
      try {
        normalizedSubType = normalizeVendorSubtype(normalizedType, subType);
        normalizedBudgetRange = normalizeBudgetRange(budgetRange || {});
        normalizedAvailabilitySettings = normalizeAvailabilitySettings(availabilitySettings);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const existing = await VendorModel.findOne({ googleId: req.auth.sub }).lean();
      if (existing) {
        return res.status(409).json({ error: 'Vendor profile already exists. Use PATCH to update.' });
      }

      const vendor = await VendorModel.create({
        googleId: req.auth.sub,
        businessName: businessName.trim(),
        type: normalizedType,
        subType: normalizedSubType,
        bundledServices: normalizeBundledServices(normalizedType, bundledServices),
        country: (country || '').trim(),
        state: (state || '').trim(),
        description: (description || '').trim(),
        city: (city || '').trim(),
        googleMapsLink: (googleMapsLink || '').trim(),
        coverageAreas: normalizeCoverageAreas(coverageAreas),
        phone: (phone || '').trim(),
        website: (website || '').trim(),
        budgetRange: normalizedBudgetRange,
        availabilitySettings: normalizedAvailabilitySettings,
      });

      await UserModel.findOneAndUpdate(
        { googleId: req.auth.sub },
        { $set: { isVendor: true, vendorId: vendor._id } }
      );

      return res.status(201).json({ vendor: await serializeVendorWithVerification(vendor) });
    } catch (error) {
      logServerError('Vendor registration failed', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/vendor/me' } });
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.patch('/api/vendor/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const body = req.body || {};
      const updates = {};
      const existingVendor = await VendorModel.findOne({ googleId: req.auth.sub }).lean();

      if (!existingVendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const allowedUpdateFields = ['businessName', 'type', 'subType', 'description', 'country', 'state', 'city', 'googleMapsLink', 'phone', 'website'];
      for (const field of allowedUpdateFields) {
        if (typeof body[field] === 'string') {
          updates[field] = body[field].trim();
        }
      }

      if (Array.isArray(body.coverageAreas)) {
        updates.coverageAreas = normalizeCoverageAreas(body.coverageAreas);
      }

      if (typeof updates.type === 'string') {
        updates.type = normalizeVendorType(updates.type);
      }

      if (Array.isArray(body.bundledServices)) {
        updates.bundledServices = normalizeBundledServices(updates.type || normalizeVendorType(existingVendor.type), body.bundledServices);
      }

      if (body.budgetRange && typeof body.budgetRange === 'object') {
        try {
          updates.budgetRange = normalizeBudgetRange(body.budgetRange);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      if (body.availabilitySettings && typeof body.availabilitySettings === 'object') {
        try {
          updates.availabilitySettings = normalizeAvailabilitySettings(body.availabilitySettings);
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }

      if (updates.type && !VENDOR_TYPES.includes(updates.type)) {
        return res.status(400).json({ error: `type must be one of: ${VENDOR_TYPES.join(', ')}.` });
      }

      try {
        const resolvedType = updates.type || normalizeVendorType(existingVendor.type);
        if ('subType' in updates || updates.type) {
          updates.subType = normalizeVendorSubtype(resolvedType, updates.subType ?? body.subType ?? '');
        }
        if (updates.type && !('bundledServices' in updates)) {
          updates.bundledServices = normalizeBundledServices(resolvedType, existingVendor.bundledServices);
        }
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const vendor = await VendorModel.findOneAndUpdate(
        { googleId: req.auth.sub },
        { $set: updates },
        { new: true }
      );

      return res.json({ vendor: await serializeVendorWithVerification(vendor) });
    } catch (error) {
      logServerError('Vendor profile update failed', { error, req });
      captureServerException(error, { tags: { route: 'PATCH /api/vendor/me' } });
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.post('/api/media/verification-presigned-url', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const { filename, contentType, size } = req.body || {};
      const contentLength = Number(size);

      if (!filename || typeof filename !== 'string' || !contentType || typeof contentType !== 'string') {
        return res.status(400).json({ error: 'filename and contentType are required.' });
      }
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
        return res.status(400).json({ error: 'size must be a positive number.' });
      }
      if (!ALLOWED_VERIFICATION_CONTENT_TYPES.has(contentType)) {
        return res.status(400).json({ error: 'Only PDF, JPG, PNG, and WebP files are allowed.' });
      }
      if (contentLength > MAX_VERIFICATION_FILE_SIZE_BYTES) {
        return res.status(400).json({ error: 'File exceeds the 10 MB size limit.' });
      }

      const rawExt = filename.includes('.') ? filename.split('.').pop() : '';
      const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      const key = `vendor-verification/${req.auth.sub}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
      const uploadUrl = await createB2PresignedPutUrl(key, contentType, {
        contentLength,
      });

      return res.json({ uploadUrl, key });
    } catch (error) {
      logServerError('Verification presigned URL generation failed', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/media/verification-presigned-url' } });
      return res.status(500).json({ error: 'Could not generate verification upload URL.' });
    }
  });

  app.post('/api/vendor/verification', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const vendor = await VendorModel.findOne({ googleId: req.auth.sub });
      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const { key, filename, size, contentType, documentType } = req.body || {};
      const normalizedKey = typeof key === 'string' ? key.replace(/^\/+/, '') : '';

      if (!normalizedKey) {
        return res.status(400).json({ error: 'A valid verification document key is required.' });
      }
      if (!objectKeyMatchesScope(normalizedKey, 'vendor-verification', req.auth.sub)) {
        return res.status(400).json({ error: 'Verification document key must belong to your account.' });
      }
      if (!ALLOWED_VERIFICATION_DOCUMENT_TYPES.includes(documentType)) {
        return res.status(400).json({ error: `documentType must be one of: ${ALLOWED_VERIFICATION_DOCUMENT_TYPES.join(', ')}.` });
      }

      vendor.verificationDocuments.push({
        key: normalizedKey,
        filename: typeof filename === 'string' ? filename.slice(0, 255) : '',
        size: typeof size === 'number' && size >= 0 ? size : 0,
        contentType: typeof contentType === 'string' ? contentType.slice(0, 120) : '',
        documentType,
        uploadedAt: new Date(),
      });
      vendor.verificationStatus = 'submitted';
      vendor.verificationReviewedAt = null;
      vendor.verificationReviewedBy = '';

      await vendor.save();
      return res.status(201).json({ vendor: await serializeVendorWithVerification(vendor) });
    } catch (error) {
      logServerError('Vendor verification upload failed', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/vendor/verification' } });
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.delete('/api/vendor/verification', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const vendor = await VendorModel.findOne({ googleId: req.auth.sub });
      if (!vendor) {
        return res.status(404).json({ error: 'No vendor profile found.' });
      }

      const documentId = String(req.body?.documentId || '').trim();
      if (!documentId) {
        return res.status(400).json({ error: 'documentId is required.' });
      }

      const target = vendor.verificationDocuments.id(documentId);
      if (!target) {
        return res.status(404).json({ error: 'Verification document not found.' });
      }

      const targetKey = typeof target?.key === 'string' ? target.key.replace(/^\/+/, '') : '';
      target.deleteOne();
      if (vendor.verificationDocuments.length === 0) {
        vendor.verificationStatus = 'not_submitted';
        vendor.verificationNotes = '';
        vendor.verificationReviewedAt = null;
        vendor.verificationReviewedBy = '';
      } else if (vendor.verificationStatus === 'approved') {
        vendor.verificationStatus = 'submitted';
      }

      await vendor.save();
      if (targetKey) {
        try {
          await deleteB2Object(targetKey);
        } catch (error) {
          logServerError('Vendor verification document delete failed', { error, req });
          captureServerException(error, { tags: { route: 'DELETE /api/vendor/verification.document' } });
        }
      }
      return res.json({ vendor: await serializeVendorWithVerification(vendor) });
    } catch (error) {
      logServerError('Vendor verification delete failed', { error, req });
      captureServerException(error, { tags: { route: 'DELETE /api/vendor/verification' } });
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });

  app.get('/api/vendors', async (req, res) => {
    return vendorHandler.handleVendorList(req, res);
  });

  app.get('/api/admin/me', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      return res.json({
        user: sanitizeStaffUser(session.user),
        access: session.access,
      });
    } catch (error) {
      logServerError('Admin session lookup failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/admin/me' } });
      return res.status(500).json({ error: 'Could not load admin access.' });
    }
  });

  app.get('/api/admin/vendors', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const vendors = await VendorModel.find({})
        .select('-__v')
        .sort({ isApproved: 1, updatedAt: -1, createdAt: -1 })
        .lean();

      const serializedVendors = await Promise.all(vendors.map(async vendor => {
        try {
          return await serializeAdminVendorRecord(vendor);
        } catch (error) {
          logServerError('Admin vendor serialization failed', {
            error,
            req,
            fields: {
              vendorId: String(vendor?._id || ''),
              vendorGoogleId: vendor?.googleId || '',
            },
          });
          captureServerException(error, { tags: { route: 'GET /api/admin/vendors.serialize' } });
          return buildFallbackAdminVendorRecord(vendor);
        }
      }));

      return res.json({ vendors: serializedVendors });
    } catch (error) {
      logServerError('Admin vendor management failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/admin/vendors' } });
      return res.status(500).json({ error: 'Could not manage vendors.' });
    }
  });

  app.patch('/api/admin/vendors', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const vendorId = String(req.body?.vendorId || '').trim();
      const vendorGoogleId = String(req.body?.vendorGoogleId || '').trim();
      const isApproved = req.body?.isApproved;
      const verificationStatus = typeof req.body?.verificationStatus === 'string' ? req.body.verificationStatus.trim() : '';
      const verificationNotes = typeof req.body?.verificationNotes === 'string' ? req.body.verificationNotes.trim().slice(0, 1000) : null;
      const tier = typeof req.body?.tier === 'string' ? normalizeVendorTier(req.body.tier) : '';

      if (!vendorId && !vendorGoogleId) {
        return res.status(400).json({ error: 'vendorId or vendorGoogleId is required.' });
      }
      if (typeof isApproved !== 'boolean' && !verificationStatus && verificationNotes === null && !tier) {
        return res.status(400).json({ error: 'Provide isApproved, verificationStatus, verificationNotes, or tier.' });
      }
      if (verificationStatus && !['not_submitted', 'submitted', 'approved', 'rejected'].includes(verificationStatus)) {
        return res.status(400).json({ error: 'verificationStatus is invalid.' });
      }

      const updates = {};
      if (typeof isApproved === 'boolean') {
        updates.isApproved = isApproved;
      }
      if (verificationStatus) {
        updates.verificationStatus = verificationStatus;
        updates.verificationReviewedAt = new Date();
        updates.verificationReviewedBy = session.user.email || req.auth.email || req.auth.sub || '';
      }
      if (verificationNotes !== null) {
        updates.verificationNotes = verificationNotes;
      }
      if (tier) {
        updates.tier = tier;
      }

      const lookupFilters = [];
      if (vendorId && mongoose.isValidObjectId(vendorId)) {
        lookupFilters.push({ _id: vendorId });
      }
      if (vendorGoogleId || (vendorId && !mongoose.isValidObjectId(vendorId))) {
        lookupFilters.push({ googleId: vendorGoogleId || vendorId });
      }

      let vendor = null;
      for (const filter of lookupFilters) {
        vendor = await VendorModel.findOneAndUpdate(
          filter,
          { $set: updates },
          { new: true }
        ).lean();

        if (vendor) {
          break;
        }
      }

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found.' });
      }

      return res.json({
        vendor: await serializeAdminVendorRecord(vendor),
      });
    } catch (error) {
      logServerError('Admin vendor management failed', { error, req });
      captureServerException(error, { tags: { route: 'PATCH /api/admin/vendors' } });
      return res.status(500).json({ error: 'Could not manage vendors.' });
    }
  });

  app.get('/api/admin/choice', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    return adminHandler.handleAdminChoice(req, res);
  });

  app.post('/api/admin/choice-media-upload', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    return adminHandler.handleAdminChoiceMediaUpload(req, res);
  });

  app.patch('/api/admin/choice', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    return adminHandler.handleAdminChoice(req, res);
  });

  app.get('/api/admin/staff', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const staff = await UserModel.find({ staffRole: { $in: ['owner', 'editor', 'viewer'] } })
        .select('-__v')
        .sort({ staffRole: 1, email: 1 })
        .lean();

      return res.json({ staff: staff.map(sanitizeStaffUser) });
    } catch (error) {
      logServerError('Admin staff fetch failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/admin/staff' } });
      return res.status(500).json({ error: 'Could not manage staff.' });
    }
  });

  app.post('/api/admin/staff', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const email = normalizeEmail(req.body?.email);
      const staffRole = normalizeStaffRole(req.body?.staffRole);

      if (!email) {
        return res.status(400).json({ error: 'email is required.' });
      }
      if (!['editor', 'viewer'].includes(staffRole)) {
        return res.status(400).json({ error: 'staffRole must be viewer or editor.' });
      }
      if (email === normalizeEmail(session.user.email)) {
        return res.status(400).json({ error: 'Use the bootstrap owner account as the permanent owner.' });
      }

      const updated = await UserModel.findOneAndUpdate(
        { email },
        {
          $set: {
            email,
            staffRole,
            staffAddedBy: session.user.googleId,
            staffGrantedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'User must sign in once with Google before staff access can be granted.' });
      }

      return res.json({ staffUser: sanitizeStaffUser(updated.toObject ? updated.toObject() : updated) });
    } catch (error) {
      logServerError('Admin staff grant failed', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/admin/staff' } });
      return res.status(500).json({ error: 'Could not manage staff.' });
    }
  });

  app.put('/api/admin/staff', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const email = normalizeEmail(req.body?.email);
      const staffRole = normalizeStaffRole(req.body?.staffRole);

      if (!email) {
        return res.status(400).json({ error: 'email is required.' });
      }
      if (!['editor', 'viewer'].includes(staffRole)) {
        return res.status(400).json({ error: 'staffRole must be viewer or editor.' });
      }
      if (email === normalizeEmail(session.user.email)) {
        return res.status(400).json({ error: 'Use the bootstrap owner account as the permanent owner.' });
      }

      const updated = await UserModel.findOneAndUpdate(
        { email },
        {
          $set: {
            staffRole,
            staffAddedBy: session.user.googleId,
            staffGrantedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      return res.json({ staffUser: sanitizeStaffUser(updated.toObject ? updated.toObject() : updated) });
    } catch (error) {
      logServerError('Admin staff update failed', { error, req });
      captureServerException(error, { tags: { route: 'PUT /api/admin/staff' } });
      return res.status(500).json({ error: 'Could not manage staff.' });
    }
  });

  app.delete('/api/admin/staff', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'owner');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const email = normalizeEmail(req.query?.email || req.body?.email);
      if (!email) {
        return res.status(400).json({ error: 'email is required.' });
      }
      if (email === normalizeEmail(session.user.email)) {
        return res.status(400).json({ error: 'The bootstrap owner cannot be removed.' });
      }

      const updated = await UserModel.findOneAndUpdate(
        { email },
        {
          $set: {
            staffRole: 'none',
            staffAddedBy: '',
            staffGrantedAt: null,
          },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      return res.json({ ok: true });
    } catch (error) {
      logServerError('Admin staff revoke failed', { error, req });
      captureServerException(error, { tags: { route: 'DELETE /api/admin/staff' } });
      return res.status(500).json({ error: 'Could not manage staff.' });
    }
  });

  app.get('/api/admin/applications', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const [applications, rejectionEmailTemplate] = await Promise.all([
        CareerApplicationModel.find({})
          .select('-__v')
          .sort({ createdAt: -1 })
          .lean(),
        resolveCareerRejectionTemplate(CareerEmailTemplateModel),
      ]);

      return res.json({
        applications: applications.map(serializeCareerApplication),
        rejectionEmailTemplate,
      });
    } catch (error) {
      logServerError('Admin applications fetch failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/admin/applications' } });
      return res.status(500).json({ error: 'Could not load applications.' });
    }
  });

  app.patch('/api/admin/applications', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'editor');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const action = normalizeAction(req.body?.action);
      if (action === 'save-rejection-template') {
        const rejectionEmailTemplate = await saveCareerRejectionTemplate(
          CareerEmailTemplateModel,
          req.body,
          session.user.email || session.user.googleId || ''
        );

        return res.json({
          ok: true,
          rejectionEmailTemplate,
        });
      }

      if (action === 'reject-application') {
        const applicationId = normalizeObjectId(req.body?.applicationId);
        if (!applicationId) {
          return res.status(400).json({ error: 'applicationId is required.' });
        }

        const application = await resolveLeanDocument(CareerApplicationModel.findById(applicationId));
        if (!application) {
          return res.status(404).json({ error: 'Application not found.' });
        }
        if (application.status === 'rejected') {
          return res.status(400).json({ error: 'This application has already been rejected.' });
        }

        const rejectionEmailTemplate = await saveCareerRejectionTemplate(
          CareerEmailTemplateModel,
          req.body,
          session.user.email || session.user.googleId || ''
        );

        const delivery = await sendCareerRejectionEmailFn({
          toEmail: normalizeEmail(application.email),
          template: rejectionEmailTemplate,
          application,
        });

        const resumeKey = typeof application.resumeFileId === 'string'
          ? application.resumeFileId.trim().replace(/^\/+/, '')
          : '';
        if (resumeKey) {
          await deleteCareerResume(resumeKey);
        }

        const now = new Date();
        const updatedApplication = await resolveLeanDocument(CareerApplicationModel.findByIdAndUpdate(
          applicationId,
          {
            $set: {
              status: 'rejected',
              rejectedAt: now,
              rejectedBy: session.user.email || session.user.googleId || '',
              rejectionEmailSubject: delivery.subject,
              rejectionEmailSentAt: delivery.sentAt,
              resumeDeletedAt: resumeKey ? now : application.resumeDeletedAt || null,
              resumeFileId: '',
              resumeFileName: '',
              resumeViewUrl: '',
              resumeDownloadUrl: '',
              resumeOriginalFileName: '',
              resumeMimeType: '',
              resumeSize: 0,
            },
          },
          { new: true }
        ));

        return res.json({
          ok: true,
          application: serializeCareerApplication(updatedApplication),
          rejectionEmailTemplate,
        });
      }

      return res.status(400).json({ error: 'Unsupported application action.' });
    } catch (error) {
      logServerError('Admin application management failed', { error, req });
      captureServerException(error, { tags: { route: 'PATCH /api/admin/applications' } });
      return res.status(500).json({ error: 'Could not manage applications.' });
    }
  });

  app.get('/api/admin/resume-download', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const key = String(req.query?.key || '').trim().replace(/^\/+/, '');
      if (!key || (!key.startsWith('careers/resumes/') && !key.startsWith('resumes/'))) {
        return res.status(400).json({ error: 'Invalid resume key.' });
      }

      const mode = String(req.query?.mode || '').trim().toLowerCase() === 'preview' ? 'preview' : 'download';
      const responseMode = String(req.query?.response || '').trim().toLowerCase() === 'json' ? 'json' : 'redirect';
      const fallbackFilename = key.split('/').filter(Boolean).pop() || 'resume.pdf';
      const filename = String(req.query?.filename || fallbackFilename)
        .trim()
        .replace(/["\r\n]+/g, '')
        .replace(/[\\/]+/g, '-')
        .slice(0, 255) || fallbackFilename;
      const url = await createB2PresignedGetUrl(key, 300, {
        contentType: 'application/pdf',
        contentDisposition: `${mode === 'preview' ? 'inline' : 'attachment'}; filename="${filename}"`,
      });

      if (responseMode === 'json') {
        return res.json({
          url,
          mode,
          filename,
        });
      }

      return res.redirect(302, url);
    } catch (error) {
      logServerError('Admin resume download failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/admin/resume-download' } });
      return res.status(500).json({ error: 'Could not generate download link.' });
    }
  });

  app.get('/api/admin/subscribers', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const session = await resolveAdminSession(UserModel, req.auth, 'viewer');
      if (session.error) {
        return res.status(session.status).json({ error: session.error });
      }

      const users = await session.User.find({
        $or: [
          { subscriptionTier: { $in: ['premium', 'studio'] } },
          { subscriptionId: { $exists: true, $ne: '' } },
        ],
      })
        .select('-__v')
        .sort({ subscriptionCurrentPeriodEnd: -1, updatedAt: -1 })
        .lean();

      let receipts = [];
      try {
        receipts = await BillingReceiptModel.find({})
          .select('-__v')
          .sort({ issuedAt: -1, createdAt: -1 })
          .lean();
      } catch (error) {
        logServerError('Admin receipt lookup failed', { error, req });
        captureServerException(error, { tags: { route: 'GET /api/admin/subscribers.receiptLookup' } });
        receipts = [];
      }

      const latestReceiptByGoogleId = new Map();
      receipts.forEach(receipt => {
        if (receipt?.googleId && !latestReceiptByGoogleId.has(receipt.googleId)) {
          latestReceiptByGoogleId.set(receipt.googleId, receipt);
        }
      });

      return res.json({
        subscribers: users.map(user => ({
          id: String(user._id || user.googleId || ''),
          googleId: user.googleId || '',
          name: user.name || '',
          email: user.email || '',
          subscriptionTier: user.subscriptionTier || 'starter',
          subscriptionStatus: user.subscriptionStatus || 'active',
          subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
          subscriptionId: user.subscriptionId || '',
          latestReceipt: latestReceiptByGoogleId.has(user.googleId)
            ? serializeBillingReceipt(latestReceiptByGoogleId.get(user.googleId))
            : null,
        })),
      });
    } catch (error) {
      logServerError('Admin subscribers fetch failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/admin/subscribers' } });
      return res.status(500).json({ error: 'Could not load subscribers.' });
    }
  });

  app.get('/api/planner/me', (req, res) => plannerHandler.handlePlannerMe(req, res));

  app.put('/api/planner/me', (req, res) => plannerHandler.handlePlannerMe(req, res));

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

      return res.json(getPublicWeddingData(planner, publicPlan));
    } catch (error) {
      logServerError('Failed to load public planner website', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/planner/public' } });
      return res.status(500).json({ error: 'Failed to load wedding website.' });
    }
  });

  app.post('/api/planner/me/rsvp-link', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const plannerOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || req.auth.sub;
      const plannerDoc = await PlannerModel.findOne({ googleId: plannerOwnerId });
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Planner not found.' });
      }

      const email = normalizeEmail(req.auth.email);
      const ownerId = plannerDoc.googleId || plannerOwnerId;
      const normalized = normalizePlannerOwnership(plannerDoc.toObject(), email, ownerId);
      const plan = getPlanFromPlanner(normalized, req.body?.planId || normalized.activePlanId);
      if (!plan) {
        return res.status(404).json({ error: 'Plan not found.' });
      }

      if (!hasPlanRole(plan, email, 'editor')) {
        return res.status(403).json({ error: 'You do not have access to send RSVP links for this plan.' });
      }

      const guestId = String(req.body?.guestId || '').trim();
      const guest = (normalized.guests || []).find(item => item?.planId === plan.id && String(item?.id || '') === guestId);
      if (!guest) {
        return res.status(404).json({ error: 'Guest not found.' });
      }

      const token = createGuestRsvpToken({
        ownerId,
        planId: plan.id,
        guestId,
        version: Number(guest?.rsvpTokenVersion) || 1,
      });
      const coupleName = [plan.bride || normalized.wedding?.bride || '', plan.groom || normalized.wedding?.groom || ''].filter(Boolean).join(' & ');

      return res.json({
        guestName: getGuestDisplayName(guest),
        coupleName: coupleName || 'our wedding',
        token,
        rsvpUrl: buildGuestRsvpLink(req, token),
      });
    } catch (error) {
      logServerError('Failed to create RSVP link', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/planner/me/rsvp-link' } });
      return res.status(500).json({ error: 'Failed to create RSVP link.' });
    }
  });

  app.get('/api/planner/rsvp', async (req, res) => {
    let payload;
    try {
      payload = verifyGuestRsvpToken(req.query?.token);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid RSVP token.' });
    }

    try {
      const plannerDoc = await PlannerModel.findOne({ googleId: payload.ownerId });
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Wedding invitation not found.' });
      }

      const planner = sanitizePlanner(plannerDoc.toObject(), { ownerId: plannerDoc.googleId || '' });
      const guest = (planner.guests || []).find((item) => {
        if (String(item?.id || '') !== payload.guestId) {
          return false;
        }

        return !payload.planId || item?.planId === payload.planId;
      });
      if (!guest) {
        return res.status(404).json({ error: 'Wedding invitation not found.' });
      }

      const plan = getPlanFromPlanner(planner, guest?.planId || payload.planId || planner.activePlanId);
      if (!plan || (guest?.planId && guest.planId !== plan.id)) {
        return res.status(404).json({ error: 'Wedding invitation not found.' });
      }

      if ((Number(guest?.rsvpTokenVersion) || 1) !== (Number(payload.version) || 1)) {
        return res.status(400).json({ error: 'This RSVP link is no longer valid.' });
      }

      return res.json({
        ...getPublicWeddingData(planner, plan),
        guest: {
          id: String(guest.id || ''),
          name: getGuestDisplayName(guest),
          side: guest.side || '',
          phone: guest.phone || '',
          invitedGuestCount: Math.max(1, Number(guest.guestCount) || 1),
          attendingGuestCount: Math.max(0, Number(guest.attendingGuestCount) || 0),
          groupMembers: normalizeGuestGroupMembers(
            guest.groupMembers,
            Math.max(0, Number(guest.attendingGuestCount) || Number(guest.guestCount) || 1) - 1
          ),
          rsvp: guest.rsvp || 'pending',
        },
      });
    } catch (error) {
      logServerError('Failed to load RSVP page', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/planner/rsvp' } });
      return res.status(500).json({ error: 'Failed to load RSVP.' });
    }
  });

  app.post('/api/planner/rsvp', async (req, res) => {
    let payload;
    try {
      payload = verifyGuestRsvpToken(req.body?.token);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid RSVP token.' });
    }

    try {
      const plannerDoc = await PlannerModel.findOne({ googleId: payload.ownerId });
      if (!plannerDoc) {
        return res.status(404).json({ error: 'Wedding invitation not found.' });
      }

      const planner = sanitizePlanner(plannerDoc.toObject(), { ownerId: plannerDoc.googleId || '' });
      const guestIndex = (planner.guests || []).findIndex((item) => {
        if (String(item?.id || '') !== payload.guestId) {
          return false;
        }

        return !payload.planId || item?.planId === payload.planId;
      });
      if (guestIndex < 0) {
        return res.status(404).json({ error: 'Wedding invitation not found.' });
      }

      const guest = planner.guests[guestIndex];
      const plan = getPlanFromPlanner(planner, guest?.planId || payload.planId || planner.activePlanId);
      if (!plan || (guest?.planId && guest.planId !== plan.id)) {
        return res.status(404).json({ error: 'Wedding invitation not found.' });
      }

      if ((Number(guest?.rsvpTokenVersion) || 1) !== (Number(payload.version) || 1)) {
        return res.status(400).json({ error: 'This RSVP link is no longer valid.' });
      }

      const nextRsvp = req.body?.rsvp === 'yes' || req.body?.rsvp === 'no' ? req.body.rsvp : null;
      if (!nextRsvp) {
        return res.status(400).json({ error: 'RSVP response must be yes or no.' });
      }

      const attendingGuestCount = resolveAttendingGuestCount(guest, req.body?.attendingGuestCount, nextRsvp);
      const nextGroupMembers = nextRsvp === 'yes'
        ? normalizeGuestGroupMembers(req.body?.groupMembers, attendingGuestCount - 1)
        : [];
      const nextGuests = [...(planner.guests || [])];
      nextGuests[guestIndex] = {
        ...guest,
        rsvp: nextRsvp,
        attendingGuestCount,
        groupMembers: nextGroupMembers,
        rsvpTokenVersion: (Number(guest?.rsvpTokenVersion) || 1) + 1,
        rsvpUpdatedAt: new Date().toISOString(),
      };

      await PlannerModel.findOneAndUpdate(
        { _id: plannerDoc._id },
        { $set: { guests: nextGuests } },
        { new: true }
      );

      return res.json({
        success: true,
        guest: {
          id: String(guest.id || ''),
          name: getGuestDisplayName(guest),
          invitedGuestCount: Math.max(1, Number(guest.guestCount) || 1),
          attendingGuestCount,
          groupMembers: nextGroupMembers,
          rsvp: nextRsvp,
        },
      });
    } catch (error) {
      logServerError('Failed to save RSVP', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/planner/rsvp' } });
      return res.status(500).json({ error: 'Failed to process RSVP.' });
    }
  });

  app.get('/api/planner/access', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    try {
      const planners = await listAccessiblePlanners(PlannerModel, req.auth);
      return res.json({ planners });
    } catch (error) {
      logServerError('Failed to list accessible planners', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/planner/access' } });
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
      logServerError('Failed to load collaborators', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/planner/me/collaborators' } });
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
      logServerError('Failed to add collaborator', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/planner/me/collaborators' } });
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
      logServerError('Failed to change collaborator role', { error, req });
      captureServerException(error, { tags: { route: 'PUT /api/planner/me/collaborators' } });
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
      logServerError('Failed to remove collaborator', { error, req });
      captureServerException(error, { tags: { route: 'DELETE /api/planner/me/collaborators' } });
      return res.status(500).json({ error: 'Failed to update sharing settings.' });
    }
  });

  app.all('/api/planner/me/notifications', (req, res) => {
    req.query = { ...(req.query || {}), route: 'notifications' };
    return plannerHandler(req, res);
  });

  app.all('/api/planner/internal/reminder-dispatch', (req, res) => {
    req.query = { ...(req.query || {}), route: 'reminder-dispatch' };
    return plannerHandler(req, res);
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
      logServerError('Subscription status failed', { error, req });
      captureServerException(error, { tags: { route: 'GET /api/subscription/status' } });
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
      const coupon = resolveCoupon(couponCode, plan);
      const amount = applyCouponDiscount(baseAmount, coupon);
      return res.json({
        amount,
        baseAmount,
        currency: 'INR',
        appliedCoupon: coupon,
        plan,
        billingCycle: cycle,
        requiresPayment: amount > 0,
      });
    } catch (error) {
      const statusCode = /coupon/i.test(error?.message || '') ? 400 : 500;
      return res.status(statusCode).json({ error: error?.message || 'Failed to calculate checkout quote.' });
    }
  });

  app.post('/api/subscription/checkout', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
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

      const coupon = resolveCoupon(couponCode, plan);
      const amount = applyCouponDiscount(baseAmount, coupon);

      if (amount === 0) {
        return res.json({
          checkoutMode: 'internal_free',
          amount,
          baseAmount,
          currency: 'INR',
          appliedCoupon: coupon,
          name: 'VivahGo',
          description: `${plan === 'studio' ? 'Studio' : 'Premium'} ${cycle === 'yearly' ? 'yearly' : 'monthly'} plan`,
          prefill: {
            name: user.name,
            email: user.email,
          },
        });
      }

      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!razorpayKeyId || !razorpayKeySecret) {
        return res.status(500).json({ error: 'Payment gateway is not configured.' });
      }

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
        checkoutMode: 'razorpay',
      });
    } catch (error) {
      logServerError('Razorpay order creation failed', { error, req });
      const statusCode = /coupon/i.test(error?.message || '') ? 400 : 500;
      captureServerExceptionForStatus(error, statusCode, { tags: { route: 'POST /api/subscription/checkout' } });
      return res.status(statusCode).json({ error: error?.message || 'Failed to create checkout order.' });
    }
  });

  app.post('/api/subscription/confirm', (req, res, next) => authMiddleware(req, res, next, injectedJwtSecret), async (req, res) => {
    const { plan, billingCycle, orderId, paymentId, signature, couponCode } = req.body || {};
    if (!plan || !['premium', 'studio'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan.' });
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';

    try {
      const user = await UserModel.findOne({ googleId: req.auth.sub }).lean();
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const baseAmount = resolveSubscriptionAmount(plan, cycle);
      if (!baseAmount) {
        return res.status(500).json({ error: `Amount for ${plan} (${cycle}) is not configured.` });
      }

      const coupon = resolveCoupon(couponCode, plan);
      const amount = applyCouponDiscount(baseAmount, coupon);

      if (amount > 0) {
        const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!razorpayKeySecret) {
          return res.status(500).json({ error: 'Payment gateway is not configured.' });
        }
        if (!orderId || !paymentId || !signature) {
          return res.status(400).json({ error: 'Payment confirmation is incomplete.' });
        }
        const isValid = verifyRazorpayPaymentSignature(orderId, paymentId, signature, razorpayKeySecret);
        if (!isValid) {
          return res.status(400).json({ error: 'Payment signature verification failed.' });
        }
      }

      const result = await persistReceiptAndSubscription({
        BillingReceiptModel,
        UserModel,
        auth: req.auth,
        user,
        plan,
        cycle,
        baseAmount,
        amount,
        coupon,
        paymentProvider: amount === 0 ? 'internal' : 'razorpay',
        paymentReference: amount === 0 ? '' : paymentId,
      });

      return res.json({ success: true, receipt: result.receipt, checkoutMode: amount === 0 ? 'internal_free' : 'razorpay' });
    } catch (error) {
      logServerError('Razorpay payment confirmation failed', { error, req });
      const statusCode = /coupon/i.test(error?.message || '') ? 400 : 500;
      captureServerExceptionForStatus(error, statusCode, { tags: { route: 'POST /api/subscription/confirm' } });
      return res.status(statusCode).json({ error: statusCode === 400 ? (error?.message || 'Failed to confirm payment.') : 'Failed to confirm payment.' });
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
      logServerError('Razorpay webhook handler failed', { error, req });
      captureServerException(error, { tags: { route: 'POST /api/subscription/webhook' } });
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  });

  setupSentryErrorHandlers(app);
  app.use(createFinalErrorMiddleware());

  return app;
}

function tierForPlan(plan) {
  if (plan === 'studio') return 'studio';
  if (plan === 'premium') return 'premium';
  return 'starter';
}

function generateReceiptNumber(plan) {
  const prefix = plan === 'studio' ? 'VGS' : 'VGP';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function serializeBillingReceipt(receipt = {}) {
  const plain = typeof receipt?.toObject === 'function' ? receipt.toObject() : receipt;
  return {
    id: String(plain._id || ''),
    receiptNumber: plain.receiptNumber || '',
    email: plain.email || '',
    plan: plain.plan || '',
    billingCycle: plain.billingCycle || '',
    currency: plain.currency || 'INR',
    baseAmount: Number(plain.baseAmount || 0),
    amount: Number(plain.amount || 0),
    couponCode: plain.couponCode || '',
    discountPercent: Number(plain.discountPercent || 0),
    paymentProvider: plain.paymentProvider || 'internal',
    paymentReference: plain.paymentReference || '',
    status: plain.status || 'issued',
    emailDeliveryStatus: plain.emailDeliveryStatus || 'pending',
    emailDeliveryError: plain.emailDeliveryError || '',
    issuedAt: plain.issuedAt || null,
    currentPeriodEnd: plain.currentPeriodEnd || null,
  };
}

function getBillingDocumentMeta(receipt = {}) {
  const isPaymentDue = receipt.status === 'payment_due';
  return {
    title: isPaymentDue ? 'Bill' : 'Receipt',
    subject: isPaymentDue ? 'bill' : 'receipt',
    intro: isPaymentDue
      ? `Your ${receipt.plan} plan bill has been generated successfully.`
      : `Your ${receipt.plan} plan receipt has been generated successfully.`,
    totalLabel: isPaymentDue ? 'Payment due' : 'Amount paid',
    statusLabel: isPaymentDue ? 'Payment due' : 'Paid',
  };
}

async function sendBillingReceiptEmail({ toEmail, userName, receipt }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const billingFromEmail = process.env.BILLING_FROM_EMAIL;
  if (!resendApiKey || !billingFromEmail || !toEmail) {
    return { status: 'skipped', error: '' };
  }

  const periodEnd = receipt.currentPeriodEnd
    ? new Date(receipt.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not available';

  const amountInRupees = (Number(receipt.amount || 0) / 100).toFixed(2);
  const baseAmountInRupees = (Number(receipt.baseAmount || 0) / 100).toFixed(2);
  const documentMeta = getBillingDocumentMeta(receipt);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="margin-bottom: 8px;">VivahGo ${documentMeta.title}</h2>
      <p>Hello ${userName || 'there'},</p>
      <p>${documentMeta.intro}</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
        <tr><td style="padding: 6px 0; font-weight: 600;">Receipt number</td><td style="padding: 6px 0;">${receipt.receiptNumber}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Status</td><td style="padding: 6px 0;">${documentMeta.statusLabel}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Plan</td><td style="padding: 6px 0; text-transform: capitalize;">${receipt.plan}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Billing cycle</td><td style="padding: 6px 0; text-transform: capitalize;">${receipt.billingCycle}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Base amount</td><td style="padding: 6px 0;">INR ${baseAmountInRupees}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Discount</td><td style="padding: 6px 0;">${receipt.discountPercent}%${receipt.couponCode ? ` (${receipt.couponCode})` : ''}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">${documentMeta.totalLabel}</td><td style="padding: 6px 0;">INR ${amountInRupees}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Valid until</td><td style="padding: 6px 0;">${periodEnd}</td></tr>
      </table>
      <p style="margin-top: 18px;">Thank you for choosing VivahGo.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: billingFromEmail,
      to: [toEmail],
      subject: `VivahGo ${documentMeta.subject} ${receipt.receiptNumber}`,
      html,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Email delivery failed (${response.status}).`);
  }

  return { status: 'sent', error: '' };
}

async function persistReceiptAndSubscription({ BillingReceiptModel, UserModel, auth, user, plan, cycle, baseAmount, amount, coupon, paymentProvider, paymentReference }) {
  const currentPeriodEnd = buildSubscriptionPeriodEnd(cycle);
  const createdReceipt = await BillingReceiptModel.create({
    googleId: auth.sub,
    email: user.email,
    receiptNumber: generateReceiptNumber(plan),
    plan,
    billingCycle: cycle,
    currency: 'INR',
    baseAmount,
    amount,
    couponCode: coupon?.code || '',
    discountPercent: Number(coupon?.discountPercent || 0),
    paymentProvider,
    paymentReference: paymentReference || '',
    status: amount === 0 ? 'payment_due' : 'paid',
    emailDeliveryStatus: 'pending',
    issuedAt: new Date(),
    currentPeriodEnd,
    meta: {
      applicablePlans: coupon?.applicablePlans || [],
    },
  });

  await UserModel.updateOne(
    { googleId: auth.sub },
    {
      $set: {
        subscriptionId: paymentReference || createdReceipt.receiptNumber,
        subscriptionTier: tierForPlan(plan),
        subscriptionStatus: 'active',
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
      },
    }
  );

  try {
    const emailResult = await sendBillingReceiptEmail({
      toEmail: user.email,
      userName: user.name,
      receipt: serializeBillingReceipt(createdReceipt),
    });
    await BillingReceiptModel.updateOne(
      { _id: createdReceipt._id },
      { $set: { emailDeliveryStatus: emailResult.status, emailDeliveryError: emailResult.error || '' } }
    );
    return {
      receipt: {
        ...serializeBillingReceipt(createdReceipt),
        emailDeliveryStatus: emailResult.status,
        emailDeliveryError: emailResult.error || '',
      },
      currentPeriodEnd,
    };
  } catch (error) {
    await BillingReceiptModel.updateOne(
      { _id: createdReceipt._id },
      { $set: { emailDeliveryStatus: 'failed', emailDeliveryError: error.message || 'Email delivery failed.' } }
    );
    return {
      receipt: {
        ...serializeBillingReceipt(createdReceipt),
        emailDeliveryStatus: 'failed',
        emailDeliveryError: error.message || 'Email delivery failed.',
      },
      currentPeriodEnd,
    };
  }
}

async function _getUserSubscriptionTier(UserModel, googleId) {
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
  app.listen(port, '0.0.0.0', () => {
    logServerInfo('VivahGo API listening', {
      fields: {
        host: '0.0.0.0',
        port,
        local_url: `http://localhost:${port}`,
      },
      root: {
        host: '0.0.0.0',
        port,
      },
    });
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  start().catch(async (error) => {
    logServerError('Failed to start server', {
      error,
      fields: {
        origin: 'server.start',
      },
      root: {
        origin: 'server.start',
      },
    });
    captureServerException(error, { tags: { origin: 'server.start' } });
    await Promise.allSettled([flushServerLogger(), flushServerSentry(2000)]);
    process.exit(1);
  });
}
