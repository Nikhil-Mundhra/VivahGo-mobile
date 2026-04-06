const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/vendor');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'vendor-123', email: 'vendor@test.com', name: 'Vendor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/vendor.js -> me route', function () {
  const originalCore = require(corePath);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('rejects unsafe website URLs during vendor profile creation', async function () {
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getUserModel: () => ({
        findOneAndUpdate: async () => {
          throw new Error('Should not update user for invalid input.');
        },
      }),
      getVendorModel: () => ({
        findOne: async () => null,
        create: async () => {
          throw new Error('Should not create vendor for invalid input.');
        },
      }),
    };

    const { handleVendorMe: handler } = require(handlerPath);
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        businessName: 'Lotus Events',
        type: 'Venue',
        subType: 'Hotels',
        website: 'javascript:alert(1)',
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'website and googleMapsLink must start with http:// or https://.' });
  });

  it('rejects invalid default capacity during vendor profile creation', async function () {
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getUserModel: () => ({
        findOneAndUpdate: async () => {
          throw new Error('Should not update user for invalid input.');
        },
      }),
      getVendorModel: () => ({
        findOne: () => ({
          lean: async () => null,
        }),
        create: async () => {
          throw new Error('Should not create vendor for invalid availability settings.');
        },
      }),
    };

    const { handleVendorMe: handler } = require(handlerPath);
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        businessName: 'Lotus Events',
        type: 'Venue',
        subType: 'Hotels',
        budgetRange: {
          min: 100000,
          max: 200000,
        },
        availabilitySettings: {
          defaultMaxCapacity: 0,
        },
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      error: 'availabilitySettings.defaultMaxCapacity must be between 1 and 99.',
    });
  });

  it('stores sorted day overrides when vendor availability is updated', async function () {
    let savedAvailability = null;
    let updateQuery = null;

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getUserModel: () => ({
        findOneAndUpdate: async () => null,
      }),
      getVendorModel: () => ({
        findOne: () => ({
          lean: async () => ({
            googleId: 'vendor-123',
            type: 'Venue',
            bundledServices: [],
            vendorRevision: 2,
          }),
        }),
        findOneAndUpdate: async (_query, update) => {
          updateQuery = _query;
          savedAvailability = update.$set.availabilitySettings;
          return {
            googleId: 'vendor-123',
            businessName: 'Lotus Events',
            type: 'Venue',
            bundledServices: [],
            vendorRevision: 3,
            verificationDocuments: [],
            verificationStatus: 'not_submitted',
            availabilitySettings: savedAvailability,
          };
        },
      }),
    };

    const { handleVendorMe: handler } = require(handlerPath);
    const req = {
      method: 'PATCH',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        baseRevision: 2,
        correlationId: 'vendor-mutation-1',
        clientSequence: 4,
        availabilitySettings: {
          hasDefaultCapacity: true,
          defaultMaxCapacity: 3,
          dateOverrides: [
            { date: '2026-06-10', maxCapacity: 0, bookingsCount: 2 },
            { date: '2026-05-01', maxCapacity: 5, bookingsCount: 8 },
          ],
        },
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(updateQuery.vendorRevision, 2);
    assert.deepEqual(savedAvailability, {
      hasDefaultCapacity: true,
      defaultMaxCapacity: 3,
      dateOverrides: [
        { date: '2026-05-01', maxCapacity: 5, bookingsCount: 5 },
        { date: '2026-06-10', maxCapacity: 0, bookingsCount: 0 },
      ],
    });
    assert.deepEqual(res.body.vendor.availabilitySettings, savedAvailability);
    assert.equal(res.body.vendorRevision, 3);
    assert.equal(res.body.correlationId, 'vendor-mutation-1');
    assert.equal(res.body.clientSequence, 4);
  });

  it('returns 409 when a stale vendor baseRevision is submitted', async function () {
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getUserModel: () => ({
        findOneAndUpdate: async () => null,
      }),
      getVendorModel: () => ({
        findOne: () => ({
          lean: async () => ({
            googleId: 'vendor-123',
            type: 'Venue',
            bundledServices: [],
            vendorRevision: 5,
          }),
        }),
      }),
    };

    const { handleVendorMe: handler } = require(handlerPath);
    const req = {
      method: 'PATCH',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        baseRevision: 4,
        correlationId: 'vendor-mutation-2',
        clientSequence: 7,
        description: 'Fresh copy',
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'VENDOR_CONFLICT');
    assert.equal(res.body.vendorRevision, 5);
    assert.equal(res.body.correlationId, 'vendor-mutation-2');
    assert.equal(res.body.clientSequence, 7);
  });
});
