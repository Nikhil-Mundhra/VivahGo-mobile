import { clearClarityUser, syncClaritySession } from "./shared/clarity.js";
import { resetRequestCache } from "./shared/api/request.js";
import { rotateAxiomTraceId } from "./shared/observability.js";
import { capturePostHogEvent, identifyPostHogUser, resetPostHogUser } from "./shared/posthog.js";
import { clearAppQueryState } from "./shared/queryClient.js";
import { clearSentryUser, setSentryUser } from "./shared/sentry.js";

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

  if (session.mode === 'google' || session.mode === 'clerk') {
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

  const previousSession = readAuthSession({ localStorageRef });
  const { token: _token, ...persistableSession } = session;
  const previousUserId = typeof previousSession?.user?.id === 'string' ? previousSession.user.id : '';
  const nextUserId = typeof persistableSession?.user?.id === 'string' ? persistableSession.user.id : '';
  const previousWasAuthenticated = previousSession?.mode === 'google' || previousSession?.mode === 'clerk';
  const nextIsAuthenticated = persistableSession?.mode === 'google' || persistableSession?.mode === 'clerk';
  const shouldResetTrackedIdentity = previousWasAuthenticated
    && nextIsAuthenticated
    && previousUserId
    && nextUserId
    && previousUserId !== nextUserId;
  resetRequestCache();
  clearAppQueryState();
  localStorageRef.setItem(SESSION_STORAGE_KEY, JSON.stringify(persistableSession));

  if ((persistableSession.mode === 'google' || persistableSession.mode === 'clerk') && persistableSession.user) {
    if (shouldResetTrackedIdentity) {
      resetPostHogUser();
    }

    setSentryUser(persistableSession.user, {
      authMode: persistableSession.mode,
      plannerOwnerId: persistableSession.plannerOwnerId || persistableSession.user.id || '',
    });
    syncClaritySession(persistableSession);
    identifyPostHogUser(persistableSession.user, {
      authMode: persistableSession.mode,
      plannerOwnerId: persistableSession.plannerOwnerId || persistableSession.user.id || '',
    });

    const shouldCaptureLogin = nextUserId && (
      previousSession?.mode !== persistableSession.mode
      || previousUserId !== nextUserId
      || !(previousSession?.mode === 'google' || previousSession?.mode === 'clerk')
    );

    if (shouldCaptureLogin) {
      capturePostHogEvent('auth_login_succeeded', {
        auth_mode: persistableSession.mode,
        planner_owner_id: persistableSession.plannerOwnerId || persistableSession.user.id || '',
        user_id: nextUserId,
      });
    }
  } else {
    clearSentryUser({
      authMode: persistableSession.mode || 'anonymous',
      plannerOwnerId: persistableSession.plannerOwnerId || '',
    });
    clearClarityUser({
      authMode: persistableSession.mode || 'anonymous',
      plannerOwnerId: persistableSession.plannerOwnerId || '',
      sessionStorageRef: options.sessionStorageRef,
    });
    resetPostHogUser();
  }

  return hydrateSession(persistableSession);
}

export function clearAuthStorage(scope, options = {}) {
  const localStorageRef = options.localStorageRef ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const sessionStorageRef = options.sessionStorageRef ?? (typeof window !== 'undefined' ? window.sessionStorage : null);
  const googleRef = options.googleRef ?? (typeof window !== 'undefined' ? window.google : null);
  const currentSession = readAuthSession({ localStorageRef });

  if ((currentSession?.mode === 'google' || currentSession?.mode === 'clerk') && currentSession.user) {
    capturePostHogEvent('auth_logout', {
      auth_mode: currentSession.mode,
      planner_owner_id: currentSession.plannerOwnerId || currentSession.user.id || '',
      reason: typeof options.reason === 'string' && options.reason ? options.reason : 'session_cleared',
      scope: typeof scope === 'string' ? scope : 'app',
      user_id: currentSession.user.id || '',
    });
  }

  clearKey(localStorageRef, SESSION_STORAGE_KEY);
  clearKey(localStorageRef, LEGACY_GOOGLE_USER_KEY);
  clearKey(localStorageRef, LEGACY_GOOGLE_LOGIN_FLAG_KEY);
  resetRequestCache();
  clearAppQueryState();
  clearSentryUser({ authMode: 'anonymous' });
  rotateAxiomTraceId(sessionStorageRef);
  clearClarityUser({
    authMode: 'anonymous',
    sessionStorageRef,
  });
  resetPostHogUser();

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

export async function revokeClerkSession(options = {}) {
  const clerkRef = options.clerkRef ?? (typeof window !== 'undefined' ? window.Clerk : null);
  const localStorageRef = options.localStorageRef ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const sessionStorageRef = options.sessionStorageRef ?? (typeof window !== 'undefined' ? window.sessionStorage : null);

  try {
    if (clerkRef && typeof clerkRef.signOut === 'function') {
      await clerkRef.signOut();
    }
  } catch {
    // Best effort logout from Clerk client.
  }

  const removeClerkKeys = (storage) => {
    if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') {
      return;
    }

    const keysToRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (typeof key === 'string' && key.toLowerCase().includes('clerk')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage cleanup errors.
      }
    });
  };

  removeClerkKeys(localStorageRef);
  removeClerkKeys(sessionStorageRef);
}

export const authStorageKeys = {
  COOKIE_AUTH_PLACEHOLDER,
  SESSION_STORAGE_KEY,
  DEMO_PLANNER_STORAGE_KEY,
  PLANNER_VENDOR_FILTERS_SESSION_KEY,
  LEGACY_GOOGLE_USER_KEY,
  LEGACY_GOOGLE_LOGIN_FLAG_KEY,
};
