const crypto = require('crypto');

const {
  applyRateLimit,
  assignWeddingWebsiteSlugs,
  buildEmptyPlanner,
  connectDb,
  createGuestRsvpToken,
  getCollaboratorRoleForPlan,
  getPublicCache,
  getPlannerModel,
  getPlanFromPlanner,
  getReminderJobModel,
  getSubscriptionTier,
  getUserModel,
  handlePreflight,
  hasPlanRole,
  invalidatePublicCache,
  normalizeEmail,
  normalizePlannerOwnership,
  normalizeRole,
  requireCsrfProtection,
  sanitizeNotificationPreferences,
  sanitizePlanner,
  sanitizeReminderSettings,
  setCacheControl,
  setCorsHeaders,
  setPublicCache,
  verifyGuestRsvpToken,
  verifySession,
  withRequestMetrics,
} = require('./_lib/core');
const { sendFcmNotification } = require('./_lib/fcm');

const PLANNER_PUBLIC_CACHE_TAG = 'planner-public';
const PLANNER_CONFLICT_CODE = 'PLANNER_CONFLICT';

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

function normalizePlannerRevision(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeClientSequence(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildPlannerRevisionFilter(currentRevision) {
  if (currentRevision > 0) {
    return { plannerRevision: currentRevision };
  }

  return {
    $or: [
      { plannerRevision: { $exists: false } },
      { plannerRevision: 0 },
    ],
  };
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

function getPlannerPublicCacheKey(slug) {
  return `planner-public:${String(slug || '').trim().toLowerCase()}`;
}

function collectPlannerPublicSlugs(planner) {
  return Array.isArray(planner?.marriages)
    ? planner.marriages.map(item => String(item?.websiteSlug || '').trim().toLowerCase()).filter(Boolean)
    : [];
}

function refreshPlannerPublicSnapshots(planner, previousPlanner) {
  const slugsToInvalidate = new Set([
    ...collectPlannerPublicSlugs(previousPlanner),
    ...collectPlannerPublicSlugs(planner),
  ]);

  for (const slug of slugsToInvalidate) {
    invalidatePublicCache(getPlannerPublicCacheKey(slug));
  }

  for (const marriage of Array.isArray(planner?.marriages) ? planner.marriages : []) {
    const slug = String(marriage?.websiteSlug || '').trim().toLowerCase();
    if (!slug || marriage?.websiteSettings?.isActive === false) {
      continue;
    }

    setPublicCache(
      getPlannerPublicCacheKey(slug),
      getPublicWeddingData(planner, marriage),
      { tags: [PLANNER_PUBLIC_CACHE_TAG] }
    );
  }
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

const REMINDER_DISPATCH_MAX_JOBS = 25;
const REMINDER_STALE_PROCESSING_MS = 10 * 60 * 1000;
const IST_OFFSET_MINUTES = 330;
const IST_DEFAULT_EVENT_HOUR = 10;
const IST_DEFAULT_PAYMENT_HOUR = 9;
const MONTH_INDEX = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function isPaidReminderTier(tier) {
  return tier === 'premium' || tier === 'studio';
}

function buildNotificationClickPath(tab = 'home') {
  const safeTab = ['home', 'events', 'budget', 'guests', 'tasks'].includes(tab) ? tab : 'home';
  return `/?tab=${encodeURIComponent(safeTab)}`;
}

function sanitizePlanReminderSettingsForTier(value, tier) {
  const next = sanitizeReminderSettings(value);
  if (!isPaidReminderTier(tier)) {
    return { ...next, enabled: false };
  }
  return next;
}

function applyReminderTierGate(planner, tier) {
  return {
    ...planner,
    marriages: (planner.marriages || []).map(plan => ({
      ...plan,
      reminderSettings: sanitizePlanReminderSettingsForTier(plan.reminderSettings, tier),
    })),
  };
}

function getReminderDispatchSecret() {
  return String(process.env.REMINDER_DISPATCH_SECRET || '').trim();
}

function hasReminderDispatchAccess(req) {
  const configuredSecret = getReminderDispatchSecret();
  if (!configuredSecret) {
    return false;
  }

  const bearerHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : '';
  const bearerValue = bearerHeader.toLowerCase().startsWith('bearer ')
    ? bearerHeader.slice(7).trim()
    : '';
  const headerSecret = typeof req.headers?.['x-reminder-secret'] === 'string' ? req.headers['x-reminder-secret'].trim() : '';

  return headerSecret === configuredSecret || bearerValue === configuredSecret;
}

function buildIstDate(year, monthIndex, day, hour = IST_DEFAULT_EVENT_HOUR, minute = 0) {
  if (![year, monthIndex, day, hour, minute].every(Number.isFinite)) {
    return null;
  }

  const utcMillis = Date.UTC(year, monthIndex, day, hour, minute) - (IST_OFFSET_MINUTES * 60 * 1000);
  return new Date(utcMillis);
}

function parseEventDate(value) {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      monthIndex: Number(isoMatch[2]) - 1,
      day: Number(isoMatch[3]),
    };
  }

  const parts = normalized.split(' ');
  if (parts.length !== 3) {
    return null;
  }

  const day = Number(parts[0]);
  const monthIndex = MONTH_INDEX[String(parts[1] || '').trim().toLowerCase()];
  const year = Number(parts[2]);
  if (!Number.isFinite(day) || !Number.isFinite(year) || !Number.isInteger(monthIndex)) {
    return null;
  }

  return { year, monthIndex, day };
}

function parseEventTime(value, fallbackHour = IST_DEFAULT_EVENT_HOUR) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { hour: fallbackHour, minute: 0 };
  }

  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return { hour: fallbackHour, minute: 0 };
  }

  let hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  const meridiem = String(match[3] || '').toUpperCase();
  if (meridiem === 'PM') {
    hour += 12;
  }

  return {
    hour,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function parseEventScheduledAt(event) {
  const dateParts = parseEventDate(event?.date);
  if (!dateParts) {
    return null;
  }

  const timeParts = parseEventTime(event?.time, IST_DEFAULT_EVENT_HOUR);
  return buildIstDate(dateParts.year, dateParts.monthIndex, dateParts.day, timeParts.hour, timeParts.minute);
}

function parseExpenseScheduledAt(expense) {
  const dateParts = parseEventDate(expense?.expenseDate);
  if (!dateParts) {
    return null;
  }

  return buildIstDate(dateParts.year, dateParts.monthIndex, dateParts.day, IST_DEFAULT_PAYMENT_HOUR, 0);
}

function buildReminderDedupeKey(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

function getPlanRecipientEmails(plan, ownerEmail = '') {
  const recipients = new Set();
  const normalizedOwnerEmail = normalizeEmail(ownerEmail);

  if (normalizedOwnerEmail) {
    recipients.add(normalizedOwnerEmail);
  }

  for (const collaborator of Array.isArray(plan?.collaborators) ? plan.collaborators : []) {
    const email = normalizeEmail(collaborator?.email);
    if (email) {
      recipients.add(email);
    }
  }

  return [...recipients];
}

function buildEventReminderJobs(planner, plan, ownerId, recipientEmail, now) {
  const settings = sanitizeReminderSettings(plan?.reminderSettings);
  if (!settings.enabled) {
    return [];
  }

  const jobs = [];
  const planEvents = (planner.events || []).filter(event => event?.planId === plan.id);

  for (const event of planEvents) {
    const scheduledAt = parseEventScheduledAt(event);
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      continue;
    }

    if (scheduledAt <= now) {
      continue;
    }

    const eventName = String(event?.name || 'Wedding event').trim() || 'Wedding event';
    const venue = String(event?.venue || '').trim();

    if (settings.eventDayBefore) {
      const triggerAt = new Date(scheduledAt.getTime() - (24 * 60 * 60 * 1000));
      if (triggerAt > now) {
        jobs.push({
          ownerGoogleId: ownerId,
          recipientEmail,
          planId: plan.id,
          type: 'event_day_before',
          entityId: String(event.id || eventName),
          title: `${eventName} tomorrow`,
          body: venue ? `${eventName} is tomorrow at ${venue}.` : `${eventName} is tomorrow.`,
          clickPath: buildNotificationClickPath('events'),
          scheduledFor: triggerAt,
          dedupeKey: buildReminderDedupeKey([ownerId, recipientEmail, plan.id, 'event_day_before', String(event.id || eventName), triggerAt.toISOString()]),
          meta: {
            eventName,
            venue,
            eventDate: event?.date || '',
            eventTime: event?.time || '',
          },
        });
      }
    }

    if (settings.eventHoursBefore) {
      const triggerAt = new Date(scheduledAt.getTime() - (3 * 60 * 60 * 1000));
      if (triggerAt > now) {
        jobs.push({
          ownerGoogleId: ownerId,
          recipientEmail,
          planId: plan.id,
          type: 'event_hours_before',
          entityId: String(event.id || eventName),
          title: `${eventName} in 3 hours`,
          body: venue ? `${eventName} starts soon at ${venue}.` : `${eventName} starts in 3 hours.`,
          clickPath: buildNotificationClickPath('events'),
          scheduledFor: triggerAt,
          dedupeKey: buildReminderDedupeKey([ownerId, recipientEmail, plan.id, 'event_hours_before', String(event.id || eventName), triggerAt.toISOString()]),
          meta: {
            eventName,
            venue,
            eventDate: event?.date || '',
            eventTime: event?.time || '',
          },
        });
      }
    }
  }

  return jobs;
}

function buildPaymentReminderJobs(planner, plan, ownerId, recipientEmail, now) {
  const settings = sanitizeReminderSettings(plan?.reminderSettings);
  if (!settings.enabled) {
    return [];
  }

  const jobs = [];
  const planExpenses = (planner.expenses || []).filter(expense => expense?.planId === plan.id);

  for (const expense of planExpenses) {
    const scheduledAt = parseExpenseScheduledAt(expense);
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      continue;
    }

    if (scheduledAt <= now) {
      continue;
    }

    const expenseName = String(expense?.name || 'Payment').trim() || 'Payment';

    if (settings.paymentThreeDaysBefore) {
      const triggerAt = new Date(scheduledAt.getTime() - (3 * 24 * 60 * 60 * 1000));
      if (triggerAt > now) {
        jobs.push({
          ownerGoogleId: ownerId,
          recipientEmail,
          planId: plan.id,
          type: 'payment_three_days_before',
          entityId: String(expense.id || expenseName),
          title: `${expenseName} due in 3 days`,
          body: `A planned payment is coming up soon in your wedding budget.`,
          clickPath: buildNotificationClickPath('budget'),
          scheduledFor: triggerAt,
          dedupeKey: buildReminderDedupeKey([ownerId, recipientEmail, plan.id, 'payment_three_days_before', String(expense.id || expenseName), triggerAt.toISOString()]),
          meta: {
            expenseName,
            amount: Number(expense?.amount || 0),
            expenseDate: expense?.expenseDate || '',
          },
        });
      }
    }

    if (settings.paymentDayOf) {
      const triggerAt = new Date(scheduledAt.getTime());
      if (triggerAt > now) {
        jobs.push({
          ownerGoogleId: ownerId,
          recipientEmail,
          planId: plan.id,
          type: 'payment_day_of',
          entityId: String(expense.id || expenseName),
          title: `${expenseName} is due today`,
          body: `Review the budget and payment status for today’s due item.`,
          clickPath: buildNotificationClickPath('budget'),
          scheduledFor: triggerAt,
          dedupeKey: buildReminderDedupeKey([ownerId, recipientEmail, plan.id, 'payment_day_of', String(expense.id || expenseName), triggerAt.toISOString()]),
          meta: {
            expenseName,
            amount: Number(expense?.amount || 0),
            expenseDate: expense?.expenseDate || '',
          },
        });
      }
    }
  }

  return jobs;
}

