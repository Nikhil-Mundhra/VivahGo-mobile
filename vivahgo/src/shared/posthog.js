import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import { getRouteInfo } from "../app/routes/appRoutes.js";
import {
  getObservabilityContext,
  getObservabilityPersonProperties,
  getOrCreateAxiomTraceId,
  setObservabilityPostHogDistinctId,
} from "./observability.js";

const NAVIGATION_EVENT_NAME = "vivahgo:navigation";

let browserPostHogInitialized = false;
let browserPostHogEnabled = false;
let navigationInstrumentationInstalled = false;
let lastNavigationPath = "";

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

function buildRouteProperties(path, options = {}, win = typeof window !== "undefined" ? window : undefined) {
  const locationRef = getBrowserLocation(win);
  const routePath = String(path || getCurrentRoutePath(win)).trim() || "/";
  const pathname = routePath.split("?")[0] || "/";
  const hostname = normalizeHost(locationRef?.hostname);
  const routeInfo = getRouteInfo(pathname, { hostname });
  const bodyRoute = typeof options.bodyRoute === "string" && options.bodyRoute
    ? options.bodyRoute
    : routeInfo.bodyRoute;

  return {
    app_env: resolveEnvironment(),
    route: routePath,
    pathname,
    body_route: bodyRoute,
    $current_url: locationRef?.href || routePath,
  };
}

function syncDistinctIdToSentry() {
  if (!browserPostHogEnabled) {
    return "";
  }

  const distinctId = String(posthog.get_distinct_id() || "").trim() || "anonymous";
  setObservabilityPostHogDistinctId(distinctId);

  if (!Sentry.getClient()) {
    return distinctId;
  }

  const observabilityContext = getObservabilityContext();
  Sentry.setTag("posthog_id", distinctId);
  Sentry.setTag("axiom_trace_id", getOrCreateAxiomTraceId());
  Sentry.setContext("observability", {
    posthogDistinctId: distinctId,
    ...observabilityContext,
  });
  return distinctId;
}

function syncObservabilityPersonProperties() {
  if (!browserPostHogEnabled) {
    return {};
  }

  const properties = getObservabilityPersonProperties();
  const rootProperties = {
    app_env: resolveEnvironment(),
    axiom_trace_id: getOrCreateAxiomTraceId(),
    ms_clarity_link: properties.ms_clarity_link,
    ms_clarity_custom_session_id: properties.ms_clarity_custom_session_id,
    ms_clarity_custom_page_id: properties.ms_clarity_custom_page_id,
    last_sentry_error: properties.last_sentry_error,
  };

  posthog.register(rootProperties);
  if (Object.keys(properties).length > 0) {
    posthog.setPersonProperties(properties);
  }

  return {
    ...rootProperties,
    ...properties,
  };
}

function installNavigationInstrumentation() {
  if (navigationInstrumentationInstalled || typeof window === "undefined") {
    return;
  }

  navigationInstrumentationInstalled = true;
  lastNavigationPath = getCurrentRoutePath(window);

  const notifyNavigation = () => {
    const nextPath = getCurrentRoutePath(window);
    if (!nextPath || nextPath === lastNavigationPath) {
      return;
    }

    lastNavigationPath = nextPath;
    window.dispatchEvent(new Event(NAVIGATION_EVENT_NAME));
  };

  const wrapHistoryMethod = (methodName) => {
    const originalMethod = window.history?.[methodName];
    if (typeof originalMethod !== "function") {
      return;
    }

    window.history[methodName] = function posthogHistoryMethod(...args) {
      const result = originalMethod.apply(this, args);
      notifyNavigation();
      return result;
    };
  };

  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  window.addEventListener("popstate", notifyNavigation);
}

function isAuthenticatedSession(session) {
  return session?.mode === "google" || session?.mode === "clerk";
}

