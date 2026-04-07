const AXIOM_TRACE_STORAGE_KEY = "vivahgo.axiomTraceId";

let currentPostHogDistinctId = "";
let currentClarityProjectId = "";
let currentClaritySessionId = "";
let currentClarityPageId = "";
let currentClarityUserIdHash = "";
let currentClarityReplayUrl = "";
let currentSentryEventId = "";

function getSessionStorageRef(storageRef) {
  return storageRef ?? (typeof window !== "undefined" ? window.sessionStorage : null);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}

function generateTraceId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return `axiom_${globalThis.crypto.randomUUID()}`;
  }

  return `axiom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateAxiomTraceId(storageRef) {
  const sessionStorageRef = getSessionStorageRef(storageRef);
  const storedValue = sessionStorageRef?.getItem?.(AXIOM_TRACE_STORAGE_KEY);

  if (isNonEmptyString(storedValue)) {
    return storedValue.trim();
  }

  const traceId = generateTraceId();
  sessionStorageRef?.setItem?.(AXIOM_TRACE_STORAGE_KEY, traceId);
  return traceId;
}

export function rotateAxiomTraceId(storageRef) {
  const sessionStorageRef = getSessionStorageRef(storageRef);
  const traceId = generateTraceId();
  sessionStorageRef?.setItem?.(AXIOM_TRACE_STORAGE_KEY, traceId);
  return traceId;
}

export function setObservabilityPostHogDistinctId(distinctId) {
  currentPostHogDistinctId = isNonEmptyString(distinctId) ? distinctId.trim() : "";
}

export function setObservabilityClarityContext(context = {}) {
  currentClarityProjectId = isNonEmptyString(context.projectId) ? context.projectId.trim() : "";
  currentClaritySessionId = isNonEmptyString(context.sessionId) ? context.sessionId.trim() : "";
  currentClarityPageId = isNonEmptyString(context.pageId) ? context.pageId.trim() : "";
  currentClarityUserIdHash = isNonEmptyString(context.userIdHash) ? context.userIdHash.trim() : "";
  currentClarityReplayUrl = isNonEmptyString(context.replayUrl) ? context.replayUrl.trim() : "";
}

export function setObservabilityLastSentryEventId(eventId) {
  currentSentryEventId = isNonEmptyString(eventId) ? eventId.trim() : "";
}

export function buildClarityReplayUrl(projectId, sessionId) {
  if (!isNonEmptyString(projectId) || !isNonEmptyString(sessionId)) {
    return "";
  }

  return `https://clarity.microsoft.com/projects/${encodeURIComponent(projectId.trim())}/sessions/${encodeURIComponent(sessionId.trim())}`;
}

export function getObservabilityPersonProperties(storageRef) {
  return compactObject({
    axiom_trace_id: getOrCreateAxiomTraceId(storageRef),
    ms_clarity_project_id: currentClarityProjectId || undefined,
    ms_clarity_custom_session_id: currentClaritySessionId || undefined,
    ms_clarity_custom_page_id: currentClarityPageId || undefined,
    ms_clarity_user_id_hash: currentClarityUserIdHash || undefined,
    ms_clarity_link: currentClarityReplayUrl || undefined,
    last_sentry_error: currentSentryEventId || undefined,
  });
}

export function getObservabilityHeaders(storageRef) {
  return compactObject({
    "X-PostHog-Distinct-Id": currentPostHogDistinctId || undefined,
    "X-Axiom-Trace-Id": getOrCreateAxiomTraceId(storageRef),
    "X-Clarity-Session-Id": currentClaritySessionId || undefined,
    "X-Clarity-Page-Id": currentClarityPageId || undefined,
  });
}

export function getObservabilityContext(storageRef) {
  return compactObject({
    posthogDistinctId: currentPostHogDistinctId || undefined,
    axiomTraceId: getOrCreateAxiomTraceId(storageRef),
    clarityProjectId: currentClarityProjectId || undefined,
    claritySessionId: currentClaritySessionId || undefined,
    clarityPageId: currentClarityPageId || undefined,
    clarityReplayUrl: currentClarityReplayUrl || undefined,
    sentryEventId: currentSentryEventId || undefined,
  });
}
