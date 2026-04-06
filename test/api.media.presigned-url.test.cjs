const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const r2Path = require.resolve('../api/_lib/r2');
const handlerPath = require.resolve('../api/media');
const presignedHandlerPath = require.resolve('../api-handlers/media/presignedUrl');
const appUploadHandlerPath = require.resolve('../api-handlers/media/appUpload');
const verificationHandlerPath = require.resolve('../api-handlers/media/verificationPresignedUrl');
const readJsonBodyPath = require.resolve('../api-handlers/media/readJsonBody');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'vendor-123', email: 'vendor@test.com', name: 'Vendor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/media.js -> presigned-url route', function () {
  const originalCore = require(corePath);
  const originalR2 = require(r2Path);

  afterEach(function () {
    delete process.env.R2_PUBLIC_URL;
    require.cache[corePath].exports = originalCore;
    require.cache[r2Path].exports = originalR2;
    delete require.cache[handlerPath];
    delete require.cache[appUploadHandlerPath];
    delete require.cache[presignedHandlerPath];
    delete require.cache[verificationHandlerPath];
    delete require.cache[readJsonBodyPath];
  });

  it('returns a descriptive 500 when R2_PUBLIC_URL is missing', async function () {
    let presignedCall = null;
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
    };
    require.cache[r2Path].exports = {
      ...originalR2,
      createPresignedPutUrl: async (...args) => {
        presignedCall = args;
        return 'https://upload.example.com/put';
      },
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      query: { route: 'presigned-url' },
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Could not generate upload URL.' });
    assert.deepEqual(presignedCall[2], { contentLength: 1024 });
  });

  it('returns an absolute publicUrl when R2_PUBLIC_URL is configured', async function () {
    process.env.R2_PUBLIC_URL = 'https://cdn.vivahgo.com/media';
    let presignedCall = null;

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
    };
    require.cache[r2Path].exports = {
      ...originalR2,
      createPresignedPutUrl: async (...args) => {
        presignedCall = args;
        return 'https://upload.example.com/put';
      },
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      query: { route: 'presigned-url' },
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.uploadUrl, 'https://upload.example.com/put');
    assert.match(res.body.key, /^vendors\/vendor-123\/.+\.jpg$/);
    assert.equal(res.body.publicUrl, `https://cdn.vivahgo.com/media/${res.body.key}`);
    assert.deepEqual(presignedCall[2], { contentLength: 1024 });
  });

  it('preserves path prefixes when the public base URL includes a folder', function () {
    process.env.R2_PUBLIC_URL = 'https://media.vivahgo.com/portfolio';

    const { createPublicObjectUrl, extractObjectKeyFromUrl } = require(r2Path);
    const key = 'vendors/Vendor-ABC/Photo.JPG';
    const publicUrl = createPublicObjectUrl(key);

    assert.equal(publicUrl, 'https://media.vivahgo.com/portfolio/vendors/Vendor-ABC/Photo.JPG');
    assert.equal(extractObjectKeyFromUrl(publicUrl), key);
  });

  it('accepts the public R2 fallback hostname for key extraction', function () {
    process.env.R2_PUBLIC_URL = 'https://media.vivahgo.com/portfolio';

    const { extractObjectKeyFromUrl } = require(r2Path);
    const fallbackUrl = 'https://pub-47c8cf1fe5da4a1b89c93045916376d7.r2.dev/vendors/Vendor-ABC/Photo.JPG';

    assert.equal(extractObjectKeyFromUrl(fallbackUrl), 'vendors/Vendor-ABC/Photo.JPG');
  });
});
