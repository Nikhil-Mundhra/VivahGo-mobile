import { authStorageKeys } from "../../authStorage.js";
import { getObservabilityHeaders } from "../observability.js";
import { captureException } from "../sentry.js";

const CSRF_COOKIE_NAME = "vivahgo_csrf";
const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
let csrfTokenCache = "";
const requestMemoryCache = new Map();
const inflightRequestCache = new Map();

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

function normalizeInvalidateKeys(keys) {
  if (!Array.isArray(keys)) {
    return [];
  }

  return keys
    .map((key) => String(key || "").trim())
    .filter(Boolean);
}

function buildAuthScope(token) {
  return token && token !== authStorageKeys.COOKIE_AUTH_PLACEHOLDER
    ? `bearer:${token}`
    : "cookie";
}

function buildRequestCacheKey(path, requestOptions = {}, baseUrl = API_BASE_URL) {
  const { method = "GET", token, cacheKey } = requestOptions;
  const authScope = buildAuthScope(token);

  if (cacheKey) {
    return `${String(cacheKey)}:${authScope}`;
  }

  const normalizedMethod = String(method || "GET").toUpperCase();
  return `${normalizedMethod}:${baseUrl}${path}:${authScope}`;
}

export function invalidateRequestCache(keys) {
  const normalizedKeys = Array.isArray(keys) ? keys : [keys];

  for (const key of normalizedKeys.map((entry) => String(entry || "").trim()).filter(Boolean)) {
    requestMemoryCache.delete(key);
    inflightRequestCache.delete(key);
  }
}

export function resetRequestCache() {
  requestMemoryCache.clear();
  inflightRequestCache.clear();
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
  const {
    method = "GET",
    body,
    token,
    ttlMs = 0,
    invalidateKeys = [],
  } = requestOptions;
  const { fetchImpl = fetch, baseUrl = API_BASE_URL } = options;
  const shouldSendBearerToken = Boolean(token) && token !== authStorageKeys.COOKIE_AUTH_PLACEHOLDER;
  const shouldAttachCsrf = isMutatingMethod(method) && !shouldSendBearerToken;
  const normalizedMethod = String(method || "GET").toUpperCase();
  const isCacheableRequest = !hasRetriedCsrf && normalizedMethod === "GET" && Number(ttlMs) > 0 && !body;
  const cacheKey = buildRequestCacheKey(path, requestOptions, baseUrl);
  const now = Date.now();

  if (isCacheableRequest) {
    const cached = requestMemoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    if (inflightRequestCache.has(cacheKey)) {
      return inflightRequestCache.get(cacheKey);
    }
  }

  const execute = async () => {
    const csrfToken = shouldAttachCsrf
      ? (readCookieValue(CSRF_COOKIE_NAME) || csrfTokenCache || await fetchCsrfToken({ fetchImpl, baseUrl }))
      : "";

    let response;

    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: normalizedMethod,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(shouldSendBearerToken ? { Authorization: `Bearer ${token}` } : {}),
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          ...getObservabilityHeaders(),
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
      const requestError = new Error(data.error || `Request failed (${response.status}).`);
      requestError.status = response.status;
      requestError.code = typeof data.code === "string" ? data.code : "";
      requestError.responseData = data;
      throw requestError;
    }

    if (isCacheableRequest) {
      requestMemoryCache.set(cacheKey, {
        value: data,
        expiresAt: Date.now() + Math.max(1, Number(ttlMs)),
      });
    }

    if (isMutatingMethod(normalizedMethod)) {
      const authScope = buildAuthScope(token);
      const scopedKeys = normalizeInvalidateKeys(invalidateKeys).map(
        (key) => `${key}:${authScope}`
      );
      invalidateRequestCache(scopedKeys);
    }

    return data;
  };

  if (!isCacheableRequest) {
    return execute();
  }

  const requestPromise = execute().finally(() => {
    inflightRequestCache.delete(cacheKey);
  });
  inflightRequestCache.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function request(path, requestOptions = {}, options = {}) {
  try {
    return await performRequest(path, requestOptions, options);
  } catch (error) {
    const status = Number(error?.status);
    if (!Number.isFinite(status) || status >= 500) {
      captureException(error, {
        tags: {
          "request.path": path,
          "request.method": String(requestOptions?.method || "GET").toUpperCase(),
        },
        extra: {
          status: Number.isFinite(status) ? status : undefined,
          code:
            typeof error?.code === "string" && error.code
              ? error.code
              : undefined,
          baseUrl: options?.baseUrl || API_BASE_URL,
        },
      });
    }

    throw error;
  }
}
