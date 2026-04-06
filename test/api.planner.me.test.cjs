const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { createRes } = require('./helpers/testUtils.cjs');

const plannerHandler = require('../api/planner');
const { handlePlannerMe: handler } = plannerHandler;

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'g-456', email: 'planner@test.com', name: 'Planner Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

function makePlannerDoc(overrides = {}) {
  return {
    plannerRevision: overrides.plannerRevision ?? 0,
    toObject: () => ({
      googleId: 'g-456',
      plannerRevision: overrides.plannerRevision ?? 0,
      wedding: {},
      events: [],
      expenses: [],
      guests: [],
      vendors: [],
      tasks: [],
      ...overrides,
    }),
  };
}

describe('api/planner.js -> me route', function () {
  let originalMongooseConnect;

  before(function () {
    originalMongooseConnect = mongoose.connect;
    mongoose.connect = async () => ({});
    process.env.MONGODB_URI = 'mongodb://example.test/vivahgo';
  });

  after(function () {
    mongoose.connect = originalMongooseConnect;
    delete process.env.MONGODB_URI;
  });

  // ── Preflight ────────────────────────────────────────────────────────────────
  it('handles OPTIONS preflight with 204', async function () {
    const req = { method: 'OPTIONS', headers: {}, query: { route: 'me' } };
    const res = createRes();

    await plannerHandler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.ended, true);
  });

  it('returns 405 for unsupported methods', async function () {
    const req = { method: 'POST', headers: {}, body: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET, PUT, OPTIONS');
    assert.deepEqual(res.body, { error: 'Method not allowed.' });
  });

  it('returns 401 when auth header is missing', async function () {
    const req = { method: 'GET', headers: {}, body: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Authentication required.' });
  });

  it('returns 401 when auth token is invalid', async function () {
    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer invalid' },
      body: {},
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, { error: 'Session expired. Please sign in again.' });
  });

  describe('with mocked Planner model', function () {
    let Planner, User;
    let origFindOneAndUpdate, origFind, origUserFindOne;

    before(function () {
      const { getPlannerModel, getUserModel } = require('../api/_lib/core');
      Planner = getPlannerModel();
      origFindOneAndUpdate = Planner.findOneAndUpdate;
      origFind = Planner.find;
      Planner.find = () => ({ lean: async () => [] });

      // Mock User.findOne so getSubscriptionTier returns immediately (no DB buffer timeout).
      // Returning null results in 'starter' tier; gate condition nextPlanCount > 1 is never
      // true in these tests so no request is blocked.
      User = getUserModel();
      origUserFindOne = User.findOne;
      User.findOne = () => ({ lean: async () => null });
    });

    afterEach(function () {
      Planner.findOneAndUpdate = origFindOneAndUpdate;
      Planner.find = () => ({ lean: async () => [] });
      User.findOne = () => ({ lean: async () => null });
    });

    after(function () {
      Planner.find = origFind;
      User.findOne = origUserFindOne;
    });

    it('GET returns 200 with sanitized planner for valid session', async function () {
      Planner.findOneAndUpdate = async () => makePlannerDoc({ wedding: { bride: 'Aarohi' } });

      const req = {
        method: 'GET',
        headers: { authorization: `Bearer ${makeToken()}` },
        body: {},
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.planner);
      assert.equal(res.body.planner.wedding.bride, 'Aarohi');
      assert.equal(res.body.plannerRevision, 0);
    });

    it('PUT returns 200 with updated planner for valid session', async function () {
      const updatedPlanner = {
        wedding: { bride: 'Priya', groom: 'Kabir', date: '', venue: '', guests: '', budget: '' },
        events: [],
        expenses: [],
        guests: [],
        vendors: [],
        tasks: [],
      };

      let callCount = 0;
      Planner.findOneAndUpdate = async () => {
        callCount += 1;
        if (callCount === 1) {
          return makePlannerDoc({ plannerRevision: 0 });
        }

        return {
          plannerRevision: 1,
          toObject: () => ({ googleId: 'g-456', plannerRevision: 1, ...updatedPlanner }),
        };
      };

      const req = {
        method: 'PUT',
        headers: { authorization: `Bearer ${makeToken()}` },
        body: { planner: updatedPlanner },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.planner.wedding.bride, 'Priya');
      assert.equal(res.body.plannerRevision, 1);
    });

    it('returns 409 when a stale baseRevision is submitted', async function () {
      let callCount = 0;
      Planner.findOneAndUpdate = async () => {
        callCount += 1;
        if (callCount === 1) {
          return makePlannerDoc({ plannerRevision: 3, wedding: { bride: 'Aarohi' } });
        }

        return null;
      };

      const req = {
        method: 'PUT',
        headers: { authorization: `Bearer ${makeToken()}` },
        body: {
          planner: {
            wedding: { bride: 'Priya', groom: 'Kabir', date: '', venue: '', guests: '', budget: '' },
            events: [],
            expenses: [],
            guests: [],
            vendors: [],
            tasks: [],
          },
          baseRevision: 1,
          correlationId: 'mutation-1',
          clientSequence: 2,
        },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, 'PLANNER_CONFLICT');
      assert.equal(res.body.plannerRevision, 3);
      assert.equal(res.body.correlationId, 'mutation-1');
      assert.equal(res.body.clientSequence, 2);
    });

    it('returns 500 when DB operation throws', async function () {
      Planner.findOneAndUpdate = async () => { throw new Error('DB error'); };

      const req = {
        method: 'GET',
        headers: { authorization: `Bearer ${makeToken()}` },
        body: {},
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, { error: 'Failed to process planner data.' });
    });
  });
});
