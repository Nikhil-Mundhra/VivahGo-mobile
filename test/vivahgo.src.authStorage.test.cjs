const assert = require('node:assert/strict');
const { appPath, toFileUrl } = require('./helpers/testUtils.cjs');

async function load() {
  return import(toFileUrl(appPath('src/authStorage.js')));
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe('VivahGo/src/authStorage.js', function () {
  it('persists auth session metadata without storing the bearer token and hydrates a cookie placeholder', async function () {
    const mod = await load();
    const localStorageRef = createStorage();

    const persisted = mod.persistAuthSession({
      mode: 'google',
      token: 'real-jwt-token',
      user: { id: 'user-1', email: 'user@example.com' },
      plannerOwnerId: 'user-1',
    }, { localStorageRef });

    assert.equal(persisted.token, mod.authStorageKeys.COOKIE_AUTH_PLACEHOLDER);
    assert.equal(
      localStorageRef.getItem(mod.authStorageKeys.SESSION_STORAGE_KEY),
      JSON.stringify({
        mode: 'google',
        user: { id: 'user-1', email: 'user@example.com' },
        plannerOwnerId: 'user-1',
      })
    );

    const restored = mod.readAuthSession({ localStorageRef });
    assert.equal(restored.token, mod.authStorageKeys.COOKIE_AUTH_PLACEHOLDER);
    assert.equal(restored.user.email, 'user@example.com');
  });

  it('clears shared auth keys for vendor/admin logout', async function () {
    const mod = await load();
    const localStorageRef = createStorage({
      [mod.authStorageKeys.SESSION_STORAGE_KEY]: '{"token":"abc"}',
      [mod.authStorageKeys.LEGACY_GOOGLE_USER_KEY]: '{"id":"123"}',
      [mod.authStorageKeys.LEGACY_GOOGLE_LOGIN_FLAG_KEY]: 'true',
      [mod.authStorageKeys.DEMO_PLANNER_STORAGE_KEY]: '{"demo":true}',
    });
    const sessionStorageRef = createStorage({
      [mod.authStorageKeys.PLANNER_VENDOR_FILTERS_SESSION_KEY]: '{"activeTab":"All"}',
    });
    let disabledAutoSelect = false;
    const googleRef = {
      accounts: {
        id: {
          disableAutoSelect() {
            disabledAutoSelect = true;
          },
        },
      },
    };

    mod.clearAuthStorage('vendor', { localStorageRef, sessionStorageRef, googleRef });

    assert.equal(localStorageRef.getItem(mod.authStorageKeys.SESSION_STORAGE_KEY), null);
    assert.equal(localStorageRef.getItem(mod.authStorageKeys.LEGACY_GOOGLE_USER_KEY), null);
    assert.equal(localStorageRef.getItem(mod.authStorageKeys.LEGACY_GOOGLE_LOGIN_FLAG_KEY), null);
    assert.equal(localStorageRef.getItem(mod.authStorageKeys.DEMO_PLANNER_STORAGE_KEY), '{"demo":true}');
    assert.equal(sessionStorageRef.getItem(mod.authStorageKeys.PLANNER_VENDOR_FILTERS_SESSION_KEY), '{"activeTab":"All"}');
    assert.equal(disabledAutoSelect, true);
  });

  it('clears planner-specific cached data on planner logout', async function () {
    const mod = await load();
    const localStorageRef = createStorage({
      [mod.authStorageKeys.SESSION_STORAGE_KEY]: '{"token":"abc"}',
      [mod.authStorageKeys.DEMO_PLANNER_STORAGE_KEY]: '{"demo":true}',
    });
    const sessionStorageRef = createStorage({
      [mod.authStorageKeys.PLANNER_VENDOR_FILTERS_SESSION_KEY]: '{"activeTab":"All"}',
    });

    mod.clearAuthStorage('planner', { localStorageRef, sessionStorageRef });

    assert.equal(localStorageRef.getItem(mod.authStorageKeys.SESSION_STORAGE_KEY), null);
    assert.equal(localStorageRef.getItem(mod.authStorageKeys.DEMO_PLANNER_STORAGE_KEY), null);
    assert.equal(sessionStorageRef.getItem(mod.authStorageKeys.PLANNER_VENDOR_FILTERS_SESSION_KEY), null);
  });

  it('revokes Google ID token consent on account deletion when the GIS revoke API is available', async function () {
    const mod = await load();
    let revokedEmail = '';

    const result = await mod.revokeGoogleIdTokenConsent('user@example.com', {
      googleRef: {
        accounts: {
          id: {
            revoke(email, done) {
              revokedEmail = email;
              done();
            },
          },
        },
      },
    });

    assert.equal(result, true);
    assert.equal(revokedEmail, 'user@example.com');
  });

  it('skips Google ID token consent revocation when email or GIS revoke support is unavailable', async function () {
    const mod = await load();

    assert.equal(await mod.revokeGoogleIdTokenConsent('', {}), false);
    assert.equal(await mod.revokeGoogleIdTokenConsent('user@example.com', { googleRef: {} }), false);
  });
});
