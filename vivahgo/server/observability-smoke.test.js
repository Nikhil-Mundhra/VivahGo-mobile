import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureServerException = vi.fn(() => "backend_event_123");
const logServerError = vi.fn();

vi.mock("./sentry.js", () => ({
  captureServerException,
  createFinalErrorMiddleware: () => (error, req, res) => {
    void error;
    void req;
    return res.status(500).json({ error: "Unhandled server error." });
  },
  flushServerSentry: vi.fn(),
  sentryRequestContextMiddleware: (_req, _res, next) => next(),
  setSentryRequestUser: vi.fn(),
  setupSentryErrorHandlers: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  flushServerLogger: vi.fn(),
  logServerError,
  logServerInfo: vi.fn(),
  requestLoggingMiddleware: (req, _res, next) => {
    req.requestId = "req_test_123";
    next();
  },
}));

async function loadApp() {
  vi.resetModules();
  const module = await import("./index.js");
  return module.createApp({
    oauthClient: null,
  });
}

function findRouteHandler(app, path, method) {
  const stack = app.router?.stack || app._router?.stack || [];
  const layer = stack.find((entry) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer?.route?.stack?.at(-1)?.handle || null;
}

async function invokeRoute(app, path, method, { body = {} } = {}) {
  const handler = findRouteHandler(app, path, method);
  if (typeof handler !== "function") {
    throw new Error(`Missing ${method.toUpperCase()} route handler for ${path}`);
  }

  const req = {
    body,
    method: method.toUpperCase(),
    path,
    headers: {},
    requestId: "req_test_123",
  };
  const res = {
    body: null,
    headers: {},
    statusCode: 200,
    json: vi.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
    set: vi.fn(function set(header, value) {
      this.headers[header] = value;
      return this;
    }),
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
  };

  await handler(req, res);
  return { req, res };
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

  it("returns a backend smoke error with request metadata outside production", async () => {
    const app = await loadApp();
    const { res } = await invokeRoute(app, "/api/observability/smoke-error", "post", {
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

  it("returns 404 in production unless smoke tests are explicitly enabled", async () => {
    process.env.APP_ENV = "production";

    const app = await loadApp();
    const { res } = await invokeRoute(app, "/api/observability/smoke-error", "post", {
      body: { source: "observability-smoke-panel" },
    });

    expect(res.statusCode).toBe(404);
    expect(captureServerException).not.toHaveBeenCalled();
    expect(logServerError).not.toHaveBeenCalled();
  });
});