function syncPostHogSession(session) {
  if (!browserPostHogEnabled) {
    return;
  }

  if (isAuthenticatedSession(session) && session.user) {
    identifyPostHogUser(session.user, {
      authMode: session.mode,
      plannerOwnerId: session.plannerOwnerId || session.user?.id || "",
    });
    return;
  }

  posthog.register({
    app_env: resolveEnvironment(),
    auth_mode: session?.mode || "anonymous",
    planner_owner_id: session?.plannerOwnerId || "none",
  });
  syncDistinctIdToSentry();
}

export function getCurrentPostHogRoutePath() {
  return getCurrentRoutePath();
}

export function subscribeToPostHogRouteChanges(callback) {
  installNavigationInstrumentation();

  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }

  window.addEventListener(NAVIGATION_EVENT_NAME, callback);
  return () => {
    window.removeEventListener(NAVIGATION_EVENT_NAME, callback);
  };
}

export function initPostHog(options = {}) {
  if (browserPostHogInitialized) {
    if (options.session) {
      syncPostHogSession(options.session);
    }
    syncDistinctIdToSentry();
    return browserPostHogEnabled;
  }

  browserPostHogInitialized = true;

  const env = getRuntimeEnv();
  const apiKey = typeof env.VITE_POSTHOG_KEY === "string" ? env.VITE_POSTHOG_KEY.trim() : "";
  const apiHost = typeof env.VITE_POSTHOG_HOST === "string" ? env.VITE_POSTHOG_HOST.trim().replace(/\/$/, "") : "";

  installNavigationInstrumentation();

  if (!apiKey || !apiHost) {
    return false;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: "identified_only",
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    session_recording: false,
    loaded: () => {
      syncDistinctIdToSentry();
    },
  });

  browserPostHogEnabled = true;
  posthog.register({
    app_env: resolveEnvironment(env),
    axiom_trace_id: getOrCreateAxiomTraceId(),
  });
  syncObservabilityPersonProperties();
  syncDistinctIdToSentry();
  syncPostHogSession(options.session || null);
  return true;
}

export function identifyPostHogUser(user, options = {}) {
  if (!browserPostHogEnabled || !user || typeof user !== "object") {
    return;
  }

  const userId = typeof user.id === "string" ? user.id.trim() : "";
  if (!userId) {
    return;
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const authMode = typeof options.authMode === "string" ? options.authMode : "authenticated";
  const plannerOwnerId = typeof options.plannerOwnerId === "string" ? options.plannerOwnerId : "";

  const personProperties = {
    auth_mode: authMode,
    planner_owner_id: plannerOwnerId || "none",
    email: email || undefined,
    name: name || undefined,
  };

  posthog.identify(userId, personProperties);
  posthog.register({
    auth_mode: authMode,
    planner_owner_id: plannerOwnerId || "none",
    user_id: userId,
    user_email: email || undefined,
    axiom_trace_id: getOrCreateAxiomTraceId(),
  });
  syncObservabilityPersonProperties();
  syncDistinctIdToSentry();
}

export function setPostHogPersonProperties(properties = {}) {
  if (!browserPostHogEnabled || !properties || typeof properties !== "object") {
    return;
  }

  const normalizedProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => typeof value !== "undefined" && value !== null && value !== "")
  );

  if (Object.keys(normalizedProperties).length === 0) {
    return;
  }

  posthog.setPersonProperties(normalizedProperties);
  syncObservabilityPersonProperties();
}

export function resetPostHogUser() {
  if (!browserPostHogEnabled) {
    return;
  }

  posthog.reset();
  posthog.register({
    app_env: resolveEnvironment(),
    auth_mode: "anonymous",
    planner_owner_id: "none",
    axiom_trace_id: getOrCreateAxiomTraceId(),
  });
  syncObservabilityPersonProperties();
  syncDistinctIdToSentry();
}

export function capturePostHogEvent(name, properties = {}) {
  if (!browserPostHogEnabled || typeof name !== "string" || !name.trim()) {
    return null;
  }

  return posthog.capture(name, properties);
}

export function setPostHogRouteContext(path, options = {}) {
  const routeProperties = buildRouteProperties(path, options);

  if (browserPostHogEnabled) {
    posthog.register(routeProperties);
  }

  return routeProperties;
}
