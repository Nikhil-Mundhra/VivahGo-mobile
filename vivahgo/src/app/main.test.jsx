import { beforeEach, describe, expect, it, vi } from "vitest";

const initClarity = vi.fn();
const initPostHog = vi.fn();
const initSentry = vi.fn();
const readAuthSession = vi.fn();
const renderRoot = vi.fn();
const createRoot = vi.fn(() => ({
  render: renderRoot,
}));

vi.mock("./App.jsx", () => ({
  default: () => null,
}));

vi.mock("../authStorage.js", () => ({
  readAuthSession,
}));

vi.mock("../shared/clarity.js", () => ({
  initClarity,
}));

vi.mock("../shared/posthog.js", () => ({
  initPostHog,
}));

vi.mock("../shared/queryClient.js", () => ({
  queryClient: {},
}));

vi.mock("../shared/sentry.js", () => ({
  initSentry,
}));

vi.mock("@sentry/react", () => ({
  ErrorBoundary: ({ children }) => children,
}));

vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }) => children,
}));

vi.mock("@vercel/analytics/react", () => ({
  Analytics: () => null,
}));

vi.mock("@vercel/speed-insights/react", () => ({
  SpeedInsights: () => null,
}));

vi.mock("react-dom/client", () => ({
  createRoot,
}));

async function loadModule() {
  vi.resetModules();
  return import("./main.jsx");
}

describe("main bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    document.body.innerHTML = '<div id="root"></div>';
    readAuthSession.mockReturnValue({
      mode: "google",
      user: {
        id: "user_1",
      },
    });
  });

  it("initializes Sentry, PostHog, and Clarity before rendering the app", async () => {
    await loadModule();

    expect(initSentry).toHaveBeenCalledWith({
      session: {
        mode: "google",
        user: {
          id: "user_1",
        },
      },
    });
    expect(initPostHog).toHaveBeenCalledWith({
      session: {
        mode: "google",
        user: {
          id: "user_1",
        },
      },
    });
    expect(initClarity).toHaveBeenCalledWith({
      session: {
        mode: "google",
        user: {
          id: "user_1",
        },
      },
    });
    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderRoot).toHaveBeenCalledTimes(1);
    expect(initSentry.mock.invocationCallOrder[0]).toBeLessThan(initPostHog.mock.invocationCallOrder[0]);
    expect(initPostHog.mock.invocationCallOrder[0]).toBeLessThan(initClarity.mock.invocationCallOrder[0]);
    expect(initClarity.mock.invocationCallOrder[0]).toBeLessThan(renderRoot.mock.invocationCallOrder[0]);
  });
});
