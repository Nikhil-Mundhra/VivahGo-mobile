const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const {
  applyRateLimit,
  assignWeddingWebsiteSlugs,
  buildWeddingWebsiteBaseSlug,
  buildEmptyPlanner,
  createGuestRsvpToken,
  createSessionToken,
  ensureCsrfToken,
  getPlannerModel,
  getBillingReceiptModel,
  getUserModel,
  handlePreflight,
  requireCsrfProtection,
  resetRateLimitBuckets,
  resolveStaffRole,
  sanitizePlanner,
  setCorsHeaders,
  verifyGuestRsvpToken,
  verifySession,
} = require('../api/_lib/core');

describe('core helpers', function () {
  afterEach(function () {
    delete process.env.CLIENT_ORIGIN;
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.RSVP_TOKEN_SECRET;
    resetRateLimitBuckets();
  });

  describe('sanitizePlanner', function () {
    it('normalizes payload shape and filters invalid collection items', function () {
      const payload = {
        wedding: { bride: 'Asha', unknown: 'keep' },
        events: [{ title: 'Sangeet' }, null, 'bad', { date: '2026-03-22' }],
        expenses: 'not-an-array',
        guests: [123, { name: 'Rahul' }],
        vendors: [{ id: 1 }, []],
        tasks: [false, { task: 'Book venue' }],
      };

      const result = sanitizePlanner(payload);

      assert.ok(result.activePlanId);
      assert.equal(result.marriages.length, 1);
      assert.deepEqual(result.wedding, {
        bride: 'Asha',
        groom: '',
        date: '',
        venue: '',
        guests: '',
        budget: '',
        unknown: 'keep',
      });
      assert.deepEqual(result.events, [
        { title: 'Sangeet', planId: result.activePlanId },
        { date: '2026-03-22', planId: result.activePlanId },
      ]);
      assert.deepEqual(result.expenses, []);
      assert.deepEqual(result.guests, [{ name: 'Rahul', planId: result.activePlanId }]);
      assert.deepEqual(result.vendors, [{ id: 1, planId: result.activePlanId }]);
      assert.deepEqual(result.tasks, [{ task: 'Book venue', planId: result.activePlanId }]);
    });

    it('returns defaults for missing payload', function () {
      const result = sanitizePlanner();

      assert.deepEqual(result.wedding, {
        bride: '',
        groom: '',
        date: '',
        venue: '',
        guests: '',
        budget: '',
      });
      assert.deepEqual(result.events, []);
      assert.deepEqual(result.expenses, []);
      assert.deepEqual(result.guests, []);
      assert.deepEqual(result.vendors, []);
      assert.deepEqual(result.tasks, []);
      assert.ok(result.activePlanId);
      assert.equal(result.marriages.length, 1);
    });

    it('keeps valid plan IDs and migrates missing plan IDs to active plan', function () {
      const result = sanitizePlanner({
        marriages: [
          { id: 'plan_a', bride: 'A', groom: 'B' },
          { id: 'plan_b', bride: 'C', groom: 'D' },
        ],
        activePlanId: 'plan_b',
        events: [{ id: 1 }, { id: 2, planId: 'plan_a' }],
      });

      assert.equal(result.activePlanId, 'plan_b');
      assert.equal(result.events.length, 2);
      assert.equal(result.events.find(event => event.id === 1).planId, 'plan_b');
      assert.equal(result.events.find(event => event.id === 2).planId, 'plan_a');
    });

    it('enforces a single owner in collaborators during normalization', function () {
      const result = sanitizePlanner(
        {
          marriages: [
            {
              id: 'plan_owner',
              collaborators: [
                { email: 'owner@test.com', role: 'owner' },
                { email: 'other@test.com', role: 'owner' },
              ],
            },
          ],
          activePlanId: 'plan_owner',
        },
        { ownerEmail: 'owner@test.com', ownerId: 'owner-sub' }
      );

      const collaborators = result.marriages[0].collaborators;
      const owners = collaborators.filter(item => item.role === 'owner');
      assert.equal(owners.length, 1);
      assert.equal(owners[0].email, 'owner@test.com');
      assert.equal(collaborators.find(item => item.email === 'other@test.com').role, 'viewer');
    });

    it('preserves websiteSlug on marriages', function () {
      const result = sanitizePlanner({
        marriages: [
          { id: 'plan_site', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-3', websiteSettings: { isActive: false, showCalendar: false, theme: 'midnight-navy' } },
        ],
        activePlanId: 'plan_site',
      });

      assert.equal(result.marriages[0].websiteSlug, 'asha-rohan-3');
      assert.equal(result.marriages[0].websiteSettings.isActive, false);
      assert.equal(result.marriages[0].websiteSettings.showCalendar, false);
      assert.equal(result.marriages[0].websiteSettings.showCountdown, true);
      assert.equal(result.marriages[0].websiteSettings.theme, 'midnight-navy');
      assert.equal(result.marriages[0].websiteSettings.scheduleTitle, 'Wedding Calendar');
    });

    it('normalizes per-plan reminder settings', function () {
      const result = sanitizePlanner({
        marriages: [
          {
            id: 'plan_reminders',
            reminderSettings: {
              enabled: true,
              eventDayBefore: false,
              paymentDayOf: false,
            },
          },
        ],
        activePlanId: 'plan_reminders',
      });

      assert.deepEqual(result.marriages[0].reminderSettings, {
        enabled: true,
        eventDayBefore: false,
        eventHoursBefore: true,
        paymentThreeDaysBefore: true,
        paymentDayOf: false,
      });
    });

    it('keeps normalized custom templates on the planner', function () {
      const result = sanitizePlanner({
        customTemplates: [
          {
            id: 'custom_template_a',
            name: 'Planner Signature',
            culture: 'Custom',
            emoji: '✨',
            events: [{ name: 'Family Brunch', emoji: '🍽️' }],
          },
        ],
      });

      assert.equal(result.customTemplates.length, 1);
      assert.equal(result.customTemplates[0].name, 'Planner Signature');
      assert.equal(result.customTemplates[0].eventCount, 1);
    });
  });

  describe('wedding website slug helpers', function () {
    it('builds a stable base slug from bride and groom names', function () {
      assert.equal(buildWeddingWebsiteBaseSlug({ bride: 'Asha ', groom: 'Rohan Malhotra' }), 'asha-rohan-malhotra');
      assert.equal(buildWeddingWebsiteBaseSlug({ bride: '', groom: '' }), 'our-wedding');
    });

    it('assigns unique slug counters while preserving a free existing slug', async function () {
      const planner = {
        marriages: [
          { id: 'plan_a', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-3' },
          { id: 'plan_b', bride: 'Asha', groom: 'Rohan', websiteSlug: '' },
        ],
      };
      const PlannerModel = {
        find() {
          return {
            lean: async () => ([
              { googleId: 'other-owner', marriages: [{ id: 'other-plan', websiteSlug: 'asha-rohan-1' }] },
              { googleId: 'other-owner-2', marriages: [{ id: 'other-plan-2', websiteSlug: 'asha-rohan-2' }] },
            ]),
          };
        },
      };

      const result = await assignWeddingWebsiteSlugs(planner, PlannerModel, 'owner-1');

      assert.equal(result.marriages[0].websiteSlug, 'asha-rohan-3');
      assert.equal(result.marriages[1].websiteSlug, 'asha-rohan-4');
    });
  });

  describe('setCorsHeaders', function () {
    function createRes() {
      const headers = {};
      return {
        headers,
        setHeader(name, value) {
          headers[name] = value;
        },
      };
    }

    it('reflects request origin and enables credentials when CLIENT_ORIGIN is unset', function () {
      const req = { headers: { origin: 'https://example.com' } };
      const res = createRes();

      setCorsHeaders(req, res);

      assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://example.com');
      assert.equal(res.headers['Access-Control-Allow-Credentials'], 'true');
      assert.equal(
        res.headers['Access-Control-Allow-Headers'],
        'Content-Type, Authorization, X-CSRF-Token'
      );
      assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
      assert.equal(res.headers['X-Frame-Options'], 'SAMEORIGIN');
      assert.equal(res.headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
      assert.equal(res.headers.Vary, 'Origin');
    });

    it('echoes allowed request origin and sets vary', function () {
      process.env.CLIENT_ORIGIN = 'https://allowed.com, https://also-allowed.com';
      const req = { headers: { origin: 'https://allowed.com', 'x-forwarded-proto': 'https' } };
      const res = createRes();

      setCorsHeaders(req, res);

      assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://allowed.com');
      assert.equal(res.headers['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains; preload');
      assert.equal(res.headers.Vary, 'Origin');
    });

    it('does not set Access-Control-Allow-Origin for disallowed origins', function () {
      process.env.CLIENT_ORIGIN = 'https://allowed.com';
      const req = { headers: { origin: 'https://blocked.com' } };
      const res = createRes();

      setCorsHeaders(req, res);

      assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
      assert.equal(res.headers.Vary, undefined);
    });
  });

  describe('handlePreflight', function () {
    it('responds with 204 and returns true for OPTIONS requests', function () {
      const req = { method: 'OPTIONS', headers: {} };
      const res = {
        statusCode: null,
        ended: false,
        headers: {},
        setHeader(name, value) {
          this.headers[name] = value;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        end() {
          this.ended = true;
        },
      };

      const handled = handlePreflight(req, res);

      assert.equal(handled, true);
      assert.equal(res.statusCode, 204);
      assert.equal(res.ended, true);
    });

    it('returns false for non-OPTIONS methods', function () {
      const req = { method: 'GET', headers: {} };
      const res = {
        setHeader() {},
        status() {
          return this;
        },
        end() {},
      };

      const handled = handlePreflight(req, res);

      assert.equal(handled, false);
    });
  });

  describe('verifySession / createSessionToken', function () {
    it('returns error when bearer token is missing', function () {
      const result = verifySession({ headers: {} });

      assert.deepEqual(result, { status: 401, error: 'Authentication required.' });
    });

    it('accepts the session token from an httpOnly cookie when no bearer token is present', function () {
      process.env.JWT_SECRET = 'unit-test-secret';
      const token = createSessionToken({
        googleId: 'cookie-user',
        email: 'cookie@example.com',
        name: 'Cookie User',
      });

      const result = verifySession({
        headers: { cookie: `vivahgo_session=${encodeURIComponent(token)}` },
      });

      assert.equal(result.auth.sub, 'cookie-user');
      assert.equal(result.auth.email, 'cookie@example.com');
    });

    it('returns error for invalid token', function () {
      const result = verifySession({
        headers: { authorization: 'Bearer not-a-real-token' },
      });

      assert.deepEqual(result, { status: 401, error: 'Session expired. Please sign in again.' });
    });

    it('returns a server configuration error in production when JWT_SECRET is missing', function () {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const result = verifySession({
        headers: { authorization: 'Bearer whatever' },
      });

      assert.deepEqual(result, { status: 500, error: 'Server auth is not configured.' });
    });

    it('creates and verifies a valid session token', function () {
      process.env.JWT_SECRET = 'unit-test-secret';
      const user = {
        googleId: 'google-user-123',
        email: 'user@example.com',
        name: 'Test User',
      };

      const token = createSessionToken(user);
      const result = verifySession({
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(typeof token, 'string');
      assert.equal(typeof result.auth, 'object');
      assert.equal(result.auth.sub, user.googleId);
      assert.equal(result.auth.email, user.email);
      assert.equal(result.auth.name, user.name);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.sub, user.googleId);
    });
  });

  describe('CSRF helpers', function () {
    function createMutableRes() {
      return {
        headers: {},
        statusCode: null,
        body: null,
        setHeader(name, value) {
          this.headers[name] = value;
        },
        getHeader(name) {
          return this.headers[name];
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
    }

    it('issues a readable CSRF cookie when requested', function () {
      const req = { headers: {} };
      const res = createMutableRes();

      const token = ensureCsrfToken(req, res);

      assert.match(token, /^[a-f0-9]{64}$/);
      assert.match(String(res.headers['Set-Cookie']), /vivahgo_csrf=/);
      assert.doesNotMatch(String(res.headers['Set-Cookie']), /HttpOnly/);
    });

    it('rejects mutating cookie-auth requests that omit the CSRF token', function () {
      const req = { method: 'POST', headers: {} };
      const res = createMutableRes();

      const blocked = requireCsrfProtection(req, res);

      assert.equal(blocked, true);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { error: 'CSRF token required.', code: 'CSRF_REQUIRED' });
    });

    it('allows mutating requests with matching CSRF cookie and header', function () {
      const req = {
        method: 'POST',
        headers: {
          cookie: 'vivahgo_csrf=csrf-token-123',
          'x-csrf-token': 'csrf-token-123',
        },
      };
      const res = createMutableRes();

      const blocked = requireCsrfProtection(req, res);

      assert.equal(blocked, false);
      assert.equal(res.statusCode, null);
    });

    it('skips CSRF enforcement for explicit bearer-token requests', function () {
      const req = {
        method: 'POST',
        headers: {
          authorization: 'Bearer signed-token',
        },
      };
      const res = createMutableRes();

      const blocked = requireCsrfProtection(req, res);

      assert.equal(blocked, false);
      assert.equal(res.statusCode, null);
    });
  });

  describe('applyRateLimit', function () {
    it('blocks requests that exceed the configured threshold and sets retry headers', function () {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      };
      const firstRes = {
        headers: {},
        statusCode: null,
        body: null,
        setHeader(name, value) {
          this.headers[name] = value;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
      const secondRes = {
        headers: {},
        statusCode: null,
        body: null,
        setHeader(name, value) {
          this.headers[name] = value;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };

      const firstLimited = applyRateLimit(req, firstRes, 'test:route', { windowMs: 60_000, max: 1 });
      const secondLimited = applyRateLimit(req, secondRes, 'test:route', { windowMs: 60_000, max: 1 });

      assert.equal(firstLimited, false);
      assert.equal(secondLimited, true);
      assert.equal(secondRes.statusCode, 429);
      assert.equal(secondRes.headers['Retry-After'], '60');
      assert.deepEqual(secondRes.body, { error: 'Too many requests. Please try again shortly.' });
    });
  });

  describe('buildEmptyPlanner', function () {
    it('returns a planner with empty wedding fields and empty arrays', function () {
      const result = buildEmptyPlanner();

      assert.deepEqual(result.wedding, {
        bride: '',
        groom: '',
        date: '',
        venue: '',
        guests: '',
        budget: '',
      });
      assert.deepEqual(result.events, []);
      assert.deepEqual(result.expenses, []);
      assert.deepEqual(result.guests, []);
      assert.deepEqual(result.vendors, []);
      assert.deepEqual(result.tasks, []);
      assert.deepEqual(result.marriages[0].reminderSettings, {
        enabled: false,
        eventDayBefore: true,
        eventHoursBefore: true,
        paymentThreeDaysBefore: true,
        paymentDayOf: true,
      });
    });

    it('returns a fresh copy each call (no shared references)', function () {
      const a = buildEmptyPlanner();
      const b = buildEmptyPlanner();
      a.events.push({ id: 1 });

      assert.equal(b.events.length, 0);
    });
  });

  describe('staff role resolution', function () {
    it('treats a quoted ADMIN_OWNER_EMAIL as the bootstrap owner', function () {
      process.env.ADMIN_OWNER_EMAIL = '"nikhilmundhra28@gmail.com"';

      assert.equal(resolveStaffRole('nikhilmundhra28@gmail.com', 'none'), 'owner');
    });
  });

  describe('guest RSVP tokens', function () {
    it('creates and verifies a valid guest RSVP token', function () {
      process.env.RSVP_TOKEN_SECRET = 'rsvp-unit-secret';

      const token = createGuestRsvpToken({
        ownerId: 'owner-1',
        guestId: 'guest-1',
        version: 2,
        expiresInDays: 30,
      });
      const payload = verifyGuestRsvpToken(token);

      assert.equal(payload.ownerId, 'owner-1');
      assert.equal(payload.guestId, 'guest-1');
      assert.equal(payload.version, 2);
      assert.ok(payload.exp > Date.now());
      assert.ok(token.length < 64, `expected compact RSVP token, got length ${token.length}`);
    });

    it('rejects tampered guest RSVP tokens', function () {
      process.env.RSVP_TOKEN_SECRET = 'rsvp-unit-secret';

      const token = createGuestRsvpToken({
        ownerId: 'owner-1',
        guestId: 'guest-1',
      });
      const parts = token.split('.');
      const tamperedToken = `${parts.slice(0, -1).join('.')}x.${parts.at(-1)}`;

      assert.throws(() => verifyGuestRsvpToken(tamperedToken), /Invalid RSVP token/);
    });
  });

  describe('getUserModel', function () {
    it('returns a mongoose model with expected schema paths', function () {
      const User = getUserModel();

      assert.equal(typeof User, 'function');
      assert.ok(User.schema.path('googleId'), 'googleId path missing');
      assert.ok(User.schema.path('email'), 'email path missing');
      assert.ok(User.schema.path('name'), 'name path missing');
      assert.ok(User.schema.path('picture'), 'picture path missing');
    });

    it('returns the same model on repeated calls (cached)', function () {
      const first = getUserModel();
      const second = getUserModel();

      assert.equal(first, second);
    });
  });

  describe('getPlannerModel', function () {
    it('returns a mongoose model with expected schema paths', function () {
      const Planner = getPlannerModel();

      assert.equal(typeof Planner, 'function');
      assert.ok(Planner.schema.path('googleId'), 'googleId path missing');
      assert.ok(Planner.schema.path('wedding'), 'wedding path missing');
      assert.ok(Planner.schema.path('events'), 'events path missing');
      assert.ok(Planner.schema.path('tasks'), 'tasks path missing');
    });

    it('returns the same model on repeated calls (cached)', function () {
      const first = getPlannerModel();
      const second = getPlannerModel();

      assert.equal(first, second);
    });
  });

  describe('getBillingReceiptModel', function () {
    it('returns a mongoose model with expected schema paths', function () {
      const BillingReceipt = getBillingReceiptModel();

      assert.equal(typeof BillingReceipt, 'function');
      assert.ok(BillingReceipt.schema.path('googleId'));
      assert.ok(BillingReceipt.schema.path('receiptNumber'));
      assert.ok(BillingReceipt.schema.path('plan'));
      assert.ok(BillingReceipt.schema.path('amount'));
    });
  });
});
