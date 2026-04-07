import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setPostHogPersonProperties = vi.fn();
const sentryMock = {
  getClient: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
};

vi.mock("./posthog.js", () => ({
  setPostHogPersonProperties,
}));

vi.mock("@sentry/react", () => sentryMock);

async function loadModule() {
  vi.resetModules();
  return import("./clarity.js");
}

function getInjectedClarityScript() {
  return document.getElementById("vivahgo-clarity-script");
}

describe("shared clarity helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.useFakeTimers();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/planner");
    delete window.clarity;
    window.requestIdleCallback = vi.fn((callback) => {
      callback();
      return 1;
    });
    sentryMock.getClient.mockReturnValue({ id: "sentry-client" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    delete window.clarity;
    delete window.requestIdleCallback;
    window.sessionStorage.clear();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("no-ops cleanly when the Clarity project ID is missing", async () => {
    const { clearClarityUser, initClarity, setClarityRouteContext, syncClaritySession } = await loadModule();

    expect(initClarity()).toBe(false);
    expect(() => setClarityRouteContext("/planner", { bodyRoute: "app" })).not.toThrow();
    expect(() => syncClaritySession({ mode: "google", user: { id: "user_1" } })).not.toThrow();
    expect(() => clearClarityUser()).not.toThrow();
    expect(getInjectedClarityScript()).toBeNull();
  });

  it("bootstraps the command queue immediately and injects the script after the delayed idle window", async () => {
    vi.stubEnv("VITE_CLARITY_PROJECT_ID", "clarity_project_123");
    const { initClarity } = await loadModule();

    expect(initClarity()).toBe(true);
    expect(typeof window.clarity).toBe("function");
    expect(Array.isArray(window.clarity.q)).toBe(true);
    expect(getInjectedClarityScript()).toBeNull();

    vi.advanceTimersByTime(2999);
    expect(getInjectedClarityScript()).toBeNull();

    vi.advanceTimersByTime(1);
    const script = getInjectedClarityScript();
    expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(script).not.toBeNull();
    expect(script.getAttribute("src")).toBe("https://www.clarity.ms/tag/clarity_project_123");
  });

  it("tracks route context and identifies authenticated users with custom ids", async () => {
    vi.stubEnv("VITE_CLARITY_PROJECT_ID", "clarity_project_123");
    const { initClarity, setClarityRouteContext } = await loadModule();

    expect(initClarity()).toBe(true);
    setClarityRouteContext("/vendor", { bodyRoute: "vendor" });

    if (!getInjectedClarityScript()) {
      vi.advanceTimersByTime(3000);
    }

    const script = getInjectedClarityScript();
    const clarityMock = vi.fn((command) => {
      if (command === "identify") {
        return Promise.resolve({
          id: "clarity-user-hash",
          session: "clarity-session-custom",
          page: "vendor:/vendor",
          userHint: "Vendor Owner",
        });
      }

      return undefined;
    });
    window.clarity = clarityMock;

    initClarity({
      session: {
        mode: "google",
        plannerOwnerId: "planner_1",
        user: {
          id: "user_1",
          email: "vendor@example.com",
          name: "Vendor Owner",
        },
      },
    });

    script.onload();
    await Promise.resolve();
    await Promise.resolve();

    expect(clarityMock).toHaveBeenCalledWith("set", "route", "/vendor");
    expect(clarityMock).toHaveBeenCalledWith("set", "body_route", "vendor");
    expect(clarityMock).toHaveBeenCalledWith("set", "auth_mode", "google");
    expect(clarityMock).toHaveBeenCalledWith(
      "identify",
      "user_1",
      expect.stringMatching(/^clarity_/),
      "vendor:/vendor",
      "Vendor Owner"
    );
    expect(setPostHogPersonProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        axiom_trace_id: expect.stringMatching(/^axiom_/),
        ms_clarity_project_id: "clarity_project_123",
        ms_clarity_user_id_hash: "clarity-user-hash",
        ms_clarity_custom_session_id: "clarity-session-custom",
        ms_clarity_custom_page_id: "vendor:/vendor",
        ms_clarity_link: "https://clarity.microsoft.com/projects/clarity_project_123/sessions/clarity-session-custom",
      })
    );
    expect(sentryMock.setTag).toHaveBeenCalledWith("clarity_session_id", "clarity-session-custom");
    expect(sentryMock.setContext).toHaveBeenCalledWith(
      "clarity",
      expect.objectContaining({
        projectId: "clarity_project_123",
        sessionId: "clarity-session-custom",
        replayUrl: "https://clarity.microsoft.com/projects/clarity_project_123/sessions/clarity-session-custom",
      })
    );
  });

  it("rotates the custom Clarity session id when the user context is cleared", async () => {
    vi.stubEnv("VITE_CLARITY_PROJECT_ID", "clarity_project_123");
    const { clearClarityUser, initClarity } = await loadModule();

    expect(initClarity()).toBe(true);
    const initialSessionId = window.sessionStorage.getItem("vivahgo.claritySessionId");
    window.clarity = vi.fn();

    clearClarityUser({
      authMode: "anonymous",
      sessionStorageRef: window.sessionStorage,
    });

    const rotatedSessionId = window.sessionStorage.getItem("vivahgo.claritySessionId");
    expect(rotatedSessionId).toBeTruthy();
    expect(rotatedSessionId).not.toBe(initialSessionId);
    expect(window.clarity).toHaveBeenCalledWith("set", "auth_mode", "anonymous");
  });
});
