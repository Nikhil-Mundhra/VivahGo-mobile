import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureServerException = vi.fn(() => "backend_event_123");
const logServerError = vi.fn();
const requestLoggingMiddleware = vi.fn((req, _res, next) => {
  req.requestId = "req_test_123";
  next();
});
const sentryRequestContextMiddleware = vi.fn((req, _res, next) => {
  req.sentryContextCaptured = {
    posthogDistinctId: req.headers["x-posthog-distinct-id"] || "",
    axiomTraceId: req.headers["x-axiom-trace-id"] || "",
    claritySessionId: req.headers["x-clarity-session-id"] || "",
    clarityPageId: req.headers["x-clarity-page-id"] || "",
  };
  next();
});

vi.mock("./sentry.js", () => ({
  captureServerException,
  createFinalErrorMiddleware: () => (error, req, res) => {
    void error;
    void req;
    return res.status(500).json({ error: "Unhandled server error." });
  },
  flushServerSentry: vi.fn(),
  sentryRequestContextMiddleware,
  setSentryRequestUser: vi.fn(),
  setupSentryErrorHandlers: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  flushServerLogger: vi.fn(),
  logServerError,
  logServerInfo: vi.fn(),
  requestLoggingMiddleware,
}));

async function loadApp() {
  vi.resetModules();
  const module = await import("./index.js");
  return module.createApp({
    oauthClient: null,
  });
}

async function invokeRoute(app, path, method, { body = {}, headers = {}, query = {} } = {}) {
  const req = {
    body,
    query,
    method: method.toUpperCase(),
    path,
    headers,
    requestId: "req_test_123",
  };
  let finishHandler = null;
  const res = {
    body: null,
    headers: {},
    headersSent: false,
    statusCode: 200,
    getHeader(name) {
      return this.headers[String(name).toLowerCase()];
    },
    on: vi.fn((event, callback) => {
      if (event === "finish") {
        finishHandler = callback;
      }
    }),
    removeHeader(name) {
      delete this.headers[String(name).toLowerCase()];
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    json: vi.fn(function json(payload) {
      this.body = payload;
      this.headersSent = true;
      return this;
    }),
    set: vi.fn(function set(header, value) {
      this.headers[String(header).toLowerCase()] = value;
      return this;
    }),
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
  };

  const stack = app.router?.stack || app._router?.stack || [];
  const middlewareLayers = [];
  let routeHandler = null;

  for (const layer of stack) {
    if (!layer.route) {
      middlewareLayers.push(layer.handle);
      continue;
    }

    if (layer.route?.path === path && layer.route?.methods?.[method]) {
      routeHandler = layer.route?.stack?.at(-1)?.handle || null;
      break;
    }
  }

  if (typeof routeHandler !== "function") {
    throw new Error(`Missing ${method.toUpperCase()} route handler for ${path}`);
  }

  let responseHandled = false;
  for (const middleware of middlewareLayers) {
    await new Promise((resolve, reject) => {
      let settled = false;
      const complete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      try {
        middleware(req, res, (error) => {
          if (error) {
            reject(error);
            return;
          }
          complete();
        });

        if (res.headersSent || res.body !== null || res.statusCode !== 200) {
          responseHandled = true;
          complete();
        }
      } catch (error) {
        reject(error);
      }
    });

    if (responseHandled) {
      break;
    }
  }

  if (!responseHandled) {
    await routeHandler(req, res);
  }
  if (typeof finishHandler === "function" && !responseHandled) {
    finishHandler();
  }
  return { req, res };
}

function buildCsrfHeaders(token = "csrf_test_token") {
  return {
    cookie: `vivahgo_csrf=${token}`,
    "x-csrf-token": token,
  };
}

describe("observability smoke route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
    delete process.env.ENABLE_OBSERVABILITY_SMOKE_TESTS;
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
    delete process.env.ENABLE_OBSERVABILITY_SMOKE_TESTS;
  });

  it("returns a backend smoke error with request metadata when explicitly enabled", async () => {
    process.env.ENABLE_OBSERVABILITY_SMOKE_TESTS = "true";
    const app = await loadApp();
    const { res } = await invokeRoute(app, "/api/observability/smoke-error", "post", {
      headers: buildCsrfHeaders(),
      body: {
        source: "observability-smoke-panel",
        routePath: "/planner?observability-smoke=1",
        bodyRoute: "app",
      },
    });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: "OBSERVABILITY_SMOKE_TEST",
        eventId: "backend_event_123",
        requestId: "req_test_123",
      })
    );
    expect(captureServerException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ObservabilitySmokeTestError",
        message: "Observability smoke test triggered (observability-smoke-panel).",
      }),
      expect.objectContaining({
        tags: expect.objectContaining({
          smoke_test: "true",
          "smoke_test.target": "backend",
          "smoke_test.source": "observability-smoke-panel",
        }),
        extra: expect.objectContaining({
          routePath: "/planner?observability-smoke=1",
          bodyRoute: "app",
          requestId: "req_test_123",
        }),
      })
    );
    expect(logServerError).toHaveBeenCalledWith(
      "Observability smoke test triggered",
      expect.objectContaining({
        fields: expect.objectContaining({
          smoke_test: true,
          sentry_event_id: "backend_event_123",
        }),
      })
    );
  });

  it("is blocked by csrf before reaching the disabled smoke route by default", async () => {

    const app = await loadApp();
    const { res } = await invokeRoute(app, "/api/observability/smoke-error", "post", {
      body: { source: "observability-smoke-panel" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      error: "CSRF token required.",
      code: "CSRF_REQUIRED",
    });
    expect(captureServerException).not.toHaveBeenCalled();
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("runs the request logging and sentry request middleware with shared observability headers", async () => {
    process.env.ENABLE_OBSERVABILITY_SMOKE_TESTS = "true";
    const app = await loadApp();
    const headers = {
      ...buildCsrfHeaders(),
      "x-posthog-distinct-id": "ph_user_123",
      "x-axiom-trace-id": "axiom_trace_123",
      "x-clarity-session-id": "clarity_session_123",
      "x-clarity-page-id": "planner:/planner",
    };

    const { req, res } = await invokeRoute(app, "/api/observability/smoke-error", "post", {
      headers,
      body: {
        source: "observability-smoke-panel",
        routePath: "/planner?observability-smoke=1",
        bodyRoute: "app",
      },
    });

    expect(res.statusCode).toBe(500);
    expect(requestLoggingMiddleware).toHaveBeenCalledTimes(1);
    expect(sentryRequestContextMiddleware).toHaveBeenCalledTimes(1);
    expect(req.requestId).toBe("req_test_123");
    expect(req.sentryContextCaptured).toEqual({
      posthogDistinctId: "ph_user_123",
      axiomTraceId: "axiom_trace_123",
      claritySessionId: "clarity_session_123",
      clarityPageId: "planner:/planner",
    });
    expect(logServerError).toHaveBeenCalledWith(
      "Observability smoke test triggered",
      expect.objectContaining({
        req: expect.objectContaining({
          headers: expect.objectContaining(headers),
          requestId: "req_test_123",
        }),
      })
    );
  });
});
