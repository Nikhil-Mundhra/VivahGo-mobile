import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn(() => "frontend_event_123");
const request = vi.fn();

vi.mock("../shared/sentry.js", () => ({
  captureException,
}));

vi.mock("../shared/api/request.js", () => ({
  request,
}));

describe("ObservabilitySmokePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/planner");
  });

  it("stays hidden until the smoke-test query param is present", async () => {
    const { default: ObservabilitySmokePanel } = await import("./ObservabilitySmokePanel.jsx");

    render(<ObservabilitySmokePanel routePath="/planner" bodyRoute="app" />);

    expect(screen.queryByTestId("observability-smoke-panel")).toBeNull();
  });

  it("captures a frontend smoke error and calls the backend smoke endpoint via request()", async () => {
    window.history.replaceState({}, "", "/planner?observability-smoke=1");
    const backendError = new Error("Request failed (500).");
    backendError.status = 500;
    backendError.responseData = {
      code: "OBSERVABILITY_SMOKE_TEST",
      eventId: "backend_event_123",
      requestId: "req_123",
    };
    request.mockRejectedValue(backendError);

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
      expect(request).toHaveBeenCalledWith(
        "/observability/smoke-error",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            source: "observability-smoke-panel",
            routePath: "/planner?observability-smoke=1",
            bodyRoute: "app",
          }),
        })
      );
    });

    expect(screen.getByTestId("observability-backend-status")).toHaveTextContent("Backend smoke error returned 500.");
    expect(screen.getByTestId("observability-backend-status")).toHaveTextContent("Request ID: req_123.");
    expect(screen.getByTestId("observability-backend-status")).toHaveTextContent("Event ID: backend_event_123.");
  });

  it("stays hidden on non-local hosts unless explicitly force-enabled", async () => {
    const originalLocation = window.location;
    try {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: new URL("https://preview.vivahgo.com/planner?observability-smoke=1"),
      });
      const { default: ObservabilitySmokePanel } = await import("./ObservabilitySmokePanel.jsx");

      render(<ObservabilitySmokePanel routePath="/planner?observability-smoke=1" bodyRoute="app" />);

      expect(screen.queryByTestId("observability-smoke-panel")).toBeNull();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
