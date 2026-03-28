const SESSION_STORAGE_KEY = 'vivahgo.session';
const DEMO_PLANNER_STORAGE_KEY = 'vivahgo.demoPlanner';
const PLANNER_VENDOR_FILTERS_SESSION_KEY = 'vivahgo.vendorFilters';
const LEGACY_GOOGLE_USER_KEY = 'user';
const LEGACY_GOOGLE_LOGIN_FLAG_KEY = 'isLoggedIn';

function clearKey(storage, key) {
  if (!storage || typeof storage.removeItem !== 'function') {
    return;
  }

  storage.removeItem(key);
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

export const authStorageKeys = {
  SESSION_STORAGE_KEY,
  DEMO_PLANNER_STORAGE_KEY,
  PLANNER_VENDOR_FILTERS_SESSION_KEY,
  LEGACY_GOOGLE_USER_KEY,
  LEGACY_GOOGLE_LOGIN_FLAG_KEY,
};
