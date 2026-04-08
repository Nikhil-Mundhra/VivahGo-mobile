import { beforeEach, describe, expect, it, vi } from "vitest";

const capturePostHogEvent = vi.fn();
const clearClarityUser = vi.fn();
const clearAppQueryState = vi.fn();
const identifyPostHogUser = vi.fn();
const resetPostHogUser = vi.fn();
const clearSentryUser = vi.fn();
const resetRequestCache = vi.fn();
const setSentryUser = vi.fn();
const syncClaritySession = vi.fn();

vi.mock("./shared/api/request.js", () => ({
  resetRequestCache,
}));

vi.mock("./shared/queryClient.js", () => ({
  clearAppQueryState,
}));

vi.mock("./shared/clarity.js", () => ({
  clearClarityUser,
  syncClaritySession,
}));

vi.mock("./shared/posthog.js", () => ({
  capturePostHogEvent,
  identifyPostHogUser,
  resetPostHogUser,
}));

vi.mock("./shared/sentry.js", () => ({
  clearSentryUser,
  setSentryUser,
}));

function createStorage(initialState = {}) {
  const state = new Map(Object.entries(initialState));

  return {
    getItem: vi.fn((key) => (state.has(key) ? state.get(key) : null)),
    setItem: vi.fn((key, value) => {
      state.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      state.delete(key);
    }),
    key: vi.fn((index) => Array.from(state.keys())[index] ?? null),
    get length() {
      return state.size;
    },
    dump() {
      return Object.fromEntries(state.entries());
    },
  };
}