async function rebuildReminderJobsForPlanner(planner, ownerId, ownerEmail, tier) {
  const ReminderJob = getReminderJobModel();
  if (ReminderJob?.db?.readyState !== 1) {
    return { count: 0 };
  }

  await ReminderJob.deleteMany({ ownerGoogleId: ownerId });

  if (!isPaidReminderTier(tier)) {
    return { count: 0 };
  }

  const now = new Date();
  const jobs = [];

  for (const plan of Array.isArray(planner?.marriages) ? planner.marriages : []) {
    const reminderSettings = sanitizePlanReminderSettingsForTier(plan.reminderSettings, tier);
    if (!reminderSettings.enabled) {
      continue;
    }

    const recipients = getPlanRecipientEmails({ ...plan, reminderSettings }, findOwnerEmail(plan, ownerEmail));
    for (const recipientEmail of recipients) {
      jobs.push(...buildEventReminderJobs(planner, { ...plan, reminderSettings }, ownerId, recipientEmail, now));
      jobs.push(...buildPaymentReminderJobs(planner, { ...plan, reminderSettings }, ownerId, recipientEmail, now));
    }
  }

  if (!jobs.length) {
    return { count: 0 };
  }

  await ReminderJob.insertMany(jobs, { ordered: false });
  return { count: jobs.length };
}

