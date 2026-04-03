const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');

const adminLibPath = require.resolve('../api/_lib/admin');
const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/admin');

describe('api/admin.js -> choice route', function () {
  const originalAdminLib = require(adminLibPath);
  const originalCore = require(corePath);

  afterEach(function () {
    require.cache[adminLibPath].exports = originalAdminLib;
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('returns generated Choice profiles for approved vendor categories', async function () {
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
            sort: () => ({
              lean: async () => ([]),
            }),
          }),
        }),
      }),
    };

    const { handleAdminChoice } = require(handlerPath);
    const req = { method: 'GET', headers: {} };
    const res = createRes();

    await handleAdminChoice(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body.choiceProfiles), true);
    assert.equal(res.body.choiceProfiles.length, 1);
    assert.equal(res.body.choiceProfiles[0].name, "VivahGo's Choice Photography");
    assert.equal(res.body.choiceProfiles[0].sourceVendorCount, 1);
    assert.deepEqual(res.body.choiceProfiles[0].aggregatedServices, ['Candid Photography', 'Wedding Videography']);
    assert.equal(res.body.choiceProfiles[0].selectedMedia.length, 1);
  });

  it('saves a Choice profile with selected vendor and admin-uploaded media', async function () {
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
        findOneAndUpdate: async (_query, update) => {
          savedUpdate = update.$set;
          return {
            _id: 'choice-1',
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
        type: 'Photography',
        name: "VivahGo's Choice Photography",
        description: 'Curated photographer shortlist',
        services: ['Candid Photography'],
        bundledServices: ['Wedding Videography'],
        phone: '919999999999',
        sourceVendorIds: ['vendor-1'],
        selectedMedia: [
          { sourceType: 'vendor', vendorId: 'vendor-1', sourceMediaId: 'vendor-media-1' },
          {
            sourceType: 'admin',
            key: 'vendors/editor-1/upload.jpg',
            url: 'https://media.vivahgo.com/portfolio/vendors/editor-1/upload.jpg',
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
    assert.deepEqual(savedUpdate.sourceVendorIds, ['vendor-1']);
    assert.equal(savedUpdate.selectedMedia.length, 2);
    assert.equal(savedUpdate.selectedMedia[0].vendorName, 'Open Lens');
    assert.equal(savedUpdate.selectedMedia[1].sourceType, 'admin');
    assert.equal(res.body.choiceProfile.id, 'choice-1');
    assert.equal(res.body.choiceProfile.mediaCount, 2);
    assert.equal(res.body.choiceProfile.sourceVendorCount, 1);
    assert.deepEqual(res.body.choiceProfile.budgetRange, { min: 70000, max: 120000 });
  });
});
