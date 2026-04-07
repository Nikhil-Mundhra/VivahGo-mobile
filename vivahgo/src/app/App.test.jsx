import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let currentRoutePath = "/planner";
const routeListeners = new Set();
const capturePostHogEvent = vi.fn();
const captureException = vi.fn(() => "frontend_smoke_event_123");
const getObservabilityHeaders = vi.fn(() => ({
  "X-Axiom-Trace-Id": "axiom_trace_123",
  "X-PostHog-Distinct-Id": "ph_user_123",
}));
const resolveApiBaseUrl = vi.fn(() => "http://127.0.0.1:4000/api");
const setClarityRouteContext = vi.fn();
const setPostHogRouteContext = vi.fn((path, options = {}) => ({
  route: path,
  pathname: path.split("?")[0] || "/",
  body_route: options.bodyRoute || "app",
}));
const setSentryRoute = vi.fn();

function mockPage() {
  return {
    default: () => null,
  };
}

vi.mock("../chatbase.js", () => ({
  shouldShowChatbaseForRoute: () => false,
}));

vi.mock("../components/ChatbaseChatbot.jsx", () => ({
  default: () => null,
}));

vi.mock("../seo.js", () => ({
  usePageSeo: () => {},
}));

vi.mock("../shared/clarity.js", () => ({
  setClarityRouteContext,
}));

vi.mock("../shared/posthog.js", () => ({
  capturePostHogEvent,
  getCurrentPostHogRoutePath: () => currentRoutePath,
  setPostHogRouteContext,
  subscribeToPostHogRouteChanges: (callback) => {
    routeListeners.add(callback);
    return () => {
      routeListeners.delete(callback);
    };
  },
}));

vi.mock("../shared/sentry.js", () => ({
  captureException,
  setSentryRoute,
}));

vi.mock("../shared/observability.js", () => ({
  getObservabilityHeaders,
}));

vi.mock("../shared/api/request.js", () => ({
  resolveApiBaseUrl,
}));

vi.mock("../siteUrls.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getMarketingUrl: (path) => `https://marketing.example${path}`,
    getPlannerUrl: (path) => `https://planner.example${path}`,
  };
});

vi.mock("../pages/PlannerPage.jsx", mockPage);
vi.mock("../features/marketing/pages/MarketingHomePage.jsx", mockPage);
vi.mock("../features/marketing/pages/CareersPage.jsx", mockPage);
vi.mock("../features/marketing/pages/TermsPage.jsx", mockPage);
vi.mock("../features/marketing/pages/PrivacyPolicyPage.jsx", mockPage);
vi.mock("../features/marketing/pages/DataDeletionInstructionsPage.jsx", mockPage);
vi.mock("../features/guides/pages/GuidesPage.jsx", mockPage);
vi.mock("../features/guides/pages/GuideArticlePage.jsx", mockPage);
vi.mock("../features/marketing/pages/QueryCapturePage.jsx", mockPage);
vi.mock("../features/guest-rsvp/pages/GuestRsvpPage.jsx", mockPage);
vi.mock("../features/wedding-website/pages/WeddingWebsitePage.jsx", mockPage);
vi.mock("../features/vendor/pages/VendorPortalPage.jsx", mockPage);
vi.mock("../features/admin/pages/AdminPortalPage.jsx", mockPage);
vi.mock("../pages/ClerkSsoCallbackPage.jsx", mockPage);

describe("App route analytics", () => {
  beforeEach(() => {
    currentRoutePath = "/planner";
    routeListeners.clear();
    capturePostHogEvent.mockClear();
    captureException.mockClear();
    getObservabilityHeaders.mockClear();
    resolveApiBaseUrl.mockClear();
    setClarityRouteContext.mockClear();
    setPostHogRouteContext.mockClear();
    setSentryRoute.mockClear();
    window.history.replaceState({}, "", "/planner");
    delete document.body.dataset.route;
    global.fetch = vi.fn();
  });

  it("captures a pageview on initial render and on route changes", async () => {
    const { default: App } = await import("./App.jsx");

    render(<App />);

    await waitFor(() => {
      expect(setPostHogRouteContext).toHaveBeenCalledWith("/planner", { bodyRoute: "app" });
    });
    expect(setClarityRouteContext).toHaveBeenCalledWith("/planner", { bodyRoute: "app" });
    expect(capturePostHogEvent).toHaveBeenCalledWith("$pageview", {
      route: "/planner",
      pathname: "/planner",
      body_route: "app",
    });
    expect(setSentryRoute).toHaveBeenCalledWith("/planner", { bodyRoute: "app" });
    expect(document.body.dataset.route).toBe("app");

    await act(async () => {
      currentRoutePath = "/vendor";
      window.history.pushState({}, "", "/vendor");
      routeListeners.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(setPostHogRouteContext).toHaveBeenLastCalledWith("/vendor", { bodyRoute: "vendor" });
    });
    expect(setClarityRouteContext).toHaveBeenLastCalledWith("/vendor", { bodyRoute: "vendor" });
    expect(capturePostHogEvent).toHaveBeenLastCalledWith("$pageview", {
      route: "/vendor",
      pathname: "/vendor",
      body_route: "vendor",
    });
    expect(setSentryRoute).toHaveBeenLastCalledWith("/vendor", { bodyRoute: "vendor" });
    expect(document.body.dataset.route).toBe("vendor");
  });

  it("shows the smoke panel from the app route and triggers both smoke actions", async () => {
    currentRoutePath = "/planner?observability-smoke=1";
    window.history.replaceState({}, "", "/planner?observability-smoke=1");
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        code: "OBSERVABILITY_SMOKE_TEST",
        eventId: "backend_event_123",
        requestId: "req_123",
      }),
    });

    const user = userEvent.setup();
    const { default: App } = await import("./App.jsx");

    render(<App />);

    expect(await screen.findByTestId("observability-smoke-panel")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Trigger frontend smoke error" }));
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          smoke_test: "true",
          "smoke_test.target": "frontend",
        }),
      })
    );

    await user.click(screen.getByRole("button", { name: "Trigger backend smoke error" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:4000/api/observability/smoke-error",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Axiom-Trace-Id": "axiom_trace_123",
            "X-PostHog-Distinct-Id": "ph_user_123",
          }),
        })
      );
    });
  });
});
