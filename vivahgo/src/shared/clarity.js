import * as Sentry from "@sentry/react";
import { getRouteInfo } from "../app/routes/appRoutes.js";
import {
  buildClarityReplayUrl,
  getObservabilityContext,
  getObservabilityPersonProperties,
  getOrCreateAxiomTraceId,
  setObservabilityClarityContext,
} from "./observability.js";
import { setPostHogPersonProperties } from "./posthog.js";

const CLARITY_SCRIPT_ID = "vivahgo-clarity-script";
const CLARITY_SESSION_STORAGE_KEY = "vivahgo.claritySessionId";
const DEFAULT_CLARITY_DELAY_MS = 3000;

let browserClarityInitialized = false;
let browserClarityEnabled = false;
let clarityProjectId = "";
let clarityScriptLoadScheduled = false;
let inMemoryClaritySessionId = "";
let currentClaritySession = null;
let currentClarityRoutePath = "/";
let currentClarityBodyRoute = "";

function getRuntimeEnv() {
  if (typeof import.meta !== "undefined" && import.meta && import.meta.env) {
    return import.meta.env;
  }

  return {};
}

function resolveEnvironment(env = getRuntimeEnv()) {
  return String(env.VITE_APP_ENV || env.MODE || "development");
}

function getBrowserLocation(win = typeof window !== "undefined" ? window : undefined) {
  return win?.location || null;
}

function getCurrentRoutePath(win = typeof window !== "undefined" ? window : undefined) {
  const locationRef = getBrowserLocation(win);
  if (!locationRef) {
    return "/";
  }

  return `${locationRef.pathname || "/"}${locationRef.search || ""}`;
}

function normalizeHost(hostname) {
  return typeof hostname === "string" ? hostname : "";
}

function getFriendlyName(user) {
  if (typeof user?.name === "string" && user.name.trim()) {
    return user.name.trim();
  }

  if (typeof user?.email === "string" && user.email.trim()) {
    return user.email.trim();
  }

  if (typeof user?.id === "string" && user.id.trim()) {
    return user.id.trim();
  }

  return "VivahGo user";
}

function isAuthenticatedSession(session) {
  return session?.mode === "google" || session?.mode === "clerk";
}

function secureRandomIdFallback() {
  try {
    // Prefer Web Crypto API if available (browsers, modern runtimes via globalThis.crypto)
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // ignore and use the non-crypto fallback below
  }

  // Browser-safe last resort for environments without Web Crypto.
  // Avoid Node-only modules in this frontend bundle.
  const timestampPart = Date.now().toString(16);
  const performancePart =
    typeof globalThis.performance !== "undefined" &&
    typeof globalThis.performance.now === "function"
      ? Math.floor(globalThis.performance.now() * 1000).toString(16)
      : "0";

  return `${timestampPart}${performancePart}`;
}

function generateClaritySessionId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `clarity_${globalThis.crypto.randomUUID()}`;
  }

  return `clarity_${secureRandomIdFallback()}`;
}

function getSessionStorageRef(storageRef) {
  return storageRef ?? (typeof window !== "undefined" ? window.sessionStorage : null);
}

function getClaritySessionId(storageRef) {
  if (inMemoryClaritySessionId) {
    return inMemoryClaritySessionId;
  }

  const sessionStorageRef = getSessionStorageRef(storageRef);
  const storedValue = sessionStorageRef?.getItem?.(CLARITY_SESSION_STORAGE_KEY);
  if (typeof storedValue === "string" && storedValue.trim()) {
    inMemoryClaritySessionId = storedValue.trim();
    return inMemoryClaritySessionId;
  }

  inMemoryClaritySessionId = generateClaritySessionId();
  sessionStorageRef?.setItem?.(CLARITY_SESSION_STORAGE_KEY, inMemoryClaritySessionId);
  return inMemoryClaritySessionId;
}

function rotateClaritySessionId(storageRef) {
  const sessionStorageRef = getSessionStorageRef(storageRef);
  inMemoryClaritySessionId = generateClaritySessionId();
  sessionStorageRef?.setItem?.(CLARITY_SESSION_STORAGE_KEY, inMemoryClaritySessionId);
  return inMemoryClaritySessionId;
}

