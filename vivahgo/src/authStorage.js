const SESSION_STORAGE_KEY = 'vivahgo.session';
const DEMO_PLANNER_STORAGE_KEY = 'vivahgo.demoPlanner';
const PLANNER_VENDOR_FILTERS_SESSION_KEY = 'vivahgo.vendorFilters';
const LEGACY_GOOGLE_USER_KEY = 'user';
const LEGACY_GOOGLE_LOGIN_FLAG_KEY = 'isLoggedIn';
const COOKIE_AUTH_PLACEHOLDER = '__cookie_session__';

function clearKey(storage, key) {
  if (!storage || typeof storage.removeItem !== 'function') {
    return;
  }

  storage.removeItem(key);
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hydrateSession(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  if (session.mode === 'google') {
    return {
      ...session,
      token: COOKIE_AUTH_PLACEHOLDER,
    };
  }

  return session;
}

export function readAuthSession(options = {}) {
  const localStorageRef = options.localStorageRef ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!localStorageRef || typeof localStorageRef.getItem !== 'function') {
    return null;
  }

  const raw = localStorageRef.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return hydrateSession(safeParseJson(raw));
}

export function persistAuthSession(session, options = {}) {
  const localStorageRef = options.localStorageRef ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!localStorageRef || typeof localStorageRef.setItem !== 'function' || !session || typeof session !== 'object') {
    return hydrateSession(session);
  }

  const { token: _token, ...persistableSession } = session;
  localStorageRef.setItem(SESSION_STORAGE_KEY, JSON.stringify(persistableSession));
  return hydrateSession(persistableSession);
}

export function clearAuthStorage(scope, options = {}) {
  const localStorageRef = options.localStorageRef ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const sessionStorageRef = options.sessionStorageRef ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
  const googleRef = options.googleRef ?? (typeof window !== 'undefined' ? window.google : null);

  clearKey(localStorageRef, SESSION_STORAGE_KEY);
  clearKey(localStorageRef, LEGACY_GOOGLE_USER_KEY);
  clearKey(localStorageRef, LEGACY_GOOGLE_LOGIN_FLAG_KEY);

  if (scope === 'planner') {
    clearKey(localStorageRef, DEMO_PLANNER_STORAGE_KEY);
    clearKey(sessionStorageRef, PLANNER_VENDOR_FILTERS_SESSION_KEY);
  }

  if (googleRef?.accounts?.id && typeof googleRef.accounts.id.disableAutoSelect === 'function') {
    googleRef.accounts.id.disableAutoSelect();
  }
}

export function revokeGoogleIdTokenConsent(email, options = {}) {
  const googleRef = options.googleRef ?? (typeof window !== 'undefined' ? window.google : null);
  const setTimeoutImpl = options.setTimeoutImpl ?? globalThis.setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? globalThis.clearTimeout;
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';
  const revoke = googleRef?.accounts?.id?.revoke;

  if (!normalizedEmail || typeof revoke !== 'function') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId && typeof clearTimeoutImpl === 'function') {
        clearTimeoutImpl(timeoutId);
      }
      resolve(result);
    };

    if (typeof setTimeoutImpl === 'function') {
      timeoutId = setTimeoutImpl(() => finish(false), 1500);
    }

    try {
      revoke.call(googleRef.accounts.id, normalizedEmail, () => finish(true));
    } catch {
      finish(false);
    }
  });
}

export const authStorageKeys = {
  COOKIE_AUTH_PLACEHOLDER,
  SESSION_STORAGE_KEY,
  DEMO_PLANNER_STORAGE_KEY,
  PLANNER_VENDOR_FILTERS_SESSION_KEY,
  LEGACY_GOOGLE_USER_KEY,
  LEGACY_GOOGLE_LOGIN_FLAG_KEY,
};