async function claimNextReminderJob(ReminderJob) {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - REMINDER_STALE_PROCESSING_MS);

  return ReminderJob.findOneAndUpdate(
    {
      scheduledFor: { $lte: now },
      $or: [
        { status: 'pending' },
        { status: 'processing', processingStartedAt: { $lte: staleCutoff } },
      ],
    },
    {
      $set: {
        status: 'processing',
        processingStartedAt: now,
        lastError: '',
      },
    },
    {
      sort: { scheduledFor: 1, createdAt: 1 },
      new: true,
    }
  );
}

async function disableNotificationToken(User, userId, token) {
  await User.updateOne(
    { _id: userId, 'notificationDevices.token': token },
    {
      $set: {
        'notificationDevices.$.disabledAt': new Date(),
        'notificationDevices.$.lastSeenAt': new Date(),
      },
    }
  );
}

async function processReminderJob(job) {
  const User = getUserModel();
  const ReminderJob = getReminderJobModel();
  const ownerTier = await getSubscriptionTier(job.ownerGoogleId);

  if (!isPaidReminderTier(ownerTier)) {
    await ReminderJob.updateOne(
      { _id: job._id },
      { $set: { status: 'canceled', processedAt: new Date(), lastError: 'Workspace is not on a paid tier.' } }
    );
    return { status: 'canceled' };
  }

  const user = await User.findOne({ email: job.recipientEmail });
  if (!user) {
    await ReminderJob.updateOne(
      { _id: job._id },
      { $set: { status: 'skipped', processedAt: new Date(), lastError: 'Recipient account not found.' } }
    );
    return { status: 'skipped' };
  }

  const preferences = sanitizeNotificationPreferences(user.notificationPreferences);
  const isEventJob = job.type === 'event_day_before' || job.type === 'event_hours_before';
  const isPaymentJob = job.type === 'payment_three_days_before' || job.type === 'payment_day_of';
  if ((isEventJob && !preferences.eventReminders) || (isPaymentJob && !preferences.paymentReminders)) {
    await ReminderJob.updateOne(
      { _id: job._id },
      { $set: { status: 'skipped', processedAt: new Date(), lastError: 'Recipient opted out of this reminder type.' } }
    );
    return { status: 'skipped' };
  }

  const devices = Array.isArray(user.notificationDevices)
    ? user.notificationDevices.filter(device => !device?.disabledAt && typeof device?.token === 'string' && device.token.trim())
    : [];
  if (!devices.length) {
    await ReminderJob.updateOne(
      { _id: job._id },
      { $set: { status: 'skipped', processedAt: new Date(), lastError: 'No active push devices.' } }
    );
    return { status: 'skipped' };
  }

  let sentCount = 0;
  let lastError = '';
  for (const device of devices) {
    try {
      await sendFcmNotification({
        token: device.token,
        title: job.title,
        body: job.body,
        clickPath: job.clickPath || '/',
        data: {
          planId: job.planId,
          reminderType: job.type,
          entityId: job.entityId,
        },
      });
      sentCount += 1;
    } catch (error) {
      lastError = error?.message || 'FCM send failed.';
      if (/UNREGISTERED|INVALID_ARGUMENT/i.test(`${error?.code || ''} ${error?.message || ''}`)) {
        await disableNotificationToken(User, user._id, device.token);
      }
    }
  }

  await ReminderJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: sentCount > 0 ? 'sent' : 'failed',
        processedAt: new Date(),
        lastError: sentCount > 0 ? '' : (lastError || 'No device accepted the push notification.'),
      },
    }
  );

  return { status: sentCount > 0 ? 'sent' : 'failed' };
}

