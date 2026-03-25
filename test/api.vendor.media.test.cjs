const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/vendor/media');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'vendor-123', email: 'vendor@test.com', name: 'Vendor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/vendor/media.js', function () {
  const originalCore = require(corePath);

  afterEach(function () {
    delete process.env.R2_PUBLIC_URL;
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('stores the exact media key and normalizes the public URL from it', async function () {
    process.env.R2_PUBLIC_URL = 'https://media.vivahgo.com/portfolio';

    const updatedVendor = {
      toObject() {
        return {
          googleId: 'vendor-123',
          businessName: 'Studio Test',
          media: [
            {
              _id: 'media-1',
              key: 'vendors/Vendor-ABC/Photo.JPG',
              url: 'https://wrong.example.com/photo.jpg',
              type: 'IMAGE',
              sortOrder: 0,
              filename: 'Photo.JPG',
              size: 1024,
            },
          ],
        };
      },
    };

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getVendorModel: () => ({
        findOneAndUpdate: async (_query, update) => {
          assert.equal(update.$push.media.key, 'vendors/Vendor-ABC/Photo.JPG');
          return updatedVendor;
        },
      }),
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        key: 'vendors/Vendor-ABC/Photo.JPG',
        url: 'https://wrong.example.com/photo.jpg',
        type: 'IMAGE',
        filename: 'Photo.JPG',
        size: 1024,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.vendor.media[0].key, 'vendors/Vendor-ABC/Photo.JPG');
    assert.equal(res.body.vendor.media[0].url, 'https://media.vivahgo.com/portfolio/vendors/Vendor-ABC/Photo.JPG');
  });

  it('can recover the exact key from a matching public URL when key is omitted', async function () {
    process.env.R2_PUBLIC_URL = 'https://media.vivahgo.com/portfolio';

    const updatedVendor = {
      toObject() {
        return {
          googleId: 'vendor-123',
          businessName: 'Studio Test',
          media: [
            {
              _id: 'media-1',
              key: 'vendors/Vendor-ABC/Photo.JPG',
              url: '',
              type: 'IMAGE',
              sortOrder: 0,
              filename: 'Photo.JPG',
              size: 1024,
            },
          ],
        };
      },
    };

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getVendorModel: () => ({
        findOneAndUpdate: async (_query, update) => {
          assert.equal(update.$push.media.key, 'vendors/Vendor-ABC/Photo.JPG');
          return updatedVendor;
        },
      }),
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        url: 'https://media.vivahgo.com/portfolio/vendors/Vendor-ABC/Photo.JPG',
        type: 'IMAGE',
        filename: 'Photo.JPG',
        size: 1024,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.vendor.media[0].url, 'https://media.vivahgo.com/portfolio/vendors/Vendor-ABC/Photo.JPG');
  });
});
