import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => {
  const scope = {
    setContext: vi.fn(),
    setExtras: vi.fn(),
    setTag: vi.fn(),
    setTags: vi.fn(),
  };

  return {
    browserTracingIntegration: vi.fn(() => ({ name: "browserTracing" })),
    captureException: vi.fn(() => "event_123"),
    getClient: vi.fn(),
    init: vi.fn(),
    setContext: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
    startBrowserTracingNavigationSpan: vi.fn(),
    withScope: vi.fn((callback) => callback(scope)),
    scope,
  };
});

const posthogMock = vi.hoisted(() => ({
  capturePostHogEvent: vi.fn(),
  setPostHogPersonProperties: vi.fn(),
}));

vi.mock("@sentry/react", () => sentryMock);
vi.mock("./posthog.js", () => posthogMock);

async function loadModule() {
  vi.resetModules();
  return import("./sentry.js");
}

describe("shared sentry helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
    sentryMock.getClient.mockReturnValue({ id: "client" });
  });

  it("initializes browser sentry and stamps the shared axiom trace id", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    vi.stubEnv("VITE_APP_ENV", "staging");
    const { initSentry } = await loadModule();

    expect(initSentry()).toBe(true);
    expect(sentryMock.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://public@example.ingest.sentry.io/1",
        environment: "staging",
        tracesSampleRate: 1,
      })
    );
    expect(sentryMock.setTag).toHaveBeenCalledWith("axiom_trace_id", expect.stringMatching(/^axiom_/));
  });

  it("captures exceptions and mirrors them into PostHog with linkage metadata", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    vi.stubEnv("VITE_SENTRY_PROJECT_URL", "https://sentry.io/organizations/vivahgo/issues");
    const { captureException, initSentry } = await loadModule();

    initSentry();
    const eventId = captureException(new Error("boom"), {
      tags: {
        "request.path": "/vendor/me",
      },
    });

    expect(eventId).toBe("event_123");
    expect(posthogMock.setPostHogPersonProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        last_sentry_error: "event_123",
        last_sentry_error_url: "https://sentry.io/organizations/vivahgo/issues/?query=event_123",
      })
    );
    expect(posthogMock.capturePostHogEvent).toHaveBeenCalledWith(
      "exception_occurred",
      expect.objectContaining({
        sentry_event_id: "event_123",
        sentry_url: "https://sentry.io/organizations/vivahgo/issues/?query=event_123",
        error_name: "Error",
        error_message: "boom",
        axiom_trace_id: expect.stringMatching(/^axiom_/),
      })
    );
  });
});
