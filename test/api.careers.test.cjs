const assert = require('node:assert/strict');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const b2Path = require.resolve('../api/_lib/b2');
const handlerPath = require.resolve('../api/careers');

function csrfHeaders(headers = {}) {
  return {
    ...headers,
    cookie: ['vivahgo_csrf=test-csrf-token', headers.cookie].filter(Boolean).join('; '),
    'x-csrf-token': 'test-csrf-token',
  };
}

describe('api/careers.js', function () {
  const originalCore = require(corePath);
  const originalB2 = require(b2Path);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    require.cache[b2Path].exports = originalB2;
    delete require.cache[handlerPath];
  });

  it('returns the configured careers catalog and upload limits', async function () {
    const handler = require(handlerPath);
    const req = { method: 'GET', headers: {} };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(Array.isArray(res.body.careers), true);
    assert.equal(res.body.careers.length >= 1, true);
    assert.equal(res.body.limits.resumeMimeType, 'application/pdf');
    assert.equal(res.headers['Cache-Control'], 'public, s-maxage=300, stale-while-revalidate=3600');
  });

  it('uploads a PDF resume, stores the application, and returns the saved record', async function () {
    const created = [];

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getCareerApplicationModel: () => ({
        create: async (payload) => {
          created.push(payload);
          return {
            _id: 'app-1',
            createdAt: '2026-03-26T10:00:00.000Z',
            updatedAt: '2026-03-26T10:00:00.000Z',
            ...payload,
          };
        },
      }),
    };

    require.cache[b2Path].exports = {
      ...originalB2,
      uploadResumeToB2: async () => ({
        id: 'b2-key-1',
        name: 'resume.pdf',
        viewUrl: '',
        downloadUrl: '',
        mimeType: 'application/pdf',
      }),
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      headers: csrfHeaders(),
      body: {
        jobId: 'full-stack-engineer',
        fullName: 'Aarav Sharma',
        email: 'AARAV@example.com',
        phone: '9999999999',
        location: 'Jaipur',
        linkedInUrl: 'https://linkedin.com/in/aarav',
        portfolioUrl: 'https://aarav.dev',
        coverLetter: 'I like building fast.',
        resumeFilename: 'Aarav-Sharma-Resume.pdf',
        resumeMimeType: 'application/pdf',
        resumeBase64: Buffer.from('%PDF-1.4 sample resume').toString('base64'),
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.application.jobId, 'full-stack-engineer');
    assert.equal(res.body.application.jobTitle, 'Full Stack Engineer');
    assert.equal(res.body.application.resumeFileId, 'b2-key-1');
    assert.equal(created.length, 1);
    assert.equal(created[0].email, 'aarav@example.com');
  });

  it('rejects non-PDF uploads before any storage work happens', async function () {
    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      headers: csrfHeaders(),
      body: {
        jobId: 'full-stack-engineer',
        fullName: 'Aarav Sharma',
        email: 'aarav@example.com',
        resumeFilename: 'resume.docx',
        resumeMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        resumeBase64: Buffer.from('not used').toString('base64'),
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /PDF/);
  });
});
