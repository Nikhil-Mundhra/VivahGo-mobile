import { authStorageKeys } from "../../authStorage.js";

const CSRF_COOKIE_NAME = "vivahgo_csrf";
const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let csrfTokenCache = "";

function getRuntimeEnv() {
  if (typeof import.meta !== "undefined" && import.meta && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function resolveApiBaseUrl(env = getRuntimeEnv(), win = typeof window !== "undefined" ? window : undefined) {
  const configuredBaseUrl = env.VITE_API_BASE_URL;

  if (win) {
    const host = win.location.hostname;
    const protocol = win.location.protocol;
    const isLocalHost = isLocalHostname(host);

    if (isLocalHost) {
      if (env.VITE_USE_REMOTE_API === "true" && configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/$/, "");
      }
      if (protocol === "https:") {
        return "/api";
      }
      return `http://${host}:4000/api`;
    }

    if (env.VITE_USE_REMOTE_API === "true" && configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, "");
    }

    return "/api";
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return "http://localhost:4000/api";
}

const API_BASE_URL = resolveApiBaseUrl();

function readCookieValue(name, doc = typeof document !== "undefined" ? document : undefined) {
  if (!doc || typeof doc.cookie !== "string" || !doc.cookie) {
    return "";
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const entry = doc.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) {
    return "";
  }

  const value = entry.slice(prefix.length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isMutatingMethod(method) {
  return !SAFE_HTTP_METHODS.has(String(method || "GET").toUpperCase());
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
      method: "GET",
      credentials: "include",
    });
  } catch {
    throw new Error("Failed to fetch. Check API URL, server status, and CORS settings.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  if (typeof data.csrfToken !== "string" || !data.csrfToken) {
    throw new Error("CSRF token could not be loaded.");
  }

  csrfTokenCache = data.csrfToken;
  return csrfTokenCache;
}

async function performRequest(path, requestOptions = {}, options = {}, hasRetriedCsrf = false) {
  const { method = "GET", body, token } = requestOptions;
  const { fetchImpl = fetch, baseUrl = API_BASE_URL } = options;
  const shouldSendBearerToken = Boolean(token) && token !== authStorageKeys.COOKIE_AUTH_PLACEHOLDER;
  const shouldAttachCsrf = isMutatingMethod(method) && !shouldSendBearerToken;
  const csrfToken = shouldAttachCsrf
    ? (readCookieValue(CSRF_COOKIE_NAME) || csrfTokenCache || await fetchCsrfToken({ fetchImpl, baseUrl }))
    : "";

  let response;

  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(shouldSendBearerToken ? { Authorization: `Bearer ${token}` } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("Failed to fetch. Check API URL, server status, and CORS settings.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok && shouldAttachCsrf && !hasRetriedCsrf && (data.code === "CSRF_REQUIRED" || data.code === "CSRF_INVALID")) {
    csrfTokenCache = "";
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
