const assert = require('node:assert/strict');

const adminLibPath = require.resolve('../api/_lib/admin');
const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/admin');

describe('api/admin.js -> applications route', function () {
  const originalAdminLib = require(adminLibPath);
  const originalCore = require(corePath);

  afterEach(function () {
    require.cache[adminLibPath].exports = originalAdminLib;
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('returns career applications for an authorized admin session', async function () {
    require.cache[adminLibPath].exports = {
      ...originalAdminLib,
      requireAdminSession: async () => ({
        user: { email: 'admin@vivahgo.com', staffRole: 'viewer' },
        access: { role: 'viewer', canViewAdmin: true },
      }),
    };

    require.cache[corePath].exports = {
      ...originalCore,
      getCareerApplicationModel: () => ({
        find: () => ({
          select() {
            return this;
          },
          sort() {
            return this;
          },
          lean: async () => ([
            {
              _id: 'app-1',
              fullName: 'Aarav Sharma',
              email: 'aarav@example.com',
              jobId: 'full-stack-engineer',
              jobTitle: 'Full Stack Engineer',
              resumeDriveFileId: 'drive-1',
              resumeDriveFileName: 'resume.pdf',
              resumeDriveViewUrl: 'https://drive.google.com/file/d/drive-1/view',
              resumeDriveDownloadUrl: 'https://drive.google.com/uc?id=drive-1&export=download',
              resumeOriginalFileName: 'resume.pdf',
              resumeMimeType: 'application/pdf',
              resumeSize: 1024,
              status: 'new',
              createdAt: '2026-03-26T10:00:00.000Z',
              updatedAt: '2026-03-26T10:00:00.000Z',
            },
          ]),
        }),
      }),
    };

    const { handleAdminApplications } = require(handlerPath);
    const req = { method: 'GET', headers: { authorization: 'Bearer test' } };
    const res = {
      statusCode: null,
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

    await handleAdminApplications(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.applications.length, 1);
    assert.equal(res.body.applications[0].jobTitle, 'Full Stack Engineer');
    assert.equal(res.body.applications[0].resumeDriveFileId, 'drive-1');
  });
});
