const assert = require('node:assert/strict');

const adminLibPath = require.resolve('../api/_lib/admin');
const b2Path = require.resolve('../api/_lib/b2');
const handlerPath = require.resolve('../api/admin');

describe('api/admin.js -> resume-download route', function () {
  const originalAdminLib = require(adminLibPath);
  const originalB2 = require(b2Path);

  afterEach(function () {
    require.cache[adminLibPath].exports = originalAdminLib;
    require.cache[b2Path].exports = originalB2;
    delete require.cache[handlerPath];
  });

  it('redirects to a signed B2 URL for current careers resume keys', async function () {
    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'admin@vivahgo.com', staffRole: 'viewer' },
        access: { role: 'viewer', canViewAdmin: true },
      }),
    };

    let signedKey = '';
    require.cache[b2Path].exports = {
      ...originalB2,
      createB2PresignedGetUrl: async (key) => {
        signedKey = key;
        return 'https://download.example.com/resume.pdf';
      },
    };

    const { handleAdminResumeDownload } = require(handlerPath);
    const req = {
      method: 'GET',
      query: { key: 'careers/resumes/2026-03/example-resume.pdf' },
      headers: { authorization: 'Bearer test' },
    };
    const res = {
      statusCode: 200,
      headers: {},
      redirectedTo: '',
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      redirect(code, url) {
        this.statusCode = code;
        this.redirectedTo = url;
        return this;
      },
    };

    await handleAdminResumeDownload(req, res);

    assert.equal(signedKey, 'careers/resumes/2026-03/example-resume.pdf');
    assert.equal(res.statusCode, 302);
    assert.equal(res.redirectedTo, 'https://download.example.com/resume.pdf');
  });

  it('continues to allow legacy resume keys', async function () {
    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'admin@vivahgo.com', staffRole: 'viewer' },
        access: { role: 'viewer', canViewAdmin: true },
      }),
    };

    let signedKey = '';
    require.cache[b2Path].exports = {
      ...originalB2,
      createB2PresignedGetUrl: async (key) => {
        signedKey = key;
        return 'https://download.example.com/legacy-resume.pdf';
      },
    };

    const { handleAdminResumeDownload } = require(handlerPath);
    const req = {
      method: 'GET',
      query: { key: '/resumes/legacy-resume.pdf' },
      headers: { authorization: 'Bearer test' },
    };
    const res = {
      statusCode: 200,
      redirectedTo: '',
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      redirect(code, url) {
        this.statusCode = code;
        this.redirectedTo = url;
        return this;
      },
    };

    await handleAdminResumeDownload(req, res);

    assert.equal(signedKey, 'resumes/legacy-resume.pdf');
    assert.equal(res.statusCode, 302);
    assert.equal(res.redirectedTo, 'https://download.example.com/legacy-resume.pdf');
  });

  it('rejects resume keys outside the allowed prefixes', async function () {
    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'admin@vivahgo.com', staffRole: 'viewer' },
        access: { role: 'viewer', canViewAdmin: true },
      }),
    };

    const { handleAdminResumeDownload } = require(handlerPath);
    const req = {
      method: 'GET',
      query: { key: 'b2-key-1' },
      headers: { authorization: 'Bearer test' },
    };
    const res = {
      statusCode: 200,
      body: null,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    await handleAdminResumeDownload(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'Invalid resume key.');
  });
});