async function dispatchDueReminderJobs(maxJobs = REMINDER_DISPATCH_MAX_JOBS) {
  const ReminderJob = getReminderJobModel();
  const limit = Math.max(1, Math.min(100, Math.trunc(Number(maxJobs) || REMINDER_DISPATCH_MAX_JOBS)));
  const summary = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    canceled: 0,
  };

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextReminderJob(ReminderJob);
    if (!job) {
      break;
    }

    summary.processed += 1;
    const result = await processReminderJob(job);
    if (result?.status === 'sent') summary.sent += 1;
    if (result?.status === 'failed') summary.failed += 1;
    if (result?.status === 'skipped') summary.skipped += 1;
    if (result?.status === 'canceled') summary.canceled += 1;
  }

  return summary;
}

function upsertNotificationDevice(user, payload) {
  const nextToken = String(payload?.token || '').trim();
  if (!nextToken) {
    throw new Error('A notification token is required.');
  }

  const platform = payload?.platform === 'android' || payload?.platform === 'ios' ? payload.platform : 'web';
  const deviceLabel = String(payload?.deviceLabel || '').trim().slice(0, 80);
  const appVersion = String(payload?.appVersion || '').trim().slice(0, 40);
  const devices = Array.isArray(user.notificationDevices) ? [...user.notificationDevices] : [];
  const existingIndex = devices.findIndex(device => String(device?.token || '') === nextToken);
  const nextDevice = {
    token: nextToken,
    platform,
    deviceLabel,
    appVersion,
    disabledAt: null,
    createdAt: existingIndex >= 0 ? devices[existingIndex].createdAt || new Date() : new Date(),
    lastSeenAt: new Date(),
  };

  if (existingIndex >= 0) {
    devices[existingIndex] = {
      ...devices[existingIndex],
      ...nextDevice,
    };
  } else {
    devices.push(nextDevice);
  }

  return devices;
}

