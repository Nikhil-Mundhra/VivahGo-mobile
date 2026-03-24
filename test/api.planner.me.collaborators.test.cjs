const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { createRes } = require('./helpers/testUtils.cjs');
const { getPlannerModel, getUserModel } = require('../api/_lib/core');

const handler = require('../api/planner/me/collaborators');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'editor-sub', email: 'editor@test.com', name: 'Editor User', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

function makePlannerDoc(overrides = {}) {
  return {
    _id: 'planner-db-id',
    googleId: 'owner-sub',
    toObject: () => ({
      googleId: 'owner-sub',
      activePlanId: 'plan-1',
      marriages: [
        {
          id: 'plan-1',
          collaborators: [
            { email: 'owner@test.com', role: 'owner', addedBy: 'owner-sub' },
            { email: 'editor@test.com', role: 'editor', addedBy: 'owner-sub' },
            { email: 'viewer@test.com', role: 'viewer', addedBy: 'owner-sub' },
          ],
        },
      ],
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

describe('api/planner/me/collaborators.js', function () {
  let Planner, User;
  let origConnect;
  let origFindOne, origUserFindOne;
  let origFindOneAndUpdate;

  before(function () {
    origConnect = mongoose.connect;
    mongoose.connect = async () => ({ connection: 'mocked' });
    process.env.MONGODB_URI = 'mongodb://fake/test';

    Planner = getPlannerModel();
    origFindOne = Planner.findOne;
    origFindOneAndUpdate = Planner.findOneAndUpdate;

    // Mock User.findOne so the subscription gate treats all test users as premium
    User = getUserModel();
    origUserFindOne = User.findOne;
    User.findOne = () => ({ lean: async () => ({ subscriptionTier: 'premium', subscriptionStatus: 'active' }) });
  });

  afterEach(function () {
    Planner.findOne = origFindOne;
    Planner.findOneAndUpdate = origFindOneAndUpdate;
    User.findOne = () => ({ lean: async () => ({ subscriptionTier: 'premium', subscriptionStatus: 'active' }) });
  });

  after(function () {
    User.findOne = origUserFindOne;
    mongoose.connect = origConnect;
    delete process.env.MONGODB_URI;
  });

  it('allows editors to add viewer/editor collaborators', async function () {
    Planner.findOne = async () => makePlannerDoc();
    Planner.findOneAndUpdate = async (_filter, update) => ({
      toObject: () => ({
        ...makePlannerDoc().toObject(),
        marriages: update.$set.marriages,
      }),
    });

    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        plannerOwnerId: 'owner-sub',
        planId: 'plan-1',
        email: 'newperson@test.com',
        role: 'viewer',
      },
      query: {},
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.role, 'editor');
    assert.equal(
      res.body.collaborators.some(item => item.email === 'newperson@test.com' && item.role === 'viewer'),
      true
    );
  });

  it('prevents editors from changing collaborator roles', async function () {
    Planner.findOne = async () => makePlannerDoc();

    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        plannerOwnerId: 'owner-sub',
        planId: 'plan-1',
        email: 'editor@test.com',
        role: 'viewer',
      },
      query: {},
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'Editors can only add collaborators.' });
  });

  it('prevents assigning owner role on add', async function () {
    Planner.findOne = async () => makePlannerDoc();

    const req = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${makeToken({ sub: 'owner-sub', email: 'owner@test.com', name: 'Owner User' })}`,
      },
      body: {
        plannerOwnerId: 'owner-sub',
        planId: 'plan-1',
        email: 'another@test.com',
        role: 'owner',
      },
      query: {},
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Owner role cannot be assigned.' });
  });

  it('prevents assigning owner role on updates', async function () {
    Planner.findOne = async () => makePlannerDoc();

    const req = {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${makeToken({ sub: 'owner-sub', email: 'owner@test.com', name: 'Owner User' })}`,
      },
      body: {
        plannerOwnerId: 'owner-sub',
        planId: 'plan-1',
        email: 'viewer@test.com',
        role: 'owner',
      },
      query: {},
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Owner role cannot be assigned.' });
  });
});
