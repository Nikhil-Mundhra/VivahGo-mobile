const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const handler = require('../api/planner/me');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'g-456', email: 'planner@test.com', name: 'Planner Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

function makePlannerDoc(overrides = {}) {
  return {
    toObject: () => ({
      googleId: 'g-456',
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

describe('api/planner/me.js', function () {
  // ── Preflight ────────────────────────────────────────────────────────────────
  it('handles OPTIONS preflight with 204', async function () {
    const req = { method: 'OPTIONS', headers: {} };
    const res = createRes();

    await handler(req, res);

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
    let Planner;
    let origFindOne;

    before(function () {
      const { getPlannerModel } = require('../api/_lib/core');
      Planner = getPlannerModel();
      origFindOne = Planner.findOneAndUpdate;
    });

    afterEach(function () {
      Planner.findOneAndUpdate = origFindOne;
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

      Planner.findOneAndUpdate = async () => ({
        toObject: () => ({ googleId: 'g-456', ...updatedPlanner }),
      });

      const req = {
        method: 'PUT',
        headers: { authorization: `Bearer ${makeToken()}` },
        body: { planner: updatedPlanner },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.planner.wedding.bride, 'Priya');
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
