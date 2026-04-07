import { beforeEach, describe, expect, it, vi } from "vitest";

const initServerSentry = vi.hoisted(() => vi.fn(() => Boolean(process.env.SENTRY_DSN)));

vi.mock("./sentry.js", () => ({
  initServerSentry,
}));

vi.mock("dotenv/config", () => {
  process.env.SENTRY_DSN = "https://public@example.ingest.sentry.io/1";
  return {};
});

async function loadModule() {
  vi.resetModules();
  return import("./sentry-init.js");
}

describe("server sentry preload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  it("loads env vars before initializing server sentry", async () => {
    await loadModule();

    expect(initServerSentry).toHaveBeenCalledTimes(1);
    expect(initServerSentry).toHaveReturnedWith(true);
    expect(process.env.SENTRY_DSN).toBe("https://public@example.ingest.sentry.io/1");
  });
});