function buildRouteContext(path, options = {}, win = typeof window !== "undefined" ? window : undefined) {
  const routePath = String(path || getCurrentRoutePath(win)).trim() || "/";
  const pathname = routePath.split("?")[0] || "/";
  const hostname = normalizeHost(getBrowserLocation(win)?.hostname);
  const routeInfo = getRouteInfo(pathname, { hostname });
  const bodyRoute = typeof options.bodyRoute === "string" && options.bodyRoute
    ? options.bodyRoute
    : routeInfo.bodyRoute;

  return {
    appEnv: resolveEnvironment(),
    routePath,
    pathname,
    bodyRoute,
  };
}

function buildClarityPageId(routePath, bodyRoute) {
  const pathname = String(routePath || "/").trim().split("?")[0] || "/";
  return `${String(bodyRoute || "app")}:${pathname}`;
}

function ensureClarityCommandQueue(win = typeof window !== "undefined" ? window : undefined) {
  if (!win) {
    return false;
  }

  if (typeof win.clarity === "function") {
    return true;
  }

  win.clarity = function clarityQueue(...args) {
    (win.clarity.q = win.clarity.q || []).push(args);
  };
  win.clarity.q = win.clarity.q || [];
  return true;
}

function setClarityTag(key, value, win = typeof window !== "undefined" ? window : undefined) {
  if (!browserClarityEnabled || !win || typeof win.clarity !== "function") {
    return;
  }

  const normalizedValue = typeof value === "string" ? value : String(value || "");
  win.clarity("set", key, normalizedValue);
}

function syncClarityIdsToPostHog(metadata, sessionId, pageId) {
  const resolvedSessionId = metadata && typeof metadata === "object" && typeof metadata.session === "string"
    ? metadata.session
    : sessionId || "";
  const resolvedPageId = metadata && typeof metadata === "object" && typeof metadata.page === "string"
    ? metadata.page
    : pageId || "";
  const replayUrl = buildClarityReplayUrl(clarityProjectId, resolvedSessionId);

  setObservabilityClarityContext({
    projectId: clarityProjectId,
    sessionId: resolvedSessionId,
    pageId: resolvedPageId,
    userIdHash: typeof metadata?.id === "string" ? metadata.id : "",
    replayUrl,
  });

  if (Sentry.getClient()) {
    Sentry.setTag("clarity_session_id", resolvedSessionId || "none");
    Sentry.setTag("clarity_page_id", resolvedPageId || "none");
    Sentry.setTag("axiom_trace_id", getOrCreateAxiomTraceId());
    Sentry.setContext("observability", getObservabilityContext());
    Sentry.setContext("clarity", {
      projectId: clarityProjectId || "",
      sessionId: resolvedSessionId || "",
      pageId: resolvedPageId || "",
      replayUrl,
    });
  }

  if (!metadata || typeof metadata !== "object") {
    setPostHogPersonProperties({
      ...getObservabilityPersonProperties(),
    });
    return;
  }

  setPostHogPersonProperties({
    ...getObservabilityPersonProperties(),
    ms_clarity_user_hint: typeof metadata.userHint === "string" ? metadata.userHint : undefined,
  });
}

function syncClarityContext(win = typeof window !== "undefined" ? window : undefined) {
  if (!browserClarityEnabled || !win || typeof win.clarity !== "function") {
    return;
  }

  const routeContext = buildRouteContext(currentClarityRoutePath, { bodyRoute: currentClarityBodyRoute }, win);
  const session = currentClaritySession;
  const sessionId = getClaritySessionId();
  const pageId = buildClarityPageId(routeContext.routePath, routeContext.bodyRoute);

  setClarityTag("app_env", routeContext.appEnv, win);
  setClarityTag("route", routeContext.routePath, win);
  setClarityTag("body_route", routeContext.bodyRoute, win);
  setClarityTag("clarity_custom_session_id", sessionId, win);
  setClarityTag("clarity_custom_page_id", pageId, win);

  if (!isAuthenticatedSession(session) || !session.user) {
    setClarityTag("auth_mode", session?.mode || "anonymous", win);
    setClarityTag("planner_owner_id", session?.plannerOwnerId || "none", win);
    return;
  }

  const userId = typeof session.user.id === "string" ? session.user.id.trim() : "";
  if (!userId) {
    return;
  }

  setClarityTag("auth_mode", session.mode, win);
  setClarityTag("planner_owner_id", session.plannerOwnerId || session.user.id || "none", win);
  setClarityTag("user_id", userId, win);

  const identifyResult = win.clarity(
    "identify",
    userId,
    sessionId,
    pageId,
    getFriendlyName(session.user)
  );

  syncClarityIdsToPostHog(null, sessionId, pageId);

  if (identifyResult && typeof identifyResult.then === "function") {
    identifyResult
      .then((metadata) => {
        syncClarityIdsToPostHog(metadata, sessionId, pageId);
      })
      .catch(() => {
        // Best effort only.
      });
  }
}