/******************************************************************************
 * /api/planner/me
 ******************************************************************************/

async function handlePlannerMe(req, res) {
  setCacheControl(res, 'noStore');

  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  const { auth, error, status = 401 } = verifySession(req);
  if (error) {
    return res.status(status).json({ error });
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

      const plannerRevision = Math.max(0, Number(plannerDoc?.plannerRevision) || 0);
      return res.status(200).json({
        planner: sanitizePlanner(normalized, { ownerEmail: findOwnerEmail(activePlan, email), ownerId }),
        plannerRevision,
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
    const ownerTier = await getSubscriptionTier(ownerId);
    const gatedPlanner = applyReminderTierGate(nextPlanner, ownerTier);
    const currentPlannerRevision = Math.max(0, Number(plannerDoc?.plannerRevision) || 0);
    const baseRevision = normalizePlannerRevision(req.body?.baseRevision);
    const correlationId = typeof req.body?.correlationId === 'string' ? req.body.correlationId.trim() : '';
    const clientSequence = normalizeClientSequence(req.body?.clientSequence);
    const nextPlan = getPlanFromPlanner(gatedPlanner, gatedPlanner.activePlanId);
    const ownerFallback = !email && ownerId === auth.sub;
    if (!ownerFallback && !hasPlanRole(nextPlan, email, 'editor')) {
      return res.status(403).json({ error: 'You have view-only access to this plan.' });
    }

    if (baseRevision !== null && baseRevision < currentPlannerRevision) {
      return res.status(409).json({
        error: 'Planner has newer changes. Refresh and try again.',
        code: PLANNER_CONFLICT_CODE,
        correlationId,
        clientSequence,
        plannerRevision: currentPlannerRevision,
        plannerOwnerId: ownerId,
      });
    }

    const currentPlanCount = Array.isArray(normalized.marriages) ? normalized.marriages.length : 0;
    const nextPlanCount = Array.isArray(gatedPlanner.marriages) ? gatedPlanner.marriages.length : 0;
    if (nextPlanCount > currentPlanCount) {
      if (ownerTier === 'starter' && nextPlanCount > 1) {
        return res.status(403).json({ error: 'Starter plan supports 1 wedding. Upgrade to Premium for unlimited plans.', code: 'UPGRADE_REQUIRED' });
      }
    }

    const updated = await Planner.findOneAndUpdate(
      {
        _id: plannerDoc._id || ownerId,
        ...buildPlannerRevisionFilter(currentPlannerRevision),
      },
      {
        $set: {
          ...gatedPlanner,
        },
        $inc: {
          plannerRevision: 1,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Planner has newer changes. Refresh and try again.',
        code: PLANNER_CONFLICT_CODE,
        correlationId,
        clientSequence,
        plannerRevision: currentPlannerRevision + 1,
        plannerOwnerId: ownerId,
      });
    }

    const updatedOwnerId = updated.googleId || ownerId;
    const nextPlannerRevision = Math.max(currentPlannerRevision + 1, Number(updated?.plannerRevision) || 0);
    const updatedNormalized = normalizePlannerOwnership(updated.toObject(), email, updatedOwnerId);
    refreshPlannerPublicSnapshots(updatedNormalized, normalized);
    await rebuildReminderJobsForPlanner(
      updatedNormalized,
      updatedOwnerId,
      findOwnerEmail(getPlanFromPlanner(updatedNormalized, updatedNormalized.activePlanId), email),
      ownerTier
    );
    return res.status(200).json({
      planner: sanitizePlanner(updatedNormalized, { ownerEmail: email, ownerId: updatedOwnerId }),
      plannerRevision: nextPlannerRevision,
      correlationId,
      clientSequence,
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
  setCacheControl(res, 'noStore');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { auth, error, status = 401 } = verifySession(req);
  if (error) {
    return res.status(status).json({ error });
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
  setCacheControl(res, 'noStore');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const slug = typeof req.query?.slug === 'string' ? req.query.slug.trim().toLowerCase() : '';
  if (!slug) {
    return res.status(400).json({ error: 'A website slug is required.' });
  }

  try {
    return await withRequestMetrics('planner:public', async () => {
      const cacheKey = getPlannerPublicCacheKey(slug);
      const cached = getPublicCache(cacheKey);
      if (cached) {
        console.info('[cache] hit', { key: cacheKey, source: 'memory-snapshot' });
        setCacheControl(res, 'plannerPublic');
        return res.status(200).json(cached.value);
      }

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

      const payload = getPublicWeddingData(planner, publicPlan);
      setPublicCache(cacheKey, payload, { tags: [PLANNER_PUBLIC_CACHE_TAG] });
      console.info('[cache] miss', { key: cacheKey, source: 'db' });
      setCacheControl(res, 'plannerPublic');
      return res.status(200).json(payload);
    });
  } catch (error) {
    console.error('Public planner API failed:', error);
    return res.status(500).json({ error: 'Failed to load wedding website.' });
  }
}

async function handlePlannerRsvpLink(req, res) {
  setCacheControl(res, 'noStore');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  if (applyRateLimit(req, res, 'planner:rsvp-link', {
    windowMs: 10 * 60 * 1000,
    max: 30,
    message: 'Too many RSVP link requests. Please try again shortly.',
  })) {
    return;
  }

  const { auth, error, status = 401 } = verifySession(req);
  if (error) {
    return res.status(status).json({ error });
  }

  const requestedOwnerId = req.query?.plannerOwnerId || req.body?.plannerOwnerId || '';

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const email = normalizeEmail(auth.email);
    const plannerOwnerId = requestedOwnerId || auth.sub;
    const plannerDoc = await Planner.findOne({ googleId: plannerOwnerId });
    if (!plannerDoc) {
      return res.status(404).json({ error: 'Planner not found.' });
    }

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

    return res.status(200).json({
      guestName: getGuestDisplayName(guest),
      coupleName: coupleName || 'our wedding',
      token,
      rsvpUrl: buildGuestRsvpLink(req, token),
    });
  } catch (err) {
    console.error('RSVP link API failed:', err);
    return res.status(500).json({ error: 'Failed to create RSVP link.' });
  }
}

async function handlePlannerRsvp(req, res) {
  setCacheControl(res, 'noStore');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res, { skipForBearer: false })) {
    return;
  }

  if (applyRateLimit(req, res, `planner:rsvp:${req.method === 'GET' ? 'view' : 'submit'}`, {
    windowMs: req.method === 'GET' ? 10 * 60 * 1000 : 60 * 60 * 1000,
    max: req.method === 'GET' ? 120 : 20,
    message: req.method === 'GET'
      ? 'Too many RSVP page requests. Please try again shortly.'
      : 'Too many RSVP submissions. Please try again later.',
  })) {
    return;
  }

  const token = req.method === 'GET'
    ? req.query?.token
    : req.body?.token;

  let payload;
  try {
    payload = verifyGuestRsvpToken(token);
  } catch (error) {
    if (error?.message === 'JWT_SECRET must be configured in production.' || error?.message === 'RSVP_TOKEN_SECRET must be configured in production.') {
      return res.status(500).json({ error: 'RSVP is not configured right now.' });
    }
    return res.status(400).json({ error: error.message || 'Invalid RSVP token.' });
  }

  try {
    await connectDb();
    const Planner = getPlannerModel();
    const plannerDoc = await Planner.findOne({ googleId: payload.ownerId });
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

    if (req.method === 'GET') {
      return res.status(200).json({
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
    }

    const nextRsvp = req.body?.rsvp === 'yes' || req.body?.rsvp === 'no'
      ? req.body.rsvp
      : null;
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

    await Planner.findOneAndUpdate(
      { _id: plannerDoc._id },
      { $set: { guests: nextGuests } },
      { new: true }
    );

    return res.status(200).json({
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
  } catch (err) {
    console.error('RSVP API failed:', err);
    return res.status(500).json({ error: 'Failed to process RSVP.' });
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
  setCacheControl(res, 'noStore');

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  const { auth, error, status = 401 } = verifySession(req);
  if (error) {
    return res.status(status).json({ error });
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
    const ownerTier = await getSubscriptionTier(planner.googleId || plannerOwnerId);
    await rebuildReminderJobsForPlanner(
      applyReminderTierGate(sanitized, ownerTier),
      planner.googleId || plannerOwnerId,
      ownerEmail,
      ownerTier
    );

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
 * /api/planner/me/notifications
 ******************************************************************************/

async function handlePlannerNotifications(req, res) {
  setCacheControl(res, 'noStore');

  if (!['GET', 'PUT', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (requireCsrfProtection(req, res)) {
    return;
  }

  const { auth, error, status = 401 } = verifySession(req);
  if (error) {
    return res.status(status).json({ error });
  }

  try {
    await connectDb();
    const User = getUserModel();
    const user = await User.findOne({ googleId: auth.sub });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.method === 'GET') {
      const devices = Array.isArray(user.notificationDevices)
        ? user.notificationDevices.filter(device => !device?.disabledAt && typeof device?.token === 'string' && device.token.trim())
        : [];
      return res.status(200).json({
        notificationPreferences: sanitizeNotificationPreferences(user.notificationPreferences),
        activeDeviceCount: devices.length,
      });
    }

    if (req.method === 'PUT') {
      const nextPreferences = sanitizeNotificationPreferences({
        ...sanitizeNotificationPreferences(user.notificationPreferences),
        ...(req.body?.notificationPreferences || {}),
      });
      await User.updateOne(
        { _id: user._id },
        { $set: { notificationPreferences: nextPreferences } }
      );
      return res.status(200).json({ notificationPreferences: nextPreferences });
    }

    if (req.method === 'POST') {
      const devices = upsertNotificationDevice(user, req.body);
      const nextPreferences = sanitizeNotificationPreferences({
        ...sanitizeNotificationPreferences(user.notificationPreferences),
        browserPushEnabled: devices.some(device => device?.platform === 'web' && !device?.disabledAt),
      });
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            notificationDevices: devices,
            notificationPreferences: nextPreferences,
          },
        }
      );
      return res.status(200).json({
        notificationPreferences: nextPreferences,
        activeDeviceCount: devices.filter(device => !device?.disabledAt).length,
      });
    }

    const nextToken = String(req.body?.token || req.query?.token || '').trim();
    if (!nextToken) {
      return res.status(400).json({ error: 'A notification token is required.' });
    }

    const nextDevices = (Array.isArray(user.notificationDevices) ? user.notificationDevices : [])
      .filter(device => String(device?.token || '') !== nextToken);
    const nextPreferences = sanitizeNotificationPreferences({
      ...sanitizeNotificationPreferences(user.notificationPreferences),
      browserPushEnabled: nextDevices.some(device => device?.platform === 'web' && !device?.disabledAt),
    });

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          notificationDevices: nextDevices,
          notificationPreferences: nextPreferences,
        },
      }
    );

    return res.status(200).json({
      notificationPreferences: nextPreferences,
      activeDeviceCount: nextDevices.filter(device => !device?.disabledAt).length,
    });
  } catch (err) {
    console.error('Planner notifications API failed:', err);
    return res.status(500).json({ error: 'Failed to process notification settings.' });
  }
}

/******************************************************************************
 * /api/planner/internal/reminder-dispatch
 ******************************************************************************/

async function handlePlannerReminderDispatch(req, res) {
  setCacheControl(res, 'noStore');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!hasReminderDispatchAccess(req)) {
    return res.status(401).json({ error: 'Dispatch authorization failed.' });
  }

  try {
    await connectDb();
    const summary = await dispatchDueReminderJobs(req.body?.limit);
    return res.status(200).json(summary);
  } catch (err) {
    console.error('Planner reminder dispatch failed:', err);
    return res.status(500).json({ error: 'Failed to dispatch reminder jobs.' });
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

  if (route === 'rsvp-link') {
    return handlePlannerRsvpLink(req, res);
  }

  if (route === 'rsvp') {
    return handlePlannerRsvp(req, res);
  }

  if (route === 'collaborators') {
    return handlePlannerCollaborators(req, res);
  }

  if (route === 'notifications') {
    return handlePlannerNotifications(req, res);
  }

  if (route === 'reminder-dispatch') {
    return handlePlannerReminderDispatch(req, res);
  }

  res.setHeader('Allow', 'OPTIONS');
  return res.status(404).json({ error: 'Planner route not found.' });
}

module.exports = handler;
module.exports.handlePlannerAccess = handlePlannerAccess;
module.exports.handlePlannerCollaborators = handlePlannerCollaborators;
module.exports.handlePlannerMe = handlePlannerMe;
module.exports.handlePlannerNotifications = handlePlannerNotifications;
module.exports.handlePlannerPublic = handlePlannerPublic;
module.exports.handlePlannerReminderDispatch = handlePlannerReminderDispatch;
module.exports.handlePlannerRsvp = handlePlannerRsvp;
module.exports.handlePlannerRsvpLink = handlePlannerRsvpLink;
module.exports.getPlannerPublicCacheKey = getPlannerPublicCacheKey;
module.exports.getPublicWeddingData = getPublicWeddingData;
module.exports.refreshPlannerPublicSnapshots = refreshPlannerPublicSnapshots;
