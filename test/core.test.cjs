const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const {
  assignWeddingWebsiteSlugs,
  buildWeddingWebsiteBaseSlug,
  buildEmptyPlanner,
  createSessionToken,
  getPlannerModel,
  getUserModel,
  handlePreflight,
  sanitizePlanner,
  setCorsHeaders,
  verifySession,
} = require('../api/_lib/core');

describe('core helpers', function () {
  afterEach(function () {
    delete process.env.CLIENT_ORIGIN;
    delete process.env.JWT_SECRET;
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
          { id: 'plan_site', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-3', websiteSettings: { isActive: false, showCalendar: false } },
        ],
        activePlanId: 'plan_site',
      });

      assert.equal(result.marriages[0].websiteSlug, 'asha-rohan-3');
      assert.equal(result.marriages[0].websiteSettings.isActive, false);
      assert.equal(result.marriages[0].websiteSettings.showCalendar, false);
      assert.equal(result.marriages[0].websiteSettings.showCountdown, true);
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

    it('allows all origins when CLIENT_ORIGIN is unset', function () {
      const req = { headers: { origin: 'https://example.com' } };
      const res = createRes();

      setCorsHeaders(req, res);

      assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
      assert.equal(
        res.headers['Access-Control-Allow-Headers'],
        'Content-Type, Authorization'
      );
      assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, DELETE, OPTIONS');
      assert.equal(res.headers.Vary, undefined);
    });

    it('echoes allowed request origin and sets vary', function () {
      process.env.CLIENT_ORIGIN = 'https://allowed.com, https://also-allowed.com';
      const req = { headers: { origin: 'https://allowed.com' } };
      const res = createRes();

      setCorsHeaders(req, res);

      assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://allowed.com');
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

      assert.deepEqual(result, { error: 'Authentication required.' });
    });

    it('returns error for invalid token', function () {
      const result = verifySession({
        headers: { authorization: 'Bearer not-a-real-token' },
      });

      assert.deepEqual(result, { error: 'Session expired. Please sign in again.' });
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
    });

    it('returns a fresh copy each call (no shared references)', function () {
      const a = buildEmptyPlanner();
      const b = buildEmptyPlanner();
      a.events.push({ id: 1 });

      assert.equal(b.events.length, 0);
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
});
