import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loggingMock = vi.hoisted(() => {
  const instance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
  };

  return {
    AxiomJSTransport: vi.fn(function AxiomJSTransport(config) {
      this.type = "axiom";
      this.config = config;
    }),
    ConsoleTransport: vi.fn(function ConsoleTransport(config) {
      this.type = "console";
      this.config = config;
    }),
    EVENT: Symbol.for("logging.event"),
    Logger: vi.fn(function Logger() {
      return instance;
    }),
    instance,
  };
});

const axiomMock = vi.hoisted(() => ({
  Axiom: vi.fn(function Axiom(config) {
    this.config = config;
  }),
}));

vi.mock("@axiomhq/logging", () => loggingMock);
vi.mock("@axiomhq/js", () => axiomMock);

async function loadModule() {
  vi.resetModules();
  return import("./logger.js");
}

describe("server logger helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_ENV;
    delete process.env.AXIOM_TOKEN;
    delete process.env.AXIOM_DATASET;
    delete process.env.AXIOM_URL;
    delete process.env.AXIOM_EDGE;
    delete process.env.AXIOM_EDGE_URL;
    delete process.env.AXIOM_ORG_ID;
  });

  afterEach(() => {
    delete process.env.APP_ENV;
    delete process.env.AXIOM_TOKEN;
    delete process.env.AXIOM_DATASET;
    delete process.env.AXIOM_URL;
    delete process.env.AXIOM_EDGE;
    delete process.env.AXIOM_EDGE_URL;
    delete process.env.AXIOM_ORG_ID;
  });

  it("uses console logging only when Axiom env vars are missing", async () => {
    const { getServerLogger } = await loadModule();

    const logger = getServerLogger();

    expect(logger).toBe(loggingMock.instance);
    expect(loggingMock.ConsoleTransport).toHaveBeenCalledTimes(1);
    expect(loggingMock.AxiomJSTransport).not.toHaveBeenCalled();
    expect(axiomMock.Axiom).not.toHaveBeenCalled();
  });

  it("configures the Axiom transport when token and dataset are present", async () => {
    process.env.APP_ENV = "production";
    process.env.AXIOM_TOKEN = "xaat-test";
    process.env.AXIOM_DATASET = "vivahgo_backend";
    process.env.AXIOM_EDGE = "eu-central-1.aws.edge.axiom.co";

    const { getServerLogger } = await loadModule();

    getServerLogger();

    expect(axiomMock.Axiom).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "xaat-test",
        edge: "eu-central-1.aws.edge.axiom.co",
      })
    );
    expect(loggingMock.AxiomJSTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: "vivahgo_backend",
        logLevel: "info",
      })
    );
    expect(loggingMock.Logger).toHaveBeenCalledWith(
      expect.objectContaining({
        logLevel: "info",
      })
    );
  });

  it("logs request completions with request and auth metadata", async () => {
    const { requestLoggingMiddleware } = await loadModule();
    const next = vi.fn();
    let finishHandler = null;
    const req = {
      method: "GET",
      path: "/api/vendor/me",
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "x-posthog-distinct-id": "ph_user_123",
        "x-axiom-trace-id": "axiom_trace_123",
        "x-clarity-session-id": "clarity_session_123",
        "x-clarity-page-id": "vendor:/vendor",
      },
      get: vi.fn(() => "Vitest Agent"),
      auth: {
        sub: "clerk:user_123",
        email: "planner@example.com",
        plannerOwnerId: "planner_123",
      },
    };
    const res = {
      statusCode: 200,
      on: vi.fn((event, callback) => {
        if (event === "finish") {
          finishHandler = callback;
        }
      }),
    };

    requestLoggingMiddleware(req, res, next);
    finishHandler();

    expect(next).toHaveBeenCalledTimes(1);
    expect(loggingMock.instance.info).toHaveBeenCalledTimes(1);

    const [, payload] = loggingMock.instance.info.mock.calls[0];
    expect(payload.request_id).toEqual(expect.any(String));
    expect(payload.user_id).toBe("clerk:user_123");
    expect(payload.user_email).toBe("planner@example.com");
    expect(payload.posthog_distinct_id).toBe("ph_user_123");
    expect(payload.axiom_trace_id).toBe("axiom_trace_123");
    expect(payload.duration_ms).toEqual(expect.any(Number));
    expect(payload[loggingMock.EVENT]).toEqual(
      expect.objectContaining({
        route: "GET /api/vendor/me",
        status_code: 200,
        user_id: "clerk:user_123",
        posthog_distinct_id: "ph_user_123",
        axiom_trace_id: "axiom_trace_123",
      })
    );
  });

  it("logs structured request errors and flushes pending transports", async () => {
    const { flushServerLogger, logServerError } = await loadModule();
    const error = new Error("boom");

    logServerError("Vendor registration failed", {
      error,
      req: {
        requestId: "req_123",
        method: "POST",
        path: "/api/vendor/me",
        headers: {},
        get: vi.fn(() => "Vitest Agent"),
        auth: {
          sub: "user_123",
          plannerOwnerId: "planner_123",
        },
      },
      fields: {
        feature: "vendor-onboarding",
      },
    });

    const [, payload] = loggingMock.instance.error.mock.calls[0];
    expect(payload.feature).toBe("vendor-onboarding");
    expect(payload.error).toBe(error);
    expect(payload.route).toBe("POST /api/vendor/me");
    expect(payload[loggingMock.EVENT]).toEqual(
      expect.objectContaining({
        request_id: "req_123",
        route: "POST /api/vendor/me",
        user_id: "user_123",
      })
    );

    await flushServerLogger();
    expect(loggingMock.instance.flush).toHaveBeenCalledTimes(1);
  });
});