describe("authStorage", () => {
  beforeEach(() => {
    capturePostHogEvent.mockReset();
    clearClarityUser.mockReset();
    clearAppQueryState.mockReset();
    identifyPostHogUser.mockReset();
    resetPostHogUser.mockReset();
    clearSentryUser.mockReset();
    resetRequestCache.mockReset();
    setSentryUser.mockReset();
    syncClaritySession.mockReset();
  });

  it("hydrates authenticated sessions with the cookie auth placeholder", async () => {
    const { authStorageKeys, readAuthSession } = await import("./authStorage.js");
    const localStorageRef = createStorage({
      [authStorageKeys.SESSION_STORAGE_KEY]: JSON.stringify({
        mode: "google",
        token: "real-token",
        user: { id: "user_123" },
      }),
    });

    expect(readAuthSession({ localStorageRef })).toEqual({
      mode: "google",
      token: authStorageKeys.COOKIE_AUTH_PLACEHOLDER,
      user: { id: "user_123" },
    });
  });

  it("persists authenticated sessions and syncs Sentry and PostHog identity", async () => {
    const { authStorageKeys, persistAuthSession } = await import("./authStorage.js");
    const localStorageRef = createStorage();

    const result = persistAuthSession(
      {
        mode: "clerk",
        token: "secret-token",
        plannerOwnerId: "planner_1",
        user: {
          id: "user_1",
          email: "bride@example.com",
          name: "Bride",
        },
      },
      { localStorageRef }
    );

    expect(result).toEqual({
      mode: "clerk",
      plannerOwnerId: "planner_1",
      token: authStorageKeys.COOKIE_AUTH_PLACEHOLDER,
      user: {
        id: "user_1",
        email: "bride@example.com",
        name: "Bride",
      },
    });
    expect(resetRequestCache).toHaveBeenCalledTimes(1);
    expect(clearAppQueryState).toHaveBeenCalledTimes(1);
    expect(localStorageRef.dump()[authStorageKeys.SESSION_STORAGE_KEY]).toBe(
      JSON.stringify({
        mode: "clerk",
        plannerOwnerId: "planner_1",
        user: {
          id: "user_1",
          email: "bride@example.com",
          name: "Bride",
        },
      })
    );
    expect(setSentryUser).toHaveBeenCalledWith(
      {
        id: "user_1",
        email: "bride@example.com",
        name: "Bride",
      },
      {
        authMode: "clerk",
        plannerOwnerId: "planner_1",
      }
    );
    expect(identifyPostHogUser).toHaveBeenCalledWith(
      {
        id: "user_1",
        email: "bride@example.com",
        name: "Bride",
      },
      {
        authMode: "clerk",
        plannerOwnerId: "planner_1",
      }
    );
    expect(syncClaritySession).toHaveBeenCalledWith({
      mode: "clerk",
      plannerOwnerId: "planner_1",
      user: {
        id: "user_1",
        email: "bride@example.com",
        name: "Bride",
      },
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith("auth_login_succeeded", {
      auth_mode: "clerk",
      planner_owner_id: "planner_1",
      user_id: "user_1",
    });
  });

  it("does not emit a new login event when only planner owner changes for the same user", async () => {
    const { authStorageKeys, persistAuthSession } = await import("./authStorage.js");
    const localStorageRef = createStorage({
      [authStorageKeys.SESSION_STORAGE_KEY]: JSON.stringify({
        mode: "google",
        plannerOwnerId: "planner_1",
        user: {
          id: "user_1",
          email: "planner@example.com",
          name: "Planner",
        },
      }),
    });

    persistAuthSession(
      {
        mode: "google",
        token: "secret-token",
        plannerOwnerId: "planner_2",
        user: {
          id: "user_1",
          email: "planner@example.com",
          name: "Planner",
        },
      },
      { localStorageRef }
    );

    expect(identifyPostHogUser).toHaveBeenCalledTimes(1);
    expect(capturePostHogEvent).not.toHaveBeenCalledWith(
      "auth_login_succeeded",
      expect.anything()
    );
  });

  it("resets PostHog before identifying a different authenticated user in the same browser", async () => {
    const { authStorageKeys, persistAuthSession } = await import("./authStorage.js");
    const localStorageRef = createStorage({
      [authStorageKeys.SESSION_STORAGE_KEY]: JSON.stringify({
        mode: "google",
        plannerOwnerId: "planner_1",
        user: {
          id: "user_1",
          email: "first@example.com",
          name: "First User",
        },
      }),
    });

    persistAuthSession(
      {
        mode: "clerk",
        token: "next-token",
        plannerOwnerId: "planner_2",
        user: {
          id: "user_2",
          email: "second@example.com",
          name: "Second User",
        },
      },
      { localStorageRef }
    );

    expect(resetPostHogUser).toHaveBeenCalledTimes(1);
    expect(resetPostHogUser.mock.invocationCallOrder[0]).toBeLessThan(identifyPostHogUser.mock.invocationCallOrder[0]);
    expect(identifyPostHogUser).toHaveBeenCalledWith(
      {
        id: "user_2",
        email: "second@example.com",
        name: "Second User",
      },
      {
        authMode: "clerk",
        plannerOwnerId: "planner_2",
      }
    );
  });

  it("clears planner-scoped auth artifacts and resets login helpers", async () => {
    const { authStorageKeys, clearAuthStorage } = await import("./authStorage.js");
    const localStorageRef = createStorage({
      [authStorageKeys.SESSION_STORAGE_KEY]: JSON.stringify({
        mode: "google",
        plannerOwnerId: "planner_1",
        user: {
          id: "user_1",
          email: "planner@example.com",
          name: "Planner",
        },
      }),
      [authStorageKeys.DEMO_PLANNER_STORAGE_KEY]: "demo",
      [authStorageKeys.LEGACY_GOOGLE_USER_KEY]: "legacy-user",
      [authStorageKeys.LEGACY_GOOGLE_LOGIN_FLAG_KEY]: "1",
    });
    const sessionStorageRef = createStorage({
      [authStorageKeys.PLANNER_VENDOR_FILTERS_SESSION_KEY]: "filters",
    });
    const disableAutoSelect = vi.fn();

    clearAuthStorage("planner", {
      localStorageRef,
      sessionStorageRef,
      googleRef: {
        accounts: {
          id: {
            disableAutoSelect,
          },
        },
      },
    });

    expect(resetRequestCache).toHaveBeenCalledTimes(1);
    expect(clearAppQueryState).toHaveBeenCalledTimes(1);
    expect(clearSentryUser).toHaveBeenCalledWith({ authMode: "anonymous" });
    expect(clearClarityUser).toHaveBeenCalledWith({
      authMode: "anonymous",
      sessionStorageRef,
    });
    expect(resetPostHogUser).toHaveBeenCalledTimes(1);
    expect(capturePostHogEvent).toHaveBeenCalledWith("auth_logout", {
      auth_mode: "google",
      planner_owner_id: "planner_1",
      reason: "session_cleared",
      scope: "planner",
      user_id: "user_1",
    });
    expect(disableAutoSelect).toHaveBeenCalledTimes(1);
    expect(localStorageRef.getItem(authStorageKeys.SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorageRef.getItem(authStorageKeys.DEMO_PLANNER_STORAGE_KEY)).toBeNull();
    expect(sessionStorageRef.getItem(authStorageKeys.PLANNER_VENDOR_FILTERS_SESSION_KEY)).toBeNull();
  });
});
