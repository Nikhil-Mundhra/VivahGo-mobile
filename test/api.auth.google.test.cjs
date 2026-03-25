const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

const { connectDb, getUserModel, getPlannerModel } = require('../api/_lib/core');
const { createRes } = require('./helpers/testUtils.cjs');

const authHandler = require('../api/auth');
const { handleGoogleAuth: handler } = authHandler;

describe('api/auth.js -> google route', function () {
  // ── connectDb (cachedConnection is null here — must run before any DB mock) ──
  it('connectDb throws when MONGODB_URI is not set', async function () {
    const savedUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;

    await assert.rejects(connectDb(), { message: 'MONGODB_URI is required.' });

    if (savedUri !== undefined) process.env.MONGODB_URI = savedUri;
  });

  // ── Preflight ────────────────────────────────────────────────────────────────
  it('handles OPTIONS preflight with 204', async function () {
    const req = {
      method: 'OPTIONS',
      headers: { origin: 'https://example.com' },
      query: { route: 'google' },
    };
    const res = createRes();

    await authHandler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.ended, true);
  });

  it('returns 405 for methods other than POST', async function () {
    const req = { method: 'GET', headers: {}, body: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'POST, OPTIONS');
    assert.deepEqual(res.body, { error: 'Method not allowed.' });
  });

  it('returns 500 when GOOGLE_CLIENT_ID is missing', async function () {
    const oldId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const req = { method: 'POST', headers: {}, body: { credential: 'dummy' } };
    const res = createRes();

    await handler(req, res);

    if (oldId !== undefined) {
      process.env.GOOGLE_CLIENT_ID = oldId;
    }

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Google auth is not configured on the server.' });
  });

  it('returns 400 when credential is missing while config exists', async function () {
    const oldId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';

    const req = { method: 'POST', headers: {}, body: {} };
    const res = createRes();

    await handler(req, res);

    if (oldId !== undefined) {
      process.env.GOOGLE_CLIENT_ID = oldId;
    } else {
      delete process.env.GOOGLE_CLIENT_ID;
    }

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Missing Google credential.' });
  });

  // ── Mocked-DB paths ──────────────────────────────────────────────────────────
  // Strategy: register real Mongoose models (so the internal registry stays
  // intact), then replace only findOneAndUpdate on those instances. This avoids
  // the "Cannot read .schema of undefined" error that occurs when a plain object
  // is placed in mongoose.models.
  describe('with mocked DB and verifyIdToken', function () {
    let origConnect;
    let origVerify;
    let User;
    let Planner;
    let origUserFindOne;
    let origPlannerFindOne;

    before(function () {
      origConnect = mongoose.connect;
      origVerify = OAuth2Client.prototype.verifyIdToken;

      // Ensure models are registered so we can stub their methods.
      User = getUserModel();
      Planner = getPlannerModel();
      origUserFindOne = User.findOneAndUpdate;
      origPlannerFindOne = Planner.findOneAndUpdate;

      // Prevent real TCP connections during tests.
      mongoose.connect = async () => ({ connection: 'mocked' });

      process.env.MONGODB_URI = 'mongodb://fake/test';
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.JWT_SECRET = 'unit-test-secret';
    });

    afterEach(function () {
      // Restore DB stubs after every sub-test so they don't bleed.
      OAuth2Client.prototype.verifyIdToken = origVerify;
      User.findOneAndUpdate = origUserFindOne;
      Planner.findOneAndUpdate = origPlannerFindOne;
    });

    after(function () {
      mongoose.connect = origConnect;
      delete process.env.MONGODB_URI;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.JWT_SECRET;
    });

    it('returns 401 when verifyIdToken throws (invalid credential)', async function () {
      OAuth2Client.prototype.verifyIdToken = async () => {
        throw new Error('Invalid token signature');
      };

      const req = {
        method: 'POST',
        headers: {},
        body: { credential: 'bad.token.here' },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { error: 'Google sign-in could not be verified.' });
    });

    it('returns 400 when token payload is incomplete', async function () {
      OAuth2Client.prototype.verifyIdToken = async () => ({
        getPayload: () => ({ sub: 'g-123' }),  // missing email and name
      });

      const req = {
        method: 'POST',
        headers: {},
        body: { credential: 'some.token.here' },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { error: 'Google account details are incomplete.' });
    });

    it('returns 200 with token and planner on successful sign-in', async function () {
      OAuth2Client.prototype.verifyIdToken = async () => ({
        getPayload: () => ({
          sub: 'g-123',
          email: 'user@example.com',
          name: 'Test User',
          picture: 'https://example.com/pic.jpg',
        }),
      });

      User.findOneAndUpdate = async () => ({
        googleId: 'g-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      });

      Planner.findOneAndUpdate = async () => ({
        toObject: () => ({
          googleId: 'g-123',
          wedding: {},
          events: [],
          expenses: [],
          guests: [],
          vendors: [],
          tasks: [],
        }),
      });

      const req = {
        method: 'POST',
        headers: {},
        body: { credential: 'valid.token.here' },
      };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(typeof res.body.token, 'string');
      assert.equal(res.body.user.id, 'g-123');
      assert.ok(res.body.planner);
    });
  });
});
