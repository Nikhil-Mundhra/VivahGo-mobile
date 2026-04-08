import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => {
  const scope = {
    setTags: vi.fn(),
    setExtras: vi.fn(),
    setContext: vi.fn(),
  };

  return {
    captureException: vi.fn(() => "event_123"),
    expressIntegration: vi.fn(() => ({ name: "express" })),
    flush: vi.fn().mockResolvedValue(true),
    getClient: vi.fn(),
    init: vi.fn(),
    setContext: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
    setupExpressErrorHandler: vi.fn(),
    withScope: vi.fn((callback) => callback(scope)),
    scope,
  };
});

vi.mock("@sentry/node", () => sentryMock);
vi.mock("./logger.js", () => ({
  flushServerLogger: vi.fn().mockResolvedValue(undefined),
  logServerError: vi.fn(),
}));

async function loadModule() {
  vi.resetModules();
  return import("./sentry.js");
}

describe("server sentry helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.APP_ENV;
    sentryMock.getClient.mockReturnValue(undefined);
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
    delete process.env.APP_ENV;
  });

  it("skips initialization cleanly when no DSN is configured", async () => {
    const { initServerSentry } = await loadModule();

    expect(initServerSentry()).toBe(false);
    expect(sentryMock.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry with express integration when a DSN is configured", async () => {
    process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
    process.env.APP_ENV = "staging";

    const { initServerSentry } = await loadModule();

    expect(initServerSentry()).toBe(true);
    expect(sentryMock.expressIntegration).toHaveBeenCalledTimes(1);
    expect(sentryMock.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.ingest.sentry.io/1",
        environment: "staging",
        sendDefaultPii: true,
        tracesSampleRate: 1,
        integrations: [{ name: "express" }],
      })
    );
  });

  it("adds route and planner owner context on incoming requests", async () => {
    const { sentryRequestContextMiddleware } = await loadModule();
    sentryMock.getClient.mockReturnValue({ id: "client" });
    const next = vi.fn();

    sentryRequestContextMiddleware(
      {
        method: "POST",
        path: "/api/planner",
        headers: {
          "x-posthog-distinct-id": "ph_user_123",
          "x-axiom-trace-id": "axiom_trace_123",
          "x-clarity-session-id": "clarity_session_123",
          "x-clarity-page-id": "planner:/planner",
        },
        query: {},
        body: { plannerOwnerId: "planner_9" },
      },
      {},
      next
    );

    expect(sentryMock.setTag).toHaveBeenCalledWith("route", "POST /api/planner");
    expect(sentryMock.setTag).toHaveBeenCalledWith("planner_owner_id", "planner_9");
    expect(sentryMock.setTag).toHaveBeenCalledWith("posthog_id", "ph_user_123");
    expect(sentryMock.setTag).toHaveBeenCalledWith("axiom_trace_id", "axiom_trace_123");
    expect(sentryMock.setContext).toHaveBeenCalledWith("request", {
      method: "POST",
      path: "/api/planner",
      plannerOwnerId: "planner_9",
    });
    expect(sentryMock.setContext).toHaveBeenCalledWith("observability", {
      posthogDistinctId: "ph_user_123",
      axiomTraceId: "axiom_trace_123",
      claritySessionId: "clarity_session_123",
      clarityPageId: "planner:/planner",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("captures authenticated request user metadata", async () => {
    const { setSentryRequestUser } = await loadModule();
    sentryMock.getClient.mockReturnValue({ id: "client" });

    setSentryRequestUser({
      sub: "clerk:user_1",
      email: "planner@example.com",
      name: "Planner",
      plannerOwnerId: "planner_1",
      staffRole: "owner",
    });

    expect(sentryMock.setUser).toHaveBeenCalledWith({
      id: "clerk:user_1",
      email: "planner@example.com",
      username: "Planner",
    });
    expect(sentryMock.setTag).toHaveBeenCalledWith("user.id", "clerk:user_1");
    expect(sentryMock.setTag).toHaveBeenCalledWith("auth.mode", "clerk");
    expect(sentryMock.setContext).toHaveBeenCalledWith("auth", {
      mode: "clerk",
      plannerOwnerId: "planner_1",
      staffRole: "owner",
    });
  });

  it("captures server exceptions with scoped metadata", async () => {
    const { captureServerException } = await loadModule();
    sentryMock.getClient.mockReturnValue({ id: "client" });
    const error = new Error("boom");

    expect(
      captureServerException(error, {
        tags: { feature: "billing" },
        extra: { orderId: "ord_1" },
        contexts: { request: { path: "/api/billing" } },
      })
    ).toBe("event_123");

    expect(sentryMock.scope.setTags).toHaveBeenCalledWith({ feature: "billing" });
    expect(sentryMock.scope.setExtras).toHaveBeenCalledWith({ orderId: "ord_1" });
    expect(sentryMock.scope.setContext).toHaveBeenCalledWith("request", { path: "/api/billing" });
    expect(sentryMock.captureException).toHaveBeenCalledWith(error);
  });

  it("returns the existing JSON 500 shape for uncaught route errors", async () => {
    const { createFinalErrorMiddleware } = await loadModule();
    const finalErrorMiddleware = createFinalErrorMiddleware();
    const status = vi.fn();
    const json = vi.fn();
    const next = vi.fn();
    const res = {
      headersSent: false,
      status: status.mockReturnThis(),
      json,
    };

    finalErrorMiddleware(new Error("Kaboom"), {}, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: "Kaboom",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
