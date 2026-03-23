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

export function fetchPlanner(token) {
  return request('/planner/me', { token });
}

export function savePlanner(token, planner) {
  return request('/planner/me', {
    method: 'PUT',
    token,
    body: { planner },
  });
}

export function submitFeedback(payload) {
  return request('/feedback', {
    method: 'POST',
    body: payload,
  });
}