const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createRes } = require('./helpers/testUtils.cjs');

const { handlePlannerPublic: handler } = require('../api/planner');

describe('api/planner.js -> public route', function () {
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

  it('returns 405 for unsupported methods', async function () {
    const req = { method: 'POST', headers: {}, query: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { error: 'Method not allowed.' });
  });

  it('returns 400 when slug is missing', async function () {
    const req = { method: 'GET', headers: {}, query: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'A website slug is required.' });
  });

  it('returns public wedding data for a matching slug', async function () {
    const { getPlannerModel } = require('../api/_lib/core');
    const Planner = getPlannerModel();
    const originalFindOne = Planner.findOne;

    Planner.findOne = async () => ({
      googleId: 'owner-1',
      toObject: () => ({
        googleId: 'owner-1',
        activePlanId: 'plan_1',
        wedding: {},
        marriages: [
          { id: 'plan_1', bride: 'Asha', groom: 'Rohan', date: '12 Dec 2026', venue: 'Jaipur', websiteSlug: 'asha-rohan-1', websiteSettings: { isActive: true, showCountdown: false, showCalendar: true } },
          { id: 'plan_2', bride: 'Maya', groom: 'Arjun', date: '15 Dec 2026', venue: 'Delhi', websiteSlug: 'maya-arjun-1' },
        ],
        events: [
          { id: 1, name: 'Haldi', planId: 'plan_1', date: '10 Dec 2026', isPublicWebsiteVisible: true },
          { id: 3, name: 'Private Family Pooja', planId: 'plan_1', date: '09 Dec 2026', isPublicWebsiteVisible: false },
          { id: 2, name: 'Other', planId: 'plan_2', date: '11 Dec 2026' },
        ],
        expenses: [],
        guests: [],
        vendors: [],
        tasks: [],
      }),
    });

    try {
      const req = { method: 'GET', headers: {}, query: { slug: 'asha-rohan-1' } };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.plan.websiteSlug, 'asha-rohan-1');
      assert.equal(res.body.plan.websiteSettings.isActive, true);
      assert.equal(res.body.plan.websiteSettings.showCountdown, false);
      assert.equal(res.body.wedding.bride, 'Asha');
      assert.equal(res.body.events.length, 1);
      assert.equal(res.body.events[0].name, 'Haldi');
    } finally {
      Planner.findOne = originalFindOne;
    }
  });

  it('returns 404 for an inactive website', async function () {
    const { getPlannerModel } = require('../api/_lib/core');
    const Planner = getPlannerModel();
    const originalFindOne = Planner.findOne;

    Planner.findOne = async () => ({
      googleId: 'owner-1',
      toObject: () => ({
        googleId: 'owner-1',
        activePlanId: 'plan_1',
        wedding: {},
        marriages: [
          { id: 'plan_1', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-1', websiteSettings: { isActive: false } },
        ],
        events: [],
        expenses: [],
        guests: [],
        vendors: [],
        tasks: [],
      }),
    });

    try {
      const req = { method: 'GET', headers: {}, query: { slug: 'asha-rohan-1' } };
      const res = createRes();

      await handler(req, res);

      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.body, { error: 'Wedding website not found.' });
    } finally {
      Planner.findOne = originalFindOne;
    }
  });
});
