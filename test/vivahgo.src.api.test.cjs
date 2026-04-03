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
      mod.resolveApiBaseUrl({}, { location: { hostname: '127.0.0.1' } }),
      'http://127.0.0.1:4000/api'
    );

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
    assert.equal(
      mod.resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://example.com/api/' }, remoteWindow),
      '/api'
    );
    assert.equal(
      mod.resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://example.com/api/', VITE_USE_REMOTE_API: 'true' }, remoteWindow),
      'https://example.com/api'
    );
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
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer jwt-token');
    assert.equal(calls[0].options.body, JSON.stringify({ planner: { wedding: {} } }));
  });

  it('uses cookie credentials without attaching Authorization for the cookie auth placeholder', async function () {
    const mod = await loadApiModule();
    const calls = [];

    await mod.request('/planner/me', {
      token: '__cookie_session__',
    }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true };
          },
        };
      },
      baseUrl: 'https://api.example.com',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.credentials, 'include');
    assert.equal(calls[0].options.headers.Authorization, undefined);
  });

  it('bootstraps and attaches a CSRF token for public mutating requests', async function () {
    const mod = await loadApiModule();
    const calls = [];

    const result = await mod.request('/feedback', {
      method: 'POST',
      body: { message: 'Hello' },
    }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/auth/csrf')) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { csrfToken: 'csrf-token-1' };
            },
          };
        }

        return {
          ok: true,
          status: 200,
          async json() {
            return { ok: true };
          },
        };
      },
      baseUrl: 'https://api.example.com',
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.example.com/auth/csrf');
    assert.equal(calls[1].url, 'https://api.example.com/feedback');
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'csrf-token-1');
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
      if (String(url).endsWith('/auth/csrf')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { csrfToken: 'csrf-token-1' };
          },
        };
      }

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
      await mod.fetchAdminResumeAccessUrl('jwt-admin', { key: 'careers/resumes/2026-03/resume.pdf', filename: 'resume.pdf', mode: 'preview' });
      await mod.saveAdminCareerRejectionTemplate('jwt-admin', { subject: 'Subject', body: 'Body' });
      await mod.rejectAdminCareerApplication('jwt-admin', { applicationId: 'app-1', subject: 'Subject', body: 'Body' });
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

    const includesCsrfBootstrap = /\/auth\/csrf$/.test(calls[0]?.url || '');
    assert.ok(calls.length === 21 || calls.length === 22);

    const firstRequestIndex = includesCsrfBootstrap ? 1 : 0;
    if (includesCsrfBootstrap) {
      assert.match(calls[0].url, /\/auth\/csrf$/);
    }

    assert.match(calls[firstRequestIndex].url, /\/auth\/google$/);
    assert.equal(calls[firstRequestIndex].options.headers['X-CSRF-Token'], 'csrf-token-1');
    assert.equal(calls[firstRequestIndex + 1].options.headers.Authorization, 'Bearer jwt-2');
    assert.match(calls[firstRequestIndex + 2].url, /\/planner\/me$/);
    assert.match(calls[firstRequestIndex + 3].url, /\/planner\/public\?slug=asha-rohan-1$/);
    assert.match(calls[firstRequestIndex + 4].url, /\/feedback$/);
    assert.equal(calls[firstRequestIndex + 4].options.headers['X-CSRF-Token'], 'csrf-token-1');
    assert.match(calls[firstRequestIndex + 5].url, /\/careers$/);
    assert.match(calls[firstRequestIndex + 6].url, /\/careers$/);
    assert.equal(calls[firstRequestIndex + 6].options.method, 'POST');
    assert.equal(calls[firstRequestIndex + 6].options.headers['X-CSRF-Token'], 'csrf-token-1');
    assert.match(calls[firstRequestIndex + 7].url, /\/admin\/me$/);
    assert.match(calls[firstRequestIndex + 8].url, /\/admin\/applications$/);
    assert.match(calls[firstRequestIndex + 9].url, /\/admin\/resume-download\?key=careers%2Fresumes%2F2026-03%2Fresume\.pdf&filename=resume\.pdf&mode=preview&response=json$/);
    assert.equal(calls[firstRequestIndex + 9].options.headers.Authorization, 'Bearer jwt-admin');
    assert.match(calls[firstRequestIndex + 10].url, /\/admin\/applications$/);
    assert.equal(calls[firstRequestIndex + 10].options.method, 'PATCH');
    assert.equal(calls[firstRequestIndex + 10].options.headers.Authorization, 'Bearer jwt-admin');
    assert.match(calls[firstRequestIndex + 11].url, /\/admin\/applications$/);
    assert.equal(calls[firstRequestIndex + 11].options.method, 'PATCH');
    assert.match(calls[firstRequestIndex + 12].url, /\/admin\/vendors$/);
    assert.equal(calls[firstRequestIndex + 13].options.method, 'PATCH');
    assert.match(calls[firstRequestIndex + 14].url, /\/media\/verification-presigned-url$/);
    assert.match(calls[firstRequestIndex + 15].url, /\/vendor\/verification$/);
    assert.equal(calls[firstRequestIndex + 15].options.method, 'POST');
    assert.equal(calls[firstRequestIndex + 16].options.method, 'DELETE');
    assert.match(calls[firstRequestIndex + 17].url, /\/admin\/staff$/);
    assert.equal(calls[firstRequestIndex + 18].options.method, 'POST');
    assert.equal(calls[firstRequestIndex + 19].options.method, 'PUT');
    assert.match(calls[firstRequestIndex + 20].url, /\/admin\/staff\?email=staff%40example\.com$/);
  });
});