function injectClarityScript(win = typeof window !== "undefined" ? window : undefined, doc = typeof document !== "undefined" ? document : undefined) {
  if (!browserClarityEnabled || !win || !doc) {
    return;
  }

  if (doc.getElementById(CLARITY_SCRIPT_ID)) {
    syncClarityContext(win);
    return;
  }

  const script = doc.createElement("script");
  script.id = CLARITY_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(clarityProjectId)}`;
  script.onload = () => {
    syncClarityContext(win);
  };

  (doc.head || doc.body || doc.documentElement)?.appendChild(script);
}

function scheduleClarityScriptLoad(delayMs = DEFAULT_CLARITY_DELAY_MS, win = typeof window !== "undefined" ? window : undefined, doc = typeof document !== "undefined" ? document : undefined) {
  if (clarityScriptLoadScheduled || !browserClarityEnabled || !win || !doc) {
    return;
  }

  clarityScriptLoadScheduled = true;
  win.setTimeout(() => {
    const inject = () => injectClarityScript(win, doc);
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(inject, { timeout: 2000 });
      return;
    }

    inject();
  }, Math.max(0, Number(delayMs) || DEFAULT_CLARITY_DELAY_MS));
}

export function initClarity(options = {}) {
  if (browserClarityInitialized) {
    if (Object.prototype.hasOwnProperty.call(options, "session")) {
      syncClaritySession(options.session || null);
    }
    scheduleClarityScriptLoad(options.delayMs);
    return browserClarityEnabled;
  }

  browserClarityInitialized = true;
  const env = getRuntimeEnv();
  const projectId = typeof env.VITE_CLARITY_PROJECT_ID === "string" ? env.VITE_CLARITY_PROJECT_ID.trim() : "";

  if (!projectId || typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  clarityProjectId = projectId;
  browserClarityEnabled = ensureClarityCommandQueue(window);
  currentClarityRoutePath = getCurrentRoutePath(window);
  currentClarityBodyRoute = buildRouteContext(currentClarityRoutePath, {}, window).bodyRoute;
  currentClaritySession = options.session || null;

  syncClarityContext(window);
  scheduleClarityScriptLoad(options.delayMs, window, document);
  return browserClarityEnabled;
}

export function setClarityRouteContext(path, options = {}) {
  const routeContext = buildRouteContext(path, options);
  currentClarityRoutePath = routeContext.routePath;
  currentClarityBodyRoute = routeContext.bodyRoute;
  syncClarityContext();

  return {
    route: routeContext.routePath,
    pathname: routeContext.pathname,
    body_route: routeContext.bodyRoute,
    clarity_custom_session_id: getClaritySessionId(),
    clarity_custom_page_id: buildClarityPageId(routeContext.routePath, routeContext.bodyRoute),
  };
}

export function syncClaritySession(session) {
  currentClaritySession = session || null;
  syncClarityContext();
}

export function clearClarityUser(options = {}) {
  currentClaritySession = null;
  const nextSessionId = rotateClaritySessionId(options.sessionStorageRef);
  const pageId = buildClarityPageId(currentClarityRoutePath, currentClarityBodyRoute);
  setObservabilityClarityContext({
    projectId: clarityProjectId,
    sessionId: nextSessionId,
    pageId,
    replayUrl: buildClarityReplayUrl(clarityProjectId, nextSessionId),
  });
  setClarityTag("auth_mode", typeof options.authMode === "string" ? options.authMode : "anonymous");
  setClarityTag("planner_owner_id", typeof options.plannerOwnerId === "string" && options.plannerOwnerId ? options.plannerOwnerId : "none");
  setClarityTag("clarity_custom_session_id", getClaritySessionId(options.sessionStorageRef));
  setPostHogPersonProperties(getObservabilityPersonProperties(options.sessionStorageRef));
}

export function captureClarityEvent(name, value) {
  if (!browserClarityEnabled || typeof window === "undefined" || typeof window.clarity !== "function") {
    return null;
  }

  if (typeof name !== "string" || !name.trim()) {
    return null;
  }

  if (typeof value === "undefined") {
    return window.clarity("event", name.trim());
  }

  return window.clarity("event", name.trim(), value);
}
