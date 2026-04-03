import { authStorageKeys } from './authStorage.js';

const CSRF_COOKIE_NAME = 'vivahgo_csrf';
const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
let csrfTokenCache = '';

function getRuntimeEnv() {
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

function isLocalHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

export function resolveApiBaseUrl(env = getRuntimeEnv(), win = typeof window !== 'undefined' ? window : undefined) {
  const configuredBaseUrl = env.VITE_API_BASE_URL;

  if (win) {
    const host = win.location.hostname;
    const isLocalHost = isLocalHostname(host);

    // Browsers on deployed hosts should use same-origin API routes by default.
    // This avoids unnecessary cross-origin requests and CORS failures.
    if (isLocalHost) {
      if (env.VITE_USE_REMOTE_API === 'true' && configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/$/, '');
      }
      return `http://${host}:4000/api`;
    }

    if (env.VITE_USE_REMOTE_API === 'true' && configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    return '/api';
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  return 'http://localhost:4000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

function readCookieValue(name, doc = typeof document !== 'undefined' ? document : undefined) {
  if (!doc || typeof doc.cookie !== 'string' || !doc.cookie) {
    return '';
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const entry = doc.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix));

  if (!entry) {
    return '';
  }

  const value = entry.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isMutatingMethod(method) {
  return !SAFE_HTTP_METHODS.has(String(method || 'GET').toUpperCase());
}

export async function fetchCsrfToken(options = {}) {
  const { fetchImpl = fetch, baseUrl = API_BASE_URL } = options;
  const cookieToken = readCookieValue(CSRF_COOKIE_NAME);
  if (cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }

  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  let response;
  try {
    response = await fetchImpl(`${baseUrl}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    throw new Error('Failed to fetch. Check API URL, server status, and CORS settings.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
    throw new Error('CSRF token could not be loaded.');
  }

  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

async function performRequest(path, requestOptions = {}, options = {}, hasRetriedCsrf = false) {
  const { method = 'GET', body, token } = requestOptions;
  const { fetchImpl = fetch, baseUrl = API_BASE_URL } = options;
  const shouldSendBearerToken = Boolean(token) && token !== authStorageKeys.COOKIE_AUTH_PLACEHOLDER;
  const shouldAttachCsrf = isMutatingMethod(method) && !shouldSendBearerToken;
  const csrfToken = shouldAttachCsrf
    ? (readCookieValue(CSRF_COOKIE_NAME) || csrfTokenCache || await fetchCsrfToken({ fetchImpl, baseUrl }))
    : '';

  let response;

  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(shouldSendBearerToken ? { Authorization: `Bearer ${token}` } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Failed to fetch. Check API URL, server status, and CORS settings.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok && shouldAttachCsrf && !hasRetriedCsrf && (data.code === 'CSRF_REQUIRED' || data.code === 'CSRF_INVALID')) {
    csrfTokenCache = '';
    await fetchCsrfToken({ fetchImpl, baseUrl });
    return performRequest(path, requestOptions, options, true);
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}

export async function request(path, requestOptions = {}, options = {}) {
  return performRequest(path, requestOptions, options);
}

export function loginWithGoogle(credential) {
  return request('/auth/google', {
    method: 'POST',
    body: { credential },
  });
}

export function loginWithClerk(token, clerkUser = {}) {
  const sanitizedUser = clerkUser && typeof clerkUser === 'object' ? clerkUser : {};
  const requestOptions = {
    method: 'POST',
    body: {
      token,
      userId: sanitizedUser.id || '',
      email: sanitizedUser.email || '',
      name: sanitizedUser.name || '',
      picture: sanitizedUser.picture || '',
    },
  };

  // Support both route styles across local server and Vercel serverless handler.
  return request('/auth/clerk', requestOptions).catch((error) => {
    if (!/404/.test(String(error?.message || ''))) {
      throw error;
    }

    return request('/auth?route=clerk', requestOptions);
  });
}

function withOwnerQuery(path, plannerOwnerId) {
  if (!plannerOwnerId) {
    return path;
  }

  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}plannerOwnerId=${encodeURIComponent(plannerOwnerId)}`;
}

export function fetchPlanner(token, plannerOwnerId) {
  return request(withOwnerQuery('/planner/me', plannerOwnerId), { token });
}

export function fetchPublicWeddingWebsite(slug) {
  return request(`/planner/public?slug=${encodeURIComponent(slug)}`);
}

export function createGuestRsvpLink(token, payload) {
  return request('/planner/me/rsvp-link', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function fetchGuestRsvpDetails(rsvpToken) {
  return request(`/planner/rsvp?token=${encodeURIComponent(rsvpToken)}`);
}

export function submitGuestRsvp(rsvpToken, payload) {
  return request('/planner/rsvp', {
    method: 'POST',
    body: {
      token: rsvpToken,
      ...payload,
    },
  });
}

export function savePlanner(token, planner, plannerOwnerId) {
  return request(withOwnerQuery('/planner/me', plannerOwnerId), {
    method: 'PUT',
    token,
    body: { planner },
  });
}

export function fetchAccessiblePlanners(token) {
  return request('/planner/access', { token });
}

export function fetchPlanCollaborators(token, planId, plannerOwnerId) {
  const query = planId ? `?planId=${encodeURIComponent(planId)}` : '';
  const path = withOwnerQuery(`/planner/me/collaborators${query}`, plannerOwnerId);
  return request(path, {
    token,
  });
}

export function fetchPlannerNotificationSettings(token) {
  return request('/planner/me/notifications', { token });
}

export function savePlannerNotificationSettings(token, notificationPreferences) {
  return request('/planner/me/notifications', {
    method: 'PUT',
    token,
    body: { notificationPreferences },
  });
}

export function registerPlannerNotificationToken(token, payload) {
  return request('/planner/me/notifications', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function removePlannerNotificationToken(token, payload) {
  return request('/planner/me/notifications', {
    method: 'DELETE',
    token,
    body: payload,
  });
}

export function addPlanCollaborator(token, payload) {
  return request(withOwnerQuery('/planner/me/collaborators', payload?.plannerOwnerId), {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updatePlanCollaboratorRole(token, payload) {
  return request(withOwnerQuery('/planner/me/collaborators', payload?.plannerOwnerId), {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function removePlanCollaborator(token, payload) {
  const query = payload?.email
    ? `?planId=${encodeURIComponent(payload.planId || '')}&email=${encodeURIComponent(payload.email)}`
    : '';
  const path = withOwnerQuery(`/planner/me/collaborators${query}`, payload?.plannerOwnerId);

  return request(path, {
    method: 'DELETE',
    token,
    body: payload,
  });
}

export function deleteAccount(token) {
  return request('/auth/me', {
    method: 'DELETE',
    token,
  });
}

export function logoutSession(token) {
  return request('/auth/logout', {
    method: 'POST',
    token,
  });
}

export function submitFeedback(payload) {
  return request('/feedback', {
    method: 'POST',
    body: payload,
  });
}

export function fetchCareers() {
  return request('/careers');
}

export function submitCareerApplication(payload) {
  return request('/careers', {
    method: 'POST',
    body: payload,
  });
}

export function getSubscriptionStatus(token) {
  return request('/subscription/status', { token });
}

export function createCheckoutSession(token, plan, billingCycle, couponCode) {
  return request('/subscription/checkout', {
    method: 'POST',
    token,
    body: { plan, billingCycle, couponCode },
  });
}

export function getCheckoutQuote(token, plan, billingCycle, couponCode) {
  return request('/subscription/quote', {
    method: 'POST',
    token,
    body: { plan, billingCycle, couponCode },
  });
}

export function confirmCheckoutPayment(token, payload) {
  return request('/subscription/confirm', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function createPortalSession(token) {
  return request('/subscription/portal', {
    method: 'POST',
    token,
  });
}

// ─── Vendor API ───────────────────────────────────────────────────────────────

export function fetchVendorProfile(token) {
  return request('/vendor/me', { token });
}

export function registerVendor(token, data) {
  return request('/vendor/me', { method: 'POST', token, body: data });
}

export function updateVendorProfile(token, data) {
  return request('/vendor/me', { method: 'PATCH', token, body: data });
}

export function fetchPresignedUrl(token, { filename, contentType, size }) {
  return request('/media/presigned-url', {
    method: 'POST',
    token,
    body: { filename, contentType, size },
  });
}

export function fetchVerificationPresignedUrl(token, { filename, contentType, size }) {
  return request('/media/verification-presigned-url', {
    method: 'POST',
    token,
    body: { filename, contentType, size },
  });
}

export function saveVendorMedia(token, mediaData) {
  return request('/vendor/media', { method: 'POST', token, body: mediaData });
}

export function updateVendorMedia(token, mediaData) {
  return request('/vendor/media', { method: 'PUT', token, body: mediaData });
}

export function removeVendorMedia(token, mediaId) {
  return request('/vendor/media', { method: 'DELETE', token, body: { mediaId } });
}

export function saveVendorVerificationDocument(token, payload) {
  return request('/vendor/verification', { method: 'POST', token, body: payload });
}

export function removeVendorVerificationDocument(token, documentId) {
  return request('/vendor/verification', { method: 'DELETE', token, body: { documentId } });
}

export function fetchApprovedVendors() {
  return request('/vendors');
}

export function fetchAdminSession(token) {
  return request('/admin/me', { token });
}

export function fetchAdminVendors(token) {
  return request('/admin/vendors', { token });
}

export function fetchAdminChoiceProfiles(token) {
  return request('/admin/choice', { token });
}

export function fetchAdminApplications(token) {
  return request('/admin/applications', { token });
}

export function fetchAdminResumeAccessUrl(token, { key, filename, mode = 'download' }) {
  const query = new URLSearchParams({
    key: key || '',
    filename: filename || 'resume.pdf',
    mode: mode === 'preview' ? 'preview' : 'download',
    response: 'json',
  });

  return request(`/admin/resume-download?${query.toString()}`, { token });
}

export function saveAdminCareerRejectionTemplate(token, payload) {
  return request('/admin/applications', {
    method: 'PATCH',
    token,
    body: {
      action: 'save-rejection-template',
      ...payload,
    },
  });
}

export function rejectAdminCareerApplication(token, payload) {
  return request('/admin/applications', {
    method: 'PATCH',
    token,
    body: {
      action: 'reject-application',
      ...payload,
    },
  });
}

export function fetchAdminSubscribers(token) {
  return request('/admin/subscribers', { token });
}

export function updateAdminVendorApproval(token, payload) {
  return request('/admin/vendors', {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function updateAdminChoiceProfile(token, payload) {
  return request('/admin/choice', {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function fetchAdminStaff(token) {
  return request('/admin/staff', { token });
}

export function addAdminStaff(token, payload) {
  return request('/admin/staff', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function updateAdminStaff(token, payload) {
  return request('/admin/staff', {
    method: 'PUT',
    token,
    body: payload,
  });
}

export function removeAdminStaff(token, email) {
  return request(`/admin/staff?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
    token,
    body: { email },
  });
}
