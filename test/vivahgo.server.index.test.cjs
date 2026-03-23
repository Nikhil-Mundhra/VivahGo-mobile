const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadServerModule() {
  return import(`${toFileUrl(appPath('server/index.js'))}?t=${Date.now()}`);
}

describe('VivahGo/server/index.js', function () {
  it('exports sanitizer/helper functions with expected behavior', async function () {
    const mod = await loadServerModule();

    assert.deepEqual(mod.buildEmptyPlanner(), {
      wedding: { bride: '', groom: '', date: '', venue: '', guests: '', budget: '' },
      events: [],
      expenses: [],
      guests: [],
      vendors: [],
      tasks: [],
    });

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
    assert.deepEqual(sanitized.events, [{ id: 1 }]);
    assert.deepEqual(sanitized.tasks, [{ id: 2 }]);
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

  it('returns 500 for Google auth route when oauth client is not configured', async function () {
    const mod = await loadServerModule();
    const app = mod.createApp({ googleClientId: '', oauthClient: null, jwtSecret: 'test-secret' });

    const res = await request(app).post('/api/auth/google').send({ credential: 'cred' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Google auth is not configured on the server.');
  });

  it('handles Google auth success path and creates planner/user response', async function () {
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
    assert.deepEqual(res.body.planner.events, [{ id: 1 }]);
  });

  it('handles Google auth failures and incomplete payload branches', async function () {
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

  it('covers planner GET/PUT success plus error branches', async function () {
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
    assert.deepEqual(putRes.body.planner.events, [{ ok: true }]);

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
