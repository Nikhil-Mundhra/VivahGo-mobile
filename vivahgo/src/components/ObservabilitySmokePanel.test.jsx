import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn(() => "frontend_event_123");
const getObservabilityHeaders = vi.fn(() => ({
  "X-Axiom-Trace-Id": "axiom_trace_123",
  "X-PostHog-Distinct-Id": "ph_user_123",
}));
const resolveApiBaseUrl = vi.fn(() => "http://127.0.0.1:4000/api");

vi.mock("../shared/sentry.js", () => ({
  captureException,
}));

vi.mock("../shared/observability.js", () => ({
  getObservabilityHeaders,
}));

vi.mock("../shared/api/request.js", () => ({
  resolveApiBaseUrl,
}));

describe("ObservabilitySmokePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/planner");
    global.fetch = vi.fn();
  });

  it("stays hidden until the smoke-test query param is present", async () => {
    const { default: ObservabilitySmokePanel } = await import("./ObservabilitySmokePanel.jsx");

    render(<ObservabilitySmokePanel routePath="/planner" bodyRoute="app" />);

    expect(screen.queryByTestId("observability-smoke-panel")).toBeNull();
  });

  it("captures a frontend smoke error and calls the backend smoke endpoint with observability headers", async () => {
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
    const { default: ObservabilitySmokePanel } = await import("./ObservabilitySmokePanel.jsx");

    render(<ObservabilitySmokePanel routePath="/planner?observability-smoke=1" bodyRoute="app" />);

    await user.click(screen.getByRole("button", { name: "Trigger frontend smoke error" }));
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          smoke_test: "true",
          "smoke_test.target": "frontend",
        }),
        extra: expect.objectContaining({
          routePath: "/planner?observability-smoke=1",
          bodyRoute: "app",
        }),
      })
    );
    expect(screen.getByTestId("observability-frontend-status")).toHaveTextContent("frontend_event_123");

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

    expect(screen.getByTestId("observability-backend-status")).toHaveTextContent("Backend smoke error returned 500.");
    expect(screen.getByTestId("observability-backend-status")).toHaveTextContent("Request ID: req_123.");
    expect(screen.getByTestId("observability-backend-status")).toHaveTextContent("Event ID: backend_event_123.");
  });
});
