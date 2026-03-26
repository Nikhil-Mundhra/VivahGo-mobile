const assert = require('node:assert/strict');

const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function loadApiModule() {
  return import(`${toFileUrl(appPath('src/api.js'))}?t=${Date.now()}`);
}

describe('VivahGo/src/api.js', function () {
  it('resolves base URL across local, configured, and fallback cases', async function () {
    const mod = await loadApiModule();

    const localWindow = { location: { hostname: 'localhost' } };
    assert.equal(mod.resolveApiBaseUrl({}, localWindow), 'http://localhost:4000/api');

    assert.equal(
      mod.resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://example.com/api/' }, localWindow),
      'http://localhost:4000/api'
    );

    assert.equal(
      mod.resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://example.com/api/', VITE_USE_REMOTE_API: 'true' }, localWindow),
      'https://example.com/api'
    );

    const remoteWindow = { location: { hostname: 'app.example.com' } };
    assert.equal(mod.resolveApiBaseUrl({}, remoteWindow), '/api');
    assert.equal(mod.resolveApiBaseUrl({}, undefined), 'http://localhost:4000/api');
  });

  it('executes request success path with token and body serialization', async function () {
    const mod = await loadApiModule();
    const calls = [];

    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true };
        },
      };
    };

    const result = await mod.request('/planner/me', {
      method: 'PUT',
      token: 'jwt-token',
      body: { planner: { wedding: {} } },
    }, {
      fetchImpl,
      baseUrl: 'https://api.example.com',
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.example.com/planner/me');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt-token');
    assert.equal(calls[0].options.body, JSON.stringify({ planner: { wedding: {} } }));
  });

  it('covers network error and non-ok response branches', async function () {
    const mod = await loadApiModule();

    await assert.rejects(
      () => mod.request('/x', {}, { fetchImpl: async () => { throw new Error('network down'); }, baseUrl: 'http://x' }),
      /Failed to fetch/
    );

    await assert.rejects(
      () => mod.request('/x', {}, {
        fetchImpl: async () => ({
          ok: false,
          status: 418,
          async json() {
            return { error: 'teapot' };
          },
        }),
        baseUrl: 'http://x',
      }),
      /teapot/
    );

    await assert.rejects(
      () => mod.request('/x', {}, {
        fetchImpl: async () => ({
          ok: false,
          status: 503,
          async json() {
            return {};
          },
        }),
        baseUrl: 'http://x',
      }),
      /Request failed \(503\)/
    );
  });

  it('handles JSON parse fallback and wrapper function forwarding', async function () {
    const mod = await loadApiModule();

    const parseFailResponse = await mod.request('/x', {}, {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json() {
          return Promise.reject(new Error('bad json'));
        },
      }),
      baseUrl: 'http://x',
    });

    assert.deepEqual(parseFailResponse, {});

    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true };
        },
      };
    };

    try {
      await mod.loginWithGoogle('cred-1');
      await mod.fetchPlanner('jwt-2');
      await mod.savePlanner('jwt-3', { wedding: { bride: 'A' } });
      await mod.fetchPublicWeddingWebsite('asha-rohan-1');
      await mod.submitFeedback({ message: 'Great app' });
      await mod.fetchCareers();
      await mod.submitCareerApplication({ jobId: 'full-stack-engineer' });
      await mod.fetchAdminSession('jwt-admin');
      await mod.fetchAdminApplications('jwt-admin');
      await mod.fetchAdminVendors('jwt-admin');
      await mod.updateAdminVendorApproval('jwt-admin', { vendorId: 'vendor-1', isApproved: true });
      await mod.fetchVerificationPresignedUrl('jwt-vendor', { filename: 'id.pdf', contentType: 'application/pdf', size: 123 });
      await mod.saveVendorVerificationDocument('jwt-vendor', { key: 'vendor-verification/vendor-1/id.pdf', documentType: 'PAN' });
      await mod.removeVendorVerificationDocument('jwt-vendor', 'doc-1');
      await mod.fetchAdminStaff('jwt-admin');
      await mod.addAdminStaff('jwt-admin', { email: 'staff@example.com', staffRole: 'viewer' });
      await mod.updateAdminStaff('jwt-admin', { email: 'staff@example.com', staffRole: 'editor' });
      await mod.removeAdminStaff('jwt-admin', 'staff@example.com');
    } finally {
      delete global.fetch;
    }

    assert.equal(calls.length, 18);
    assert.match(calls[0].url, /\/auth\/google$/);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer jwt-2');
    assert.match(calls[2].url, /\/planner\/me$/);
    assert.match(calls[3].url, /\/planner\/public\?slug=asha-rohan-1$/);
    assert.match(calls[4].url, /\/feedback$/);
    assert.match(calls[5].url, /\/careers$/);
    assert.match(calls[6].url, /\/careers$/);
    assert.equal(calls[6].options.method, 'POST');
    assert.match(calls[7].url, /\/admin\/me$/);
    assert.match(calls[8].url, /\/admin\/applications$/);
    assert.match(calls[9].url, /\/admin\/vendors$/);
    assert.equal(calls[10].options.method, 'PATCH');
    assert.match(calls[11].url, /\/media\/verification-presigned-url$/);
    assert.match(calls[12].url, /\/vendor\/verification$/);
    assert.equal(calls[12].options.method, 'POST');
    assert.equal(calls[13].options.method, 'DELETE');
    assert.match(calls[14].url, /\/admin\/staff$/);
    assert.equal(calls[15].options.method, 'POST');
    assert.equal(calls[16].options.method, 'PUT');
    assert.match(calls[17].url, /\/admin\/staff\?email=staff%40example\.com$/);
  });
});
