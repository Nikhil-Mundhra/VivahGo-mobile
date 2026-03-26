const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const Test = require('supertest/lib/test');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadServerModule() {
  return import(`${toFileUrl(appPath('server/index.js'))}?t=${Date.now()}`);
}

const originalHttpServerListen = http.Server.prototype.listen;
const originalNetServerListen = net.Server.prototype.listen;
const originalServerAddress = Test.prototype.serverAddress;
const itWithHttpServer = process.env.ALLOW_HTTP_SERVER_TESTS === 'true' ? it : it.skip;

describe('VivahGo/server/index.js', function () {
  before(function () {
    const patchedListen = function patchedListen(...args) {
      if (typeof args[0] === 'number' && args.length === 1) {
        return originalNetServerListen.call(this, args[0], '127.0.0.1');
      }
      if (typeof args[0] === 'number' && typeof args[1] === 'function') {
        return originalNetServerListen.call(this, args[0], '127.0.0.1', args[1]);
      }
      return originalNetServerListen.apply(this, args);
    };

    http.Server.prototype.listen = patchedListen;
    net.Server.prototype.listen = patchedListen;
    Test.prototype.serverAddress = function patchedServerAddress(app, path) {
      const addr = app.address();
      if (!addr) {
        this._server = app.listen(0, '127.0.0.1');
      }
      return `http://127.0.0.1:${app.address().port}${path}`;
    };
  });

  after(function () {
    http.Server.prototype.listen = originalHttpServerListen;
    net.Server.prototype.listen = originalNetServerListen;
    Test.prototype.serverAddress = originalServerAddress;
  });

  it('exports sanitizer/helper functions with expected behavior', async function () {
    const mod = await loadServerModule();

    const emptyPlanner = mod.buildEmptyPlanner();
    assert.equal(Array.isArray(emptyPlanner.marriages), true);
    assert.equal(emptyPlanner.marriages.length, 1);
    assert.ok(emptyPlanner.activePlanId);
    assert.deepEqual(emptyPlanner.wedding, { bride: '', groom: '', date: '', venue: '', guests: '', budget: '' });
    assert.deepEqual(emptyPlanner.events, []);
    assert.deepEqual(emptyPlanner.expenses, []);
    assert.deepEqual(emptyPlanner.guests, []);
    assert.deepEqual(emptyPlanner.vendors, []);
    assert.deepEqual(emptyPlanner.tasks, []);

    assert.equal(mod.isRecord({}), true);
    assert.equal(mod.isRecord([]), false);
    assert.equal(mod.isRecord(null), false);

    assert.deepEqual(mod.sanitizeCollection([{ ok: true }, null, 'x', { y: 1 }]), [{ ok: true }, { y: 1 }]);

    const sanitized = mod.sanitizePlanner({
      wedding: { bride: 'Aarohi' },
      events: [{ id: 1 }, null],
      tasks: ['bad', { id: 2 }],
    });

    assert.equal(sanitized.wedding.bride, 'Aarohi');
    assert.equal(sanitized.wedding.groom, '');
    assert.equal(sanitized.events.length, 1);
    assert.equal(sanitized.tasks.length, 1);
    assert.equal(sanitized.events[0].id, 1);
    assert.equal(sanitized.events[0].planId, sanitized.activePlanId);
    assert.equal(sanitized.tasks[0].id, 2);
    assert.equal(sanitized.tasks[0].planId, sanitized.activePlanId);

    const normalizedCollaborators = mod.sanitizePlanner(
      {
        marriages: [
          {
            id: 'plan-owner',
            collaborators: [
              { email: 'owner@test.com', role: 'owner' },
              { email: 'duplicate@test.com', role: 'owner' },
            ],
          },
        ],
        activePlanId: 'plan-owner',
      },
      { ownerEmail: 'owner@test.com', ownerId: 'owner-sub' }
    );
    const owners = normalizedCollaborators.marriages[0].collaborators.filter(item => item.role === 'owner');
    assert.equal(owners.length, 1);
    assert.equal(owners[0].email, 'owner@test.com');
    assert.equal(
      normalizedCollaborators.marriages[0].collaborators.find(item => item.email === 'duplicate@test.com').role,
      'viewer'
    );
  });

  it('parses client origins and signs/verifies session token', async function () {
    const mod = await loadServerModule();

    assert.equal(mod.getClientOrigins(undefined), true);
    assert.deepEqual(mod.getClientOrigins('https://a.com, https://b.com'), ['https://a.com', 'https://b.com']);

    const token = mod.createSessionToken(
      { googleId: 'gid-1', email: 'user@example.com', name: 'User' },
      'test-secret'
    );
    const payload = jwt.verify(token, 'test-secret');
    assert.equal(payload.sub, 'gid-1');
    assert.equal(payload.email, 'user@example.com');
  });

  it('auth middleware returns 401 for missing/invalid token and calls next for valid token', async function () {
    const mod = await loadServerModule();

    const resMissing = {
      code: null,
      body: null,
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    mod.authMiddleware({ headers: {} }, resMissing, () => {}, 'test-secret');
    assert.equal(resMissing.code, 401);
    assert.equal(resMissing.body.error, 'Authentication required.');

    const resInvalid = {
      code: null,
      body: null,
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    mod.authMiddleware({ headers: { authorization: 'Bearer invalid.token' } }, resInvalid, () => {}, 'test-secret');
    assert.equal(resInvalid.code, 401);

    const token = jwt.sign({ sub: 'gid-ok' }, 'test-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    let called = false;
    mod.authMiddleware(req, { status() { return this; }, json() { return this; } }, () => { called = true; }, 'test-secret');
    assert.equal(called, true);
    assert.equal(req.auth.sub, 'gid-ok');
  });

  itWithHttpServer('returns 500 for Google auth route when oauth client is not configured', async function () {
    const mod = await loadServerModule();
    const app = mod.createApp({ googleClientId: '', oauthClient: null, jwtSecret: 'test-secret' });

    const res = await request(app).post('/api/auth/google').send({ credential: 'cred' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Google auth is not configured on the server.');
  });

  itWithHttpServer('handles Google auth success path and creates planner/user response', async function () {
    const mod = await loadServerModule();

    const userDoc = {
      googleId: 'gid-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'pic',
    };
    const plannerDoc = {
      toObject() {
        return {
          wedding: { bride: 'Aarohi' },
          events: [{ id: 1 }, null],
          expenses: [],
          guests: [],
          vendors: [],
          tasks: [],
        };
      },
    };

    const UserModel = {
      async findOneAndUpdate() {
        return userDoc;
      },
    };
    const PlannerModel = {
      async findOneAndUpdate() {
        return plannerDoc;
      },
    };
    const oauthClient = {
      async verifyIdToken() {
        return {
          getPayload() {
            return {
              sub: 'gid-123',
              email: 'test@example.com',
              name: 'Test User',
              picture: 'pic',
            };
          },
        };
      },
    };

    const app = mod.createApp({
      googleClientId: 'google-client',
      jwtSecret: 'test-secret',
      oauthClient,
      UserModel,
      PlannerModel,
    });

    const res = await request(app).post('/api/auth/google').send({ credential: 'cred-ok' });
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.token === 'string');
    assert.equal(res.body.user.id, 'gid-123');
    assert.equal(res.body.planner.events.length, 1);
    assert.equal(res.body.planner.events[0].id, 1);
    assert.equal(typeof res.body.planner.events[0].planId, 'string');
  });

  itWithHttpServer('handles Google auth failures and incomplete payload branches', async function () {
    const mod = await loadServerModule();

    const oauthThrows = {
      async verifyIdToken() {
        throw new Error('bad-token');
      },
    };

    const appThrow = mod.createApp({
      googleClientId: 'google-client',
      jwtSecret: 'test-secret',
      oauthClient: oauthThrows,
      UserModel: { async findOneAndUpdate() { throw new Error('unexpected'); } },
      PlannerModel: { async findOneAndUpdate() { throw new Error('unexpected'); } },
    });

    const resThrow = await request(appThrow).post('/api/auth/google').send({ credential: 'cred' });
    assert.equal(resThrow.status, 401);

    const oauthIncomplete = {
      async verifyIdToken() {
        return {
          getPayload() {
            return { sub: 'gid-only' };
          },
        };
      },
    };

    const appIncomplete = mod.createApp({
      googleClientId: 'google-client',
      jwtSecret: 'test-secret',
      oauthClient: oauthIncomplete,
      UserModel: { async findOneAndUpdate() { throw new Error('unexpected'); } },
      PlannerModel: { async findOneAndUpdate() { throw new Error('unexpected'); } },
    });

    const resIncomplete = await request(appIncomplete).post('/api/auth/google').send({ credential: 'cred' });
    assert.equal(resIncomplete.status, 400);
    assert.equal(resIncomplete.body.error, 'Google account details are incomplete.');
  });

  itWithHttpServer('covers planner GET/PUT success plus error branches', async function () {
    const mod = await loadServerModule();

    let plannerShouldThrow = false;
    const PlannerModel = {
      async findOneAndUpdate(_query, update) {
        if (plannerShouldThrow) {
          throw new Error('db-failure');
        }
        if (update.$setOnInsert) {
          return {
            toObject() {
              return { wedding: {}, events: [], expenses: [], guests: [], vendors: [], tasks: [] };
            },
          };
        }
        return {
          toObject() {
            return {
              wedding: {},
              events: [{ ok: true }, 'bad'],
              expenses: [],
              guests: [],
              vendors: [],
              tasks: [],
            };
          },
        };
      },
    };

    const app = mod.createApp({
      googleClientId: 'google-client',
      jwtSecret: 'test-secret',
      oauthClient: null,
      UserModel: { async findOneAndUpdate() { throw new Error('unexpected'); } },
      PlannerModel,
    });

    const token = jwt.sign({ sub: 'gid-123' }, 'test-secret');

    const getRes = await request(app).get('/api/planner/me').set('Authorization', `Bearer ${token}`);
    assert.equal(getRes.status, 200);

    const putRes = await request(app)
      .put('/api/planner/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ planner: { events: [{ ok: true }, null] } });
    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.planner.events.length, 1);
    assert.equal(putRes.body.planner.events[0].ok, true);
    assert.equal(typeof putRes.body.planner.events[0].planId, 'string');

    plannerShouldThrow = true;
    const getErr = await request(app).get('/api/planner/me').set('Authorization', `Bearer ${token}`);
    assert.equal(getErr.status, 500);

    const putErr = await request(app)
      .put('/api/planner/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ planner: {} });
    assert.equal(putErr.status, 500);
  });
});
