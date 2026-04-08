import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  vi.resetModules();
  return import("./observability.js");
}

describe("shared observability context", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("creates and persists an axiom trace id for the browser session", async () => {
    const { getOrCreateAxiomTraceId } = await loadModule();

    const firstTraceId = getOrCreateAxiomTraceId(window.sessionStorage);
    const secondTraceId = getOrCreateAxiomTraceId(window.sessionStorage);

    expect(firstTraceId).toMatch(/^axiom_/);
    expect(secondTraceId).toBe(firstTraceId);
  });

  it("builds person properties and outgoing headers from the current observability state", async () => {
    const {
      buildClarityReplayUrl,
      getObservabilityHeaders,
      getObservabilityPersonProperties,
      setObservabilityClarityContext,
      setObservabilityLastSentryEventId,
      setObservabilityPostHogDistinctId,
    } = await loadModule();

    setObservabilityPostHogDistinctId("ph_user_123");
    setObservabilityLastSentryEventId("sentry_event_123");
    setObservabilityClarityContext({
      projectId: "clarity_project_123",
      sessionId: "clarity_session_123",
      pageId: "vendor:/vendor",
      replayUrl: buildClarityReplayUrl("clarity_project_123", "clarity_session_123"),
    });

    expect(getObservabilityPersonProperties(window.sessionStorage)).toEqual(
      expect.objectContaining({
        axiom_trace_id: expect.stringMatching(/^axiom_/),
        ms_clarity_project_id: "clarity_project_123",
        ms_clarity_custom_session_id: "clarity_session_123",
        ms_clarity_custom_page_id: "vendor:/vendor",
        ms_clarity_link: "https://clarity.microsoft.com/projects/clarity_project_123/sessions/clarity_session_123",
        last_sentry_error: "sentry_event_123",
      })
    );

    expect(getObservabilityHeaders(window.sessionStorage)).toEqual(
      expect.objectContaining({
        "X-PostHog-Distinct-Id": "ph_user_123",
        "X-Axiom-Trace-Id": expect.stringMatching(/^axiom_/),
        "X-Clarity-Session-Id": "clarity_session_123",
        "X-Clarity-Page-Id": "vendor:/vendor",
      })
    );
  });
});
