const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const b2Path = require.resolve('../api/_lib/b2');
const handlerPath = require.resolve('../api/media');
const verificationHandlerPath = require.resolve('../api-handlers/media/verificationPresignedUrl');
const appUploadHandlerPath = require.resolve('../api-handlers/media/appUpload');
const presignedHandlerPath = require.resolve('../api-handlers/media/presignedUrl');
const readJsonBodyPath = require.resolve('../api-handlers/media/readJsonBody');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'vendor-123', email: 'vendor@test.com', name: 'Vendor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/media.js -> verification-presigned-url route', function () {
  const originalCore = require(corePath);
  const originalB2 = require(b2Path);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    require.cache[b2Path].exports = originalB2;
    delete require.cache[handlerPath];
    delete require.cache[appUploadHandlerPath];
    delete require.cache[presignedHandlerPath];
    delete require.cache[verificationHandlerPath];
    delete require.cache[readJsonBodyPath];
  });

  it('returns a private verification upload key', async function () {
    let presignedCall = null;
    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
    };
    require.cache[b2Path].exports = {
      ...originalB2,
      createB2PresignedPutUrl: async (...args) => {
        presignedCall = args;
        return 'https://upload.example.com/put';
      },
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      query: { route: 'verification-presigned-url' },
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        filename: 'pan-card.pdf',
        contentType: 'application/pdf',
        size: 2048,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.uploadUrl, 'https://upload.example.com/put');
    assert.match(res.body.key, /^vendor-verification\/vendor-123\/.+\.pdf$/);
    assert.deepEqual(presignedCall[2], { contentLength: 2048 });
  });
});
