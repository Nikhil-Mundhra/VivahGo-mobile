function getRuntimeEnv() {
  if (typeof import.meta !== 'undefined' && import.meta && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

export function resolveApiBaseUrl(env = getRuntimeEnv(), win = typeof window !== 'undefined' ? window : undefined) {
  const configuredBaseUrl = env.VITE_API_BASE_URL;

  // Local development should default to the local API unless explicitly overridden.
  if (win) {
    const host = win.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalHost && env.VITE_USE_REMOTE_API !== 'true') {
      return 'http://localhost:4000/api';
    }
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (win) {
    const host = win.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000/api';
    }

    return '/api';
  }

  return 'http://localhost:4000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

export async function request(path, { method = 'GET', body, token } = {}, options = {}) {
  const { fetchImpl = fetch, baseUrl = API_BASE_URL } = options;
  let response;

  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Failed to fetch. Check API URL, server status, and CORS settings.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}

export function loginWithGoogle(credential) {
  return request('/auth/google', {
    method: 'POST',
    body: { credential },
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

export function saveVendorMedia(token, mediaData) {
  return request('/vendor/media', { method: 'POST', token, body: mediaData });
}

export function updateVendorMedia(token, mediaData) {
  return request('/vendor/media', { method: 'PUT', token, body: mediaData });
}

export function removeVendorMedia(token, mediaId) {
  return request('/vendor/media', { method: 'DELETE', token, body: { mediaId } });
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

export function fetchAdminApplications(token) {
  return request('/admin/applications', { token });
}

export function updateAdminVendorApproval(token, payload) {
  return request('/admin/vendors', {
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
