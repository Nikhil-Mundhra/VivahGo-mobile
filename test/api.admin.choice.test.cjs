const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');

const adminLibPath = require.resolve('../api/_lib/admin');
const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/admin');

describe('api/admin.js -> choice route', function () {
  const originalAdminLib = require(adminLibPath);
  const originalCore = require(corePath);

  afterEach(function () {
    originalCore.resetRateLimitBuckets();
    require.cache[adminLibPath].exports = originalAdminLib;
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('returns seeded Mongo-backed VCA profiles with static ids', async function () {
    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'admin@vivahgo.com', staffRole: 'viewer' },
        access: { role: 'viewer', canViewAdmin: true, canManageVendors: false },
      }),
    };

    require.cache[corePath].exports = {
      ...originalCore,
      getVendorModel: () => ({
        find: () => ({
          select: () => ({
            sort: () => ({
              lean: async () => ([
                {
                  _id: 'free-1',
                  googleId: 'free-1',
                  businessName: 'Open Lens',
                  type: 'Photography',
                  subType: 'Candid Photography',
                  bundledServices: ['Wedding Videography'],
                  isApproved: true,
                  tier: 'Free',
                  media: [
                    {
                      _id: 'vendor-media-1',
                      key: 'vendors/free-1/choice.jpg',
                      url: 'https://media.vivahgo.com/portfolio/vendors/free-1/choice.jpg',
                      type: 'IMAGE',
                      filename: 'choice.jpg',
                      isVisible: true,
                      isCover: true,
                      sortOrder: 0,
                    },
                  ],
                },
              ]),
            }),
          }),
        }),
      }),
      getChoiceProfileModel: () => ({
        find: () => ({
          select: () => ({
            lean: async () => ([]),
          }),
        }),
        findOneAndUpdate: async (_query, update) => ({
          ...update.$setOnInsert,
          ...update.$set,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T01:00:00.000Z',
        }),
      }),
    };

    const { handleAdminChoice } = require(handlerPath);
    const req = { method: 'GET', headers: {} };
    const res = createRes();

    await handleAdminChoice(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body.choiceProfiles), true);
    const photography = res.body.choiceProfiles.find(item => item.type === 'Photography');
    assert.ok(photography);
    assert.equal(photography.id, 'vca-photography');
    assert.equal(photography.name, "VivahGo's Choice Photography");
    assert.equal(photography.tier, 'Plus');
    assert.equal(photography.isApproved, true);
    assert.equal(photography.sourceVendorCount, 1);
    assert.deepEqual(photography.aggregatedServices, ['Candid Photography', 'Wedding Videography']);
    assert.equal(photography.selectedVendorMedia.length, 1);
    assert.equal(photography.media.length, 0);
  });

  it('saves a VCA profile with split vendor-selected and B2-owned media', async function () {
    let savedUpdate = null;

    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'editor@vivahgo.com', staffRole: 'editor' },
        access: { role: 'editor', canViewAdmin: true, canManageVendors: true },
      }),
    };

    require.cache[corePath].exports = {
      ...originalCore,
      getVendorModel: () => ({
        find: () => ({
          select: () => ({
            sort: () => ({
              lean: async () => ([
                {
                  _id: 'vendor-1',
                  googleId: 'vendor-1',
                  businessName: 'Open Lens',
                  type: 'Photography',
                  subType: 'Candid Photography',
                  bundledServices: ['Wedding Videography'],
                  budgetRange: { min: 70000, max: 120000 },
                  isApproved: true,
                  tier: 'Free',
                  media: [
                    {
                      _id: 'vendor-media-1',
                      key: 'vendors/vendor-1/choice.jpg',
                      url: 'https://media.vivahgo.com/portfolio/vendors/vendor-1/choice.jpg',
                      type: 'IMAGE',
                      filename: 'choice.jpg',
                      isVisible: true,
                      isCover: true,
                      sortOrder: 0,
                    },
                  ],
                },
              ]),
            }),
          }),
        }),
      }),
      getChoiceProfileModel: () => ({
        findOne: async () => null,
        findOneAndUpdate: async (_query, update) => {
          savedUpdate = update.$set;
          return {
            _id: 'vca-photography',
            ...savedUpdate,
            createdAt: '2026-04-03T00:00:00.000Z',
            updatedAt: '2026-04-03T01:00:00.000Z',
          };
        },
      }),
    };

    const { handleAdminChoice } = require(handlerPath);
    const req = {
      method: 'PATCH',
      headers: {},
      body: {
        id: 'vca-photography',
        type: 'Photography',
        businessName: "VivahGo's Choice Photography",
        name: "VivahGo's Choice Photography",
        description: 'Curated photographer shortlist',
        services: ['Candid Photography'],
        bundledServices: ['Wedding Videography'],
        phone: '919999999999',
        sourceVendorIds: ['vendor-1'],
        selectedVendorMedia: [
          { vendorId: 'vendor-1', sourceMediaId: 'vendor-media-1' },
        ],
        media: [
          {
            key: 'choice-media/vca-photography/upload.jpg',
            url: 'https://media.vivahgo.com/portfolio/choice-media/vca-photography/upload.jpg',
            type: 'IMAGE',
            filename: 'upload.jpg',
            size: 123,
            altText: 'Admin upload',
          },
        ],
      },
    };
    const res = createRes();

    await handleAdminChoice(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(savedUpdate);
    assert.equal(savedUpdate.type, 'Photography');
    assert.equal(savedUpdate.isApproved, true);
    assert.equal(savedUpdate.tier, 'Plus');
    assert.deepEqual(savedUpdate.sourceVendorIds, ['vendor-1']);
    assert.equal(savedUpdate.selectedVendorMedia.length, 1);
    assert.equal(savedUpdate.selectedVendorMedia[0].vendorName, 'Open Lens');
    assert.equal(savedUpdate.media.length, 1);
    assert.equal(savedUpdate.media[0].key, 'choice-media/vca-photography/upload.jpg');
    assert.equal(res.body.choiceProfile.id, 'vca-photography');
    assert.equal(res.body.choiceProfile.mediaCount, 2);
    assert.equal(res.body.choiceProfile.sourceVendorCount, 1);
    assert.deepEqual(res.body.choiceProfile.budgetRange, { min: 70000, max: 120000 });
  });

  it('rate limits repeated Choice profile updates from the same client IP', async function () {
    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'editor@vivahgo.com', staffRole: 'editor' },
        access: { role: 'editor', canViewAdmin: true, canManageVendors: true },
      }),
    };

    require.cache[corePath].exports = {
      ...originalCore,
      getVendorModel: () => ({
        find: () => ({
          select: () => ({
            sort: () => ({
              lean: async () => ([]),
            }),
          }),
        }),
      }),
      getChoiceProfileModel: () => ({
        findOne: async () => null,
        findOneAndUpdate: async (_query, update) => ({
          _id: 'vca-photography',
          ...update.$set,
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T01:00:00.000Z',
        }),
      }),
    };

    const { handleAdminChoice } = require(handlerPath);
    const makeReq = () => ({
      method: 'PATCH',
      headers: { 'x-real-ip': '203.0.113.45' },
      body: {
        id: 'vca-photography',
        type: 'Photography',
        businessName: "VivahGo's Choice Photography",
        name: "VivahGo's Choice Photography",
        sourceVendorIds: [],
        selectedVendorMedia: [],
        media: [],
      },
    });

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const res = createRes();
      await handleAdminChoice(makeReq(), res);
      assert.equal(res.statusCode, 200);
    }

    const limitedRes = createRes();
    await handleAdminChoice(makeReq(), limitedRes);

    assert.equal(limitedRes.statusCode, 429);
    assert.equal(limitedRes.headers['Retry-After'], '600');
    assert.deepEqual(limitedRes.body, { error: 'Too many Choice profile updates. Please try again shortly.' });
  });
});
