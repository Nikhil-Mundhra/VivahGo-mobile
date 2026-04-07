import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = {
  capture: vi.fn(),
  get_distinct_id: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  register: vi.fn(),
  reset: vi.fn(),
  setPersonProperties: vi.fn(),
};

const sentryMock = {
  getClient: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
};

vi.mock("posthog-js", () => ({
  default: posthogMock,
}));

vi.mock("@sentry/react", () => sentryMock);

async function loadModule() {
  vi.resetModules();
  return import("./posthog.js");
}

describe("shared posthog helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
    posthogMock.get_distinct_id.mockReturnValue("ph_anon_1");
    sentryMock.getClient.mockReturnValue({ id: "sentry-client" });
  });

  it("no-ops cleanly when PostHog env vars are missing", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    vi.stubEnv("VITE_POSTHOG_HOST", "");
    const { capturePostHogEvent, identifyPostHogUser, initPostHog, resetPostHogUser } = await loadModule();

    expect(initPostHog()).toBe(false);
    expect(() => identifyPostHogUser({ id: "user_1" })).not.toThrow();
    expect(() => resetPostHogUser()).not.toThrow();
    expect(capturePostHogEvent("test_event", { ok: true })).toBeNull();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("initializes PostHog with session recording disabled and syncs the distinct ID to Sentry", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://us.i.posthog.com/");
    vi.stubEnv("VITE_APP_ENV", "staging");
    const { initPostHog } = await loadModule();

    expect(initPostHog()).toBe(true);
    expect(posthogMock.init).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({
        api_host: "https://us.i.posthog.com",
        person_profiles: "identified_only",
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        session_recording: false,
        loaded: expect.any(Function),
      })
    );
    expect(posthogMock.register).toHaveBeenCalledWith({
      app_env: "staging",
      axiom_trace_id: expect.stringMatching(/^axiom_/),
    });
    expect(posthogMock.setPersonProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        axiom_trace_id: expect.stringMatching(/^axiom_/),
      })
    );
    expect(sentryMock.setTag).toHaveBeenCalledWith("posthog_id", "ph_anon_1");
  });

  it("identifies authenticated users and re-syncs the Sentry posthog_id tag", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://us.i.posthog.com");
    posthogMock.get_distinct_id
      .mockReturnValueOnce("ph_anon_1")
      .mockReturnValue("user_1");
    const { identifyPostHogUser, initPostHog } = await loadModule();

    initPostHog();
    identifyPostHogUser(
      {
        id: "user_1",
        email: "planner@example.com",
        name: "Planner",
      },
      {
        authMode: "google",
        plannerOwnerId: "planner_1",
      }
    );

    expect(posthogMock.identify).toHaveBeenCalledWith("user_1", {
      auth_mode: "google",
      planner_owner_id: "planner_1",
      email: "planner@example.com",
      name: "Planner",
    });
    expect(posthogMock.register).toHaveBeenCalledWith({
      auth_mode: "google",
      planner_owner_id: "planner_1",
      user_id: "user_1",
      user_email: "planner@example.com",
      axiom_trace_id: expect.stringMatching(/^axiom_/),
    });
    expect(posthogMock.setPersonProperties).toHaveBeenLastCalledWith(
      expect.objectContaining({
        axiom_trace_id: expect.stringMatching(/^axiom_/),
      })
    );
    expect(sentryMock.setTag).toHaveBeenCalledWith("posthog_id", "user_1");
  });

  it("resets PostHog identity and syncs the new anonymous distinct ID back to Sentry", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://us.i.posthog.com");
    vi.stubEnv("VITE_APP_ENV", "test");
    posthogMock.get_distinct_id
      .mockReturnValueOnce("ph_anon_1")
      .mockReturnValue("ph_anon_2");
    const { initPostHog, resetPostHogUser } = await loadModule();

    initPostHog();
    resetPostHogUser();

    expect(posthogMock.reset).toHaveBeenCalledTimes(1);
    expect(posthogMock.register).toHaveBeenCalledWith({
      app_env: "test",
      auth_mode: "anonymous",
      planner_owner_id: "none",
      axiom_trace_id: expect.stringMatching(/^axiom_/),
    });
    expect(sentryMock.setTag).toHaveBeenCalledWith("posthog_id", "ph_anon_2");
  });
});
