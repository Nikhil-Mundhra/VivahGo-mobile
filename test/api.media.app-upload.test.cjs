const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const adminPath = require.resolve('../api/_lib/admin');
const blobPath = require.resolve('../api/_lib/blob');
const handlerPath = require.resolve('../api/media');
const appUploadHandlerPath = require.resolve('../api-handlers/media/appUpload');
const presignedHandlerPath = require.resolve('../api-handlers/media/presignedUrl');
const verificationHandlerPath = require.resolve('../api-handlers/media/verificationPresignedUrl');
const readJsonBodyPath = require.resolve('../api-handlers/media/readJsonBody');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'staff-123', email: 'editor@test.com', name: 'Editor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/media.js -> app-upload route', function () {
  const originalCore = require(corePath);
  const originalAdmin = require(adminPath);
  const originalBlob = require(blobPath);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    require.cache[adminPath].exports = originalAdmin;
    require.cache[blobPath].exports = originalBlob;
    delete require.cache[handlerPath];
    delete require.cache[appUploadHandlerPath];
    delete require.cache[presignedHandlerPath];
    delete require.cache[verificationHandlerPath];
    delete require.cache[readJsonBodyPath];
  });

  it('uploads public guide images to Blob for staff editors', async function () {
    let blobCall = null;

    require.cache[corePath].exports = {
      ...originalCore,
      requireCsrfProtection: () => false,
    };
    require.cache[adminPath].exports = {
      ...originalAdmin,
      requireAdminSession: async () => ({
        user: { googleId: 'staff-123' },
      }),
    };
    require.cache[blobPath].exports = {
      ...originalBlob,
      buildPublicMediaBlobPath: ({ folder, filename }) => `app-media/${folder}/2026/04/test-${filename}`,
      readRequestBodyBuffer: async () => Buffer.from('image-bytes'),
      uploadPublicBlob: async (input) => {
        blobCall = input;
        return {
          url: 'https://blob.vercel-storage.com/app-media/guides/2026/04/test-guide-image.png',
          pathname: input.pathname,
          contentType: input.contentType,
        };
      },
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      query: {
        route: 'app-upload',
        filename: 'guide-image.png',
        folder: 'guides',
      },
      headers: {
        authorization: `Bearer ${makeToken()}`,
        'content-type': 'image/png',
        'content-length': '11',
      },
      body: Buffer.from('image-bytes'),
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.folder, 'guides');
    assert.equal(res.body.pathname, 'app-media/guides/2026/04/test-guide-image.png');
    assert.equal(res.body.uploadedBy, 'staff-123');
    assert.equal(res.body.blob.url, 'https://blob.vercel-storage.com/app-media/guides/2026/04/test-guide-image.png');
    assert.deepEqual(blobCall, {
      pathname: 'app-media/guides/2026/04/test-guide-image.png',
      body: Buffer.from('image-bytes'),
      contentType: 'image/png',
    });
  });

  it('rejects unsupported content types before uploading', async function () {
    let uploadAttempted = false;

    require.cache[corePath].exports = {
      ...originalCore,
      requireCsrfProtection: () => false,
    };
    require.cache[adminPath].exports = {
      ...originalAdmin,
      requireAdminSession: async () => ({
        user: { googleId: 'staff-123' },
      }),
    };
    require.cache[blobPath].exports = {
      ...originalBlob,
      uploadPublicBlob: async () => {
        uploadAttempted = true;
      },
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      query: {
        route: 'app-upload',
        filename: 'guide-image.svg',
        folder: 'guides',
      },
      headers: {
        authorization: `Bearer ${makeToken()}`,
        'content-type': 'image/svg+xml',
      },
      body: Buffer.from('<svg></svg>'),
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Only JPEG, PNG, WebP, AVIF, and GIF images are allowed.' });
    assert.equal(uploadAttempted, false);
  });
});
