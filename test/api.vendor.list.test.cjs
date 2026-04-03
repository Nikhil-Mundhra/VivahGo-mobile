const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/vendor');

describe('api/vendor.js -> list route', function () {
  const originalCore = require(corePath);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('returns plus vendors individually and aggregates free vendors into Choice profiles', async function () {
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getVendorModel: () => ({
        find: () => ({
          select: () => ({
            lean: async () => ([
              {
                _id: 'plus-1',
                googleId: 'plus-1',
                businessName: 'Elite Photos',
                type: 'Photography',
                subType: '',
                bundledServices: ['Wedding Videography'],
                description: 'Premium photography team',
                city: 'Delhi',
                state: 'Delhi',
                country: 'India',
                phone: '9876543210',
                budgetRange: { min: 180000, max: 320000 },
                availabilitySettings: { hasDefaultCapacity: true, defaultMaxCapacity: 2, dateOverrides: [] },
                isApproved: true,
                tier: 'Plus',
                coverageAreas: [],
                media: [
                  {
                    _id: 'media-plus-1',
                    key: 'vendors/plus-1/cover.jpg',
                    url: 'https://media.vivahgo.com/portfolio/vendors/plus-1/cover.jpg',
                    type: 'IMAGE',
                    filename: 'cover.jpg',
                    isVisible: true,
                    isCover: true,
                    sortOrder: 0,
                  },
                ],
              },
              {
                _id: 'free-1',
                googleId: 'free-1',
                businessName: 'Open Lens',
                type: 'Photography',
                subType: 'Candid Photography',
                bundledServices: ['Wedding Videography'],
                description: 'Flexible wedding shoots',
                city: 'Jaipur',
                state: 'Rajasthan',
                country: 'India',
                phone: '9123456780',
                budgetRange: { min: 70000, max: 120000 },
                isApproved: true,
                tier: 'Free',
                coverageAreas: [],
                media: [
                  {
                    _id: 'media-free-1',
                    key: 'vendors/free-1/sample.jpg',
                    url: 'https://media.vivahgo.com/portfolio/vendors/free-1/sample.jpg',
                    type: 'IMAGE',
                    filename: 'sample.jpg',
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
      getChoiceProfileModel: () => ({
        find: () => ({
          select: () => ({
            lean: async () => ([]),
          }),
        }),
      }),
    };

    const handler = require(handlerPath);
    const req = { method: 'GET', query: { route: 'list' }, headers: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body.vendors), true);
    assert.equal(res.body.vendors.length, 2);

    const plusVendor = res.body.vendors.find(item => item.id === 'db_plus-1');
    const choiceProfile = res.body.vendors.find(item => item.isChoiceProfile);

    assert.ok(plusVendor);
    assert.ok(choiceProfile);
    assert.equal(res.body.vendors.some(item => item.name === 'Open Lens'), false);
    assert.equal(plusVendor.whatsappNumber, '919876543210');
    assert.equal(choiceProfile.name, "VivahGo's Choice Photography");
    assert.deepEqual(choiceProfile.budgetRange, { min: 70000, max: 120000 });
    assert.equal(choiceProfile.media.length, 1);
    assert.equal(choiceProfile.media[0].url, 'https://media.vivahgo.com/portfolio/vendors/free-1/sample.jpg');
  });
});
