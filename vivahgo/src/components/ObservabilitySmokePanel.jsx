import { useState } from "react";
import { resolveApiBaseUrl } from "../shared/api/request.js";
import { getObservabilityHeaders } from "../shared/observability.js";
import { captureException } from "../shared/sentry.js";

function getRuntimeEnv() {
  if (typeof import.meta !== "undefined" && import.meta && import.meta.env) {
    return import.meta.env;
  }

  return {};
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function isObservabilitySmokePanelEnabled(routePath, env = getRuntimeEnv(), win = typeof window !== "undefined" ? window : undefined) {
  const search = typeof routePath === "string" && routePath.includes("?")
    ? routePath.slice(routePath.indexOf("?"))
    : win?.location?.search || "";
  const params = new URLSearchParams(search);
  const queryEnabled = ["1", "true", "yes"].includes(String(
    params.get("observability-smoke") || params.get("observability_smoke") || ""
  ).trim().toLowerCase());
  const forceEnabled = String(env.VITE_ENABLE_OBSERVABILITY_SMOKE_TESTS || "").trim().toLowerCase() === "true";
  const appEnv = String(env.VITE_APP_ENV || env.MODE || "development").trim().toLowerCase();
  const hostname = String(win?.location?.hostname || "").trim().toLowerCase();

  return forceEnabled || (queryEnabled && (appEnv !== "production" || isLocalHostname(hostname)));
}

export default function ObservabilitySmokePanel({ routePath = "/", bodyRoute = "app" }) {
  const [frontendStatus, setFrontendStatus] = useState("");
  const [backendStatus, setBackendStatus] = useState("");
  const [backendPending, setBackendPending] = useState(false);

  if (!isObservabilitySmokePanelEnabled(routePath)) {
    return null;
  }

  async function handleFrontendSmokeTest() {
    const eventId = captureException(new Error("Observability smoke test triggered from the frontend panel."), {
      tags: {
        smoke_test: "true",
        "smoke_test.target": "frontend",
      },
      extra: {
        routePath,
        bodyRoute,
        triggeredFrom: "observability-smoke-panel",
      },
    });

    setFrontendStatus(eventId ? `Captured frontend smoke error: ${eventId}` : "Frontend smoke capture was skipped.");
  }

  async function handleBackendSmokeTest() {
    setBackendPending(true);
    setBackendStatus("");

    try {
      const response = await fetch(`${resolveApiBaseUrl()}/observability/smoke-error`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getObservabilityHeaders(),
        },
        body: JSON.stringify({
          source: "observability-smoke-panel",
          routePath,
          bodyRoute,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setBackendStatus("Backend smoke route returned 200 unexpectedly.");
        return;
      }

      const requestId = typeof data.requestId === "string" && data.requestId ? ` Request ID: ${data.requestId}.` : "";
      const eventId = typeof data.eventId === "string" && data.eventId ? ` Event ID: ${data.eventId}.` : "";
      setBackendStatus(`Backend smoke error returned ${response.status}.${requestId}${eventId}`);
    } catch (error) {
      setBackendStatus(error instanceof Error ? error.message : "Backend smoke request failed.");
    } finally {
      setBackendPending(false);
    }
  }

  return (
    <section
      aria-label="Observability smoke tests"
      data-testid="observability-smoke-panel"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 1000,
        width: "min(24rem, calc(100vw - 2rem))",
        padding: "0.875rem",
        borderRadius: "0.875rem",
        background: "rgba(15, 23, 42, 0.94)",
        color: "#f8fafc",
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.35)",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>Observability Smoke Tests</p>
      <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", lineHeight: 1.5, opacity: 0.82 }}>
        Use this panel to generate one frontend Sentry event and one backend Sentry/Axiom event with the current shared context.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" onClick={handleFrontendSmokeTest}>
          Trigger frontend smoke error
        </button>
        <button type="button" onClick={handleBackendSmokeTest} disabled={backendPending}>
          {backendPending ? "Triggering backend smoke error..." : "Trigger backend smoke error"}
        </button>
      </div>
      {frontendStatus ? (
        <p data-testid="observability-frontend-status" style={{ margin: "0.75rem 0 0", fontSize: "0.8rem" }}>
          {frontendStatus}
        </p>
      ) : null}
      {backendStatus ? (
        <p data-testid="observability-backend-status" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
          {backendStatus}
        </p>
      ) : null}
    </section>
  );
}
