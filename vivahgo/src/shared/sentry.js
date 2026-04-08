import * as Sentry from "@sentry/react";
import { capturePostHogEvent, setPostHogPersonProperties } from "./posthog.js";
import {
  getObservabilityContext,
  getObservabilityPersonProperties,
  getOrCreateAxiomTraceId,
  setObservabilityLastSentryEventId,
} from "./observability.js";

let browserSentryInitialized = false;
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

function resolveTraceSampleRate(env = getRuntimeEnv()) {
  return resolveEnvironment(env) === "production" ? 0.1 : 1;
}

function resolveSentryProjectUrl(env = getRuntimeEnv()) {
  const url = typeof env.VITE_SENTRY_PROJECT_URL === "string" ? env.VITE_SENTRY_PROJECT_URL.trim() : "";
  return url.replace(/\/+$/, "");
}

function buildSentrySearchUrl(eventId, env = getRuntimeEnv()) {
  const projectUrl = resolveSentryProjectUrl(env);
  if (!projectUrl || !eventId) {
    return "";
  }

  if (projectUrl.endsWith("/issues")) {
    return `${projectUrl}/?query=${encodeURIComponent(eventId)}`;
  }

  return `${projectUrl}/issues/?query=${encodeURIComponent(eventId)}`;
}

function getCurrentRoutePath(win = typeof window !== "undefined" ? window : undefined) {
  if (!win || !win.location) {
    return "/";
  }

  return `${win.location.pathname || "/"}${win.location.search || ""}`;
}

function isAuthenticatedSession(session) {
  return session?.mode === "google" || session?.mode === "clerk";
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
    setSentryRoute(nextPath);

    const client = Sentry.getClient();
    if (!client) {
      return;
    }

    Sentry.startBrowserTracingNavigationSpan(
      client,
      {
        name: nextPath,
        op: "navigation",
      },
      {
        url: window.location.href,
      }
    );
  };

  const wrapHistoryMethod = (methodName) => {
    const originalMethod = window.history?.[methodName];
    if (typeof originalMethod !== "function") {
      return;
    }

    window.history[methodName] = function sentryHistoryMethod(...args) {
      const result = originalMethod.apply(this, args);
      notifyNavigation();
      return result;
    };
  };

  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  window.addEventListener("popstate", notifyNavigation);
}

export function initSentry(options = {}) {
  if (browserSentryInitialized) {
    if (options.session) {
      syncSentrySession(options.session);
    }
    return Boolean(Sentry.getClient());
  }

  browserSentryInitialized = true;

  const env = getRuntimeEnv();
  const dsn = typeof env.VITE_SENTRY_DSN === "string" ? env.VITE_SENTRY_DSN.trim() : "";
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: resolveEnvironment(env),
    sendDefaultPii: true,
    integrations: [
      Sentry.browserTracingIntegration({
        instrumentNavigation: false,
        beforeStartSpan(spanOptions) {
          return {
            ...spanOptions,
            name: getCurrentRoutePath(),
          };
        },
      }),
    ],
    tracesSampleRate: resolveTraceSampleRate(env),
  });

  installNavigationInstrumentation();
  setSentryRoute(getCurrentRoutePath());
  Sentry.setTag("axiom_trace_id", getOrCreateAxiomTraceId());
  Sentry.setContext("observability", getObservabilityContext());
  syncSentrySession(options.session || null);
  return true;
}

export function setSentryUser(user, options = {}) {
  if (!Sentry.getClient() || !user || typeof user !== "object") {
    return;
  }

  const userId = typeof user.id === "string" ? user.id : "";
  const email = typeof user.email === "string" ? user.email : "";
  const name = typeof user.name === "string" ? user.name : "";
  const plannerOwnerId = typeof options.plannerOwnerId === "string" ? options.plannerOwnerId : "";
  const authMode = typeof options.authMode === "string" ? options.authMode : "authenticated";

  Sentry.setUser({
    id: userId || undefined,
    email: email || undefined,
    username: name || undefined,
  });
  Sentry.setTag("user.id", userId || "anonymous");
  Sentry.setTag("auth.mode", authMode);
  Sentry.setTag("planner_owner_id", plannerOwnerId || "none");
  Sentry.setContext("auth", {
    mode: authMode,
    plannerOwnerId: plannerOwnerId || "",
  });
}

export function clearSentryUser(options = {}) {
  if (!Sentry.getClient()) {
    return;
  }

  const authMode = typeof options.authMode === "string" ? options.authMode : "anonymous";
  const plannerOwnerId = typeof options.plannerOwnerId === "string" ? options.plannerOwnerId : "";

  Sentry.setUser(null);
  Sentry.setTag("user.id", "anonymous");
  Sentry.setTag("auth.mode", authMode);
  Sentry.setTag("planner_owner_id", plannerOwnerId || "none");
  Sentry.setContext("auth", {
    mode: authMode,
    plannerOwnerId: plannerOwnerId || "",
  });
}

export function setSentryRoute(path, options = {}) {
  if (!Sentry.getClient()) {
    return;
  }

  const routePath = String(path || getCurrentRoutePath()).trim() || "/";
  const bodyRoute = typeof options.bodyRoute === "string" ? options.bodyRoute : "";

  Sentry.setTag("route", routePath);
  Sentry.setContext("route", {
    path: routePath,
    bodyRoute,
  });
}

export function syncSentrySession(session) {
  if (!Sentry.getClient()) {
    return;
  }

  if (isAuthenticatedSession(session) && session.user) {
    setSentryUser(session.user, {
      authMode: session.mode,
      plannerOwnerId: session.plannerOwnerId || session.user?.id || "",
    });
    return;
  }

  clearSentryUser({
    authMode: session?.mode || "anonymous",
    plannerOwnerId: session?.plannerOwnerId || "",
  });
}

export function captureException(error, context = {}) {
  if (!Sentry.getClient() || !error) {
    return null;
  }

  return Sentry.withScope((scope) => {
    const observabilityContext = getObservabilityContext();
    if (context.tags && typeof context.tags === "object") {
      scope.setTags(context.tags);
    }

    if (context.extra && typeof context.extra === "object") {
      scope.setExtras(context.extra);
    }

    if (context.contexts && typeof context.contexts === "object") {
      Object.entries(context.contexts).forEach(([key, value]) => {
        if (value && typeof value === "object") {
          scope.setContext(key, value);
        }
      });
    }

    scope.setTag("axiom_trace_id", getOrCreateAxiomTraceId());
    scope.setContext("observability", observabilityContext);

    const eventId = Sentry.captureException(error);
    if (!eventId) {
      return eventId;
    }

    const sentrySearchUrl = buildSentrySearchUrl(eventId);
    setObservabilityLastSentryEventId(eventId);
    setPostHogPersonProperties({
      ...getObservabilityPersonProperties(),
      last_sentry_error_url: sentrySearchUrl || undefined,
    });
    capturePostHogEvent("exception_occurred", {
      sentry_event_id: eventId,
      sentry_url: sentrySearchUrl || undefined,
      error_name: typeof error?.name === "string" ? error.name : "Error",
      error_message: typeof error?.message === "string" ? error.message : "Unknown error",
      route: observabilityContext.route || undefined,
      posthog_distinct_id: observabilityContext.posthogDistinctId || undefined,
      axiom_trace_id: observabilityContext.axiomTraceId || undefined,
      clarity_link: observabilityContext.clarityReplayUrl || undefined,
    });

    return eventId;
  });
}
