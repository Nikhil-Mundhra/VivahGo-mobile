import * as Sentry from "@sentry/node";
import { flushServerLogger, logServerError } from "./logger.js";

let serverSentryInitialized = false;
let processHandlersRegistered = false;

function resolveEnvironment() {
  return String(process.env.APP_ENV || process.env.NODE_ENV || "development");
}

function resolveTraceSampleRate() {
  return resolveEnvironment() === "production" ? 0.1 : 1;
}

function getErrorStatusCode(error) {
  const statusCode = error?.status || error?.statusCode || error?.status_code || error?.output?.statusCode;
  const normalizedStatus = Number.parseInt(String(statusCode || ""), 10);
  return Number.isFinite(normalizedStatus) ? normalizedStatus : 500;
}

function inferAuthMode(subject) {
  return String(subject || "").startsWith("clerk:") ? "clerk" : "session";
}

function readHeader(req, name) {
  const headerValue = req?.headers?.[name];
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === "string" ? headerValue[0] : "";
  }

  return typeof headerValue === "string" ? headerValue : "";
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown server error");
}

function registerProcessHandlers() {
  if (processHandlersRegistered) {
    return;
  }

  processHandlersRegistered = true;

  process.on("unhandledRejection", (reason) => {
    logServerError("Unhandled promise rejection", {
      error: normalizeError(reason),
      fields: {
        origin: "process.unhandledRejection",
      },
      root: {
        origin: "process.unhandledRejection",
      },
    });

    captureServerException(normalizeError(reason), {
      tags: {
        origin: "process.unhandledRejection",
      },
    });
  });

  process.on("uncaughtException", (error) => {
    logServerError("Uncaught exception", {
      error: normalizeError(error),
      fields: {
        origin: "process.uncaughtException",
      },
      root: {
        origin: "process.uncaughtException",
      },
    });

    captureServerException(normalizeError(error), {
      tags: {
        origin: "process.uncaughtException",
      },
    });

    void Promise.allSettled([flushServerLogger(), flushServerSentry(2000)]).finally(() => {
      process.exit(1);
    });
  });
}

export function initServerSentry() {
  if (serverSentryInitialized) {
    return Boolean(process.env.SENTRY_DSN);
  }

  serverSentryInitialized = true;
  registerProcessHandlers();

  const dsn = typeof process.env.SENTRY_DSN === "string" ? process.env.SENTRY_DSN.trim() : "";
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: resolveEnvironment(),
    sendDefaultPii: true,
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: resolveTraceSampleRate(),
  });

  return true;
}

export function sentryRequestContextMiddleware(req, _res, next) {
  if (Sentry.getClient()) {
    const plannerOwnerId = typeof req.query?.plannerOwnerId === "string"
      ? req.query.plannerOwnerId
      : typeof req.body?.plannerOwnerId === "string"
        ? req.body.plannerOwnerId
        : "";
    const posthogDistinctId = readHeader(req, "x-posthog-distinct-id");
    const axiomTraceId = readHeader(req, "x-axiom-trace-id");
    const claritySessionId = readHeader(req, "x-clarity-session-id");
    const clarityPageId = readHeader(req, "x-clarity-page-id");

    Sentry.setTag("route", `${req.method} ${req.path}`);
    Sentry.setTag("planner_owner_id", plannerOwnerId || "none");
    Sentry.setTag("posthog_id", posthogDistinctId || "anonymous");
    Sentry.setTag("axiom_trace_id", axiomTraceId || "none");
    Sentry.setContext("request", {
      method: req.method,
      path: req.path,
      plannerOwnerId,
    });
    Sentry.setContext("observability", {
      posthogDistinctId,
      axiomTraceId,
      claritySessionId,
      clarityPageId,
    });
  }

  next();
}

export function setSentryRequestUser(auth) {
  if (!Sentry.getClient() || !auth || typeof auth !== "object") {
    return;
  }

  const subject = typeof auth.sub === "string" ? auth.sub : "";
  const email = typeof auth.email === "string" ? auth.email : "";
  const name = typeof auth.name === "string" ? auth.name : "";
  const plannerOwnerId = typeof auth.plannerOwnerId === "string" ? auth.plannerOwnerId : "";
  const authMode = inferAuthMode(subject);

  Sentry.setUser({
    id: subject || undefined,
    email: email || undefined,
    username: name || undefined,
  });
  Sentry.setTag("user.id", subject || "anonymous");
  Sentry.setTag("auth.mode", authMode);
  Sentry.setTag("planner_owner_id", plannerOwnerId || "none");
  Sentry.setContext("auth", {
    mode: authMode,
    plannerOwnerId,
    staffRole: typeof auth.staffRole === "string" ? auth.staffRole : "",
  });
}

export function captureServerException(error, context = {}) {
  if (!error || !Sentry.getClient()) {
    return null;
  }

  return Sentry.withScope((scope) => {
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

    return Sentry.captureException(error);
  });
}

export function setupSentryErrorHandlers(app) {
  if (!Sentry.getClient()) {
    return;
  }

  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError(error) {
      return getErrorStatusCode(error) >= 500;
    },
  });
}

export function createFinalErrorMiddleware() {
  return function finalErrorMiddleware(error, _req, res, next) {
    if (res.headersSent) {
      return next(error);
    }

    const statusCode = Math.max(400, getErrorStatusCode(error));
    return res.status(statusCode).json({
      error: error?.message || "An unexpected error occurred.",
    });
  };
}

export async function flushServerSentry(timeoutMs = 2000) {
  if (!Sentry.getClient()) {
    return false;
  }

  return Sentry.flush(timeoutMs);
}
