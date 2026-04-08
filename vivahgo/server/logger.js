import { randomUUID } from "node:crypto";

import { Axiom } from "@axiomhq/js";
import { AxiomJSTransport, ConsoleTransport, EVENT, Logger } from "@axiomhq/logging";

let serverLogger = null;

function resolveEnvironment() {
  return String(process.env.APP_ENV || process.env.NODE_ENV || "development");
}

function inferAuthMode(subject) {
  return String(subject || "").startsWith("clerk:") ? "clerk" : "session";
}

function isNonEmptyValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function compactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => isNonEmptyValue(entry))
  );
}

function buildAuthContext(auth) {
  if (!auth || typeof auth !== "object") {
    return {};
  }

  const subject = typeof auth.sub === "string" ? auth.sub : "";
  const email = typeof auth.email === "string" ? auth.email : "";
  const plannerOwnerId = typeof auth.plannerOwnerId === "string" ? auth.plannerOwnerId : "";
  const staffRole = typeof auth.staffRole === "string" ? auth.staffRole : "";

  return compactObject({
    user_id: subject,
    user_email: email,
    planner_owner_id: plannerOwnerId,
    auth_mode: subject ? inferAuthMode(subject) : "",
    staff_role: staffRole,
  });
}

function resolveClientIp(req) {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() || "";
  }

  return typeof req.ip === "string" ? req.ip : "";
}

function readHeader(req, name) {
  const headerValue = req.headers?.[name];
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === "string" ? headerValue[0] : "";
  }

  return typeof headerValue === "string" ? headerValue : "";
}

function buildRequestContext(req, extraFields = {}) {
  if (!req || typeof req !== "object") {
    return compactObject(extraFields);
  }

  return compactObject({
    request_id: typeof req.requestId === "string" ? req.requestId : "",
    method: typeof req.method === "string" ? req.method : "",
    path: typeof req.path === "string" ? req.path : "",
    route: typeof req.method === "string" && typeof req.path === "string" ? `${req.method} ${req.path}` : "",
    ip: resolveClientIp(req),
    user_agent: typeof req.get === "function" ? req.get("user-agent") || "" : "",
    posthog_distinct_id: readHeader(req, "x-posthog-distinct-id"),
    axiom_trace_id: readHeader(req, "x-axiom-trace-id"),
    clarity_session_id: readHeader(req, "x-clarity-session-id"),
    clarity_page_id: readHeader(req, "x-clarity-page-id"),
    ...buildAuthContext(req.auth),
    ...extraFields,
  });
}

function buildRootFields(req, extraRoot = {}) {
  const requestContext = buildRequestContext(req);

  return compactObject({
    environment: resolveEnvironment(),
    request_id: requestContext.request_id,
    route: requestContext.route,
    user_id: requestContext.user_id,
    planner_owner_id: requestContext.planner_owner_id,
    auth_mode: requestContext.auth_mode,
    posthog_distinct_id: requestContext.posthog_distinct_id,
    axiom_trace_id: requestContext.axiom_trace_id,
    ...extraRoot,
  });
}

function createLogger() {
  const transports = [
    new ConsoleTransport({
      prettyPrint: resolveEnvironment() !== "production",
    }),
  ];

  const token = typeof process.env.AXIOM_TOKEN === "string" ? process.env.AXIOM_TOKEN.trim() : "";
  const dataset = typeof process.env.AXIOM_DATASET === "string" ? process.env.AXIOM_DATASET.trim() : "";

  if (token && dataset) {
    const axiom = new Axiom({
      token,
      orgId: process.env.AXIOM_ORG_ID || undefined,
      url: process.env.AXIOM_URL || undefined,
      edge: process.env.AXIOM_EDGE || undefined,
      edgeUrl: process.env.AXIOM_EDGE_URL || undefined,
      onError(error) {
        console.error("Axiom ingestion failed:", error);
      },
    });

    transports.unshift(
      new AxiomJSTransport({
        axiom,
        dataset,
        logLevel: "info",
      })
    );
  }

  return new Logger({
    transports,
    logLevel: resolveEnvironment() === "production" ? "info" : "debug",
  });
}

export function getServerLogger() {
  if (!serverLogger) {
    serverLogger = createLogger();
  }

  return serverLogger;
}

export function writeServerLog(level, message, { req, fields = {}, root = {} } = {}) {
  const logger = getServerLogger();
  const payload = compactObject({
    environment: resolveEnvironment(),
    ...buildRequestContext(req),
    ...fields,
  });

  logger[level](message, {
    ...payload,
    [EVENT]: buildRootFields(req, root),
  });
}

export function logServerInfo(message, options = {}) {
  writeServerLog("info", message, options);
}

export function logServerWarn(message, options = {}) {
  writeServerLog("warn", message, options);
}

export function logServerError(message, { error, ...options } = {}) {
  writeServerLog("error", message, {
    ...options,
    fields: compactObject({
      ...options.fields,
      error,
    }),
  });
}

export function requestLoggingMiddleware(req, res, next) {
  req.requestId = typeof req.requestId === "string" && req.requestId
    ? req.requestId
    : randomUUID();

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    writeServerLog(level, "HTTP request completed", {
      req,
      fields: {
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
      },
      root: {
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(2)),
      },
    });
  });

  next();
}

export async function flushServerLogger() {
  if (!serverLogger) {
    return;
  }

  await serverLogger.flush();
}
