const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createRes } = require('./helpers/testUtils.cjs');

const plannerModule = require('../api/planner');
const { handlePlannerPublic: handler, refreshPlannerPublicSnapshots } = plannerModule;
const { resetPublicCache, getPublicCache } = require('../api/_lib/core');

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

  afterEach(function () {
    resetPublicCache();
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
      assert.equal(res.headers['Cache-Control'], 'public, s-maxage=60, stale-while-revalidate=600');
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

  it('serves a cached public wedding payload on a repeated request', async function () {
    const { getPlannerModel } = require('../api/_lib/core');
    const Planner = getPlannerModel();
    const originalFindOne = Planner.findOne;
    let reads = 0;

    Planner.findOne = async () => {
      reads += 1;
      return {
        googleId: 'owner-1',
        toObject: () => ({
          googleId: 'owner-1',
          activePlanId: 'plan_1',
          wedding: {},
          marriages: [
            { id: 'plan_1', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-1', websiteSettings: { isActive: true } },
          ],
          events: [],
          expenses: [],
          guests: [],
          vendors: [],
          tasks: [],
        }),
      };
    };

    try {
      const req = { method: 'GET', headers: {}, query: { slug: 'asha-rohan-1' } };
      const firstRes = createRes();
      const secondRes = createRes();

      await handler(req, firstRes);
      assert.deepEqual(getPublicCache('planner-public:asha-rohan-1')?.value, firstRes.body);

      Planner.findOne = async () => {
        throw new Error('should have used cached public planner payload');
      };

      await handler(req, secondRes);

      assert.equal(secondRes.statusCode, 200);
      assert.deepEqual(secondRes.body, firstRes.body);
      assert.equal(reads, 1);
    } finally {
      Planner.findOne = originalFindOne;
    }
  });

  it('refreshes public planner snapshots when wedding website slugs change', function () {
    refreshPlannerPublicSnapshots(
      {
        wedding: {},
        events: [],
        marriages: [
          { id: 'plan_2', bride: 'Maya', groom: 'Arjun', websiteSlug: 'maya-arjun-1', websiteSettings: { isActive: true } },
        ],
      },
      {
        wedding: {},
        events: [],
        marriages: [
          { id: 'plan_1', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-1', websiteSettings: { isActive: true } },
        ],
      }
    );

    assert.equal(getPublicCache('planner-public:asha-rohan-1'), null);
    assert.equal(getPublicCache('planner-public:maya-arjun-1')?.value.plan.websiteSlug, 'maya-arjun-1');
  });
});
