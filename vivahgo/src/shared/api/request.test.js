import { beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
const getObservabilityHeaders = vi.fn(() => ({
  "X-PostHog-Distinct-Id": "ph_anon_1",
  "X-Axiom-Trace-Id": "axiom_trace_123",
  "X-Clarity-Session-Id": "clarity_session_123",
  "X-Clarity-Page-Id": "vendor:/vendor",
}));

vi.mock("../sentry.js", () => ({
  captureException,
}));

vi.mock("../observability.js", () => ({
  getObservabilityHeaders,
}));

describe("request helpers", () => {
  beforeEach(() => {
    captureException.mockReset();
    getObservabilityHeaders.mockClear();
  });

  it("prefers the local backend during localhost development", async () => {
    const { resolveApiBaseUrl } = await import("./request.js");

    expect(
      resolveApiBaseUrl(
        {
          MODE: "development",
          VITE_USE_REMOTE_API: "false",
        },
        {
          location: {
            hostname: "127.0.0.1",
            protocol: "http:",
          },
        }
      )
    ).toBe("http://127.0.0.1:4000/api");
  });

  it("does not report expected 4xx API errors to Sentry", async () => {
    const { request } = await import("./request.js");

    await expect(
      request(
        "/planner/public",
        {},
        {
          baseUrl: "http://api.example.test",
          fetchImpl: vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: vi.fn().mockResolvedValue({ error: "Missing", code: "NOT_FOUND" }),
          }),
        }
      )
    ).rejects.toMatchObject({
      message: "Missing",
      status: 404,
      code: "NOT_FOUND",
    });

    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports 5xx API errors to Sentry with request metadata", async () => {
    const { request } = await import("./request.js");

    let thrownError;
    try {
      await request(
        "/vendor/me",
        { method: "GET" },
        {
          baseUrl: "http://api.example.test",
          fetchImpl: vi.fn().mockResolvedValue({
            ok: false,
            status: 503,
            json: vi.fn().mockResolvedValue({ error: "Service unavailable", code: "UPSTREAM_DOWN" }),
          }),
        }
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError.message).toBe("Service unavailable");
    expect(thrownError.status).toBe(503);
    expect(thrownError.code).toBe("UPSTREAM_DOWN");

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Service unavailable",
        status: 503,
        code: "UPSTREAM_DOWN",
      }),
      {
        tags: {
          "request.path": "/vendor/me",
          "request.method": "GET",
        },
        extra: {
          status: 503,
          code: "UPSTREAM_DOWN",
          baseUrl: "http://api.example.test",
        },
      }
    );
  });

  it("reports network failures to Sentry once", async () => {
    const { request } = await import("./request.js");

    await expect(
      request(
        "/health",
        {},
        {
          baseUrl: "http://api.example.test",
          fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
        }
      )
    ).rejects.toThrow("Failed to fetch. Check API URL, server status, and CORS settings.");

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toMatchObject({
      tags: {
        "request.path": "/health",
        "request.method": "GET",
      },
      extra: {
        baseUrl: "http://api.example.test",
      },
    });
  });

  it("attaches observability headers to outgoing API requests", async () => {
    const { request } = await import("./request.js");
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: true }),
    });

    await request("/health", {}, {
      baseUrl: "http://api.example.test",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://api.example.test/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-PostHog-Distinct-Id": "ph_anon_1",
          "X-Axiom-Trace-Id": "axiom_trace_123",
          "X-Clarity-Session-Id": "clarity_session_123",
          "X-Clarity-Page-Id": "vendor:/vendor",
        }),
      })
    );
  });
});
