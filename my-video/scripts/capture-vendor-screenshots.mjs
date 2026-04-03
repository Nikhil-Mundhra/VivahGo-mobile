import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WebSocket } from "undici";

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9223);
const SCREENSHOT_URL =
  process.env.VENDOR_CAPTURE_URL || "http://127.0.0.1:4173/vendor";
const VIEWPORT_WIDTH = Number(process.env.VENDOR_CAPTURE_WIDTH || 1440);
const VIEWPORT_HEIGHT = Number(process.env.VENDOR_CAPTURE_HEIGHT || 1160);
const DEVICE_SCALE_FACTOR = Number(
  process.env.VENDOR_CAPTURE_SCALE || 2,
);
const USER_DATA_DIR =
  process.env.VENDOR_CAPTURE_PROFILE || "/tmp/vivahgo-vendor-capture";
const TIMEZONE = process.env.VENDOR_CAPTURE_TIMEZONE || "Asia/Kolkata";
const FROZEN_NOW =
  process.env.VENDOR_CAPTURE_NOW || "2026-04-04T10:30:00+05:30";

const outputDir = path.join(
  process.cwd(),
  "public",
  "tutorial",
  "vendor",
  "screens",
);
mkdirSync(outputDir, { recursive: true });

try {
  rmSync(USER_DATA_DIR, { recursive: true, force: true });
} catch {
  // Ignore leftover profile cleanup issues from previous runs.
}

const chrome = spawn(
  CHROME_PATH,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "about:blank",
  ],
  {
    stdio: "ignore",
  },
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
};

const waitForDebugger = async () => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    try {
      const targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      // Retry until Chrome exposes the debugger endpoint.
    }

    await wait(200);
  }

  throw new Error("Timed out waiting for Chrome DevTools");
};

class CDPClient {
  constructor(webSocketUrl) {
    this.nextId = 0;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.ready = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out opening DevTools WebSocket"));
      }, 10000);

      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      this.socket.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(event.error || new Error("WebSocket error"));
      });
    });

    this.socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) {
          reject(
            new Error(payload.error.message || "Unknown DevTools protocol error"),
          );
        } else {
          resolve(payload.result);
        }
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.nextId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const demoVendor = {
  _id: "vendor_demo_aarav_captures",
  businessName: "Aurum Wedding Films",
  type: "Photography",
  subType: "Wedding Videography",
  description:
    "Premium wedding films and candid photography for multi-day celebrations, destination events, and intimate family ceremonies.",
  country: "India",
  state: "Rajasthan",
  city: "Jaipur",
  googleMapsLink: "https://maps.google.com/?q=Jaipur",
  coverageAreas: [
    { country: "India", state: "Delhi", city: "New Delhi" },
    { country: "India", state: "Maharashtra", city: "Mumbai" },
  ],
  phone: "+91 98765 43210",
  website: "https://aurumweddingfilms.example.com",
  bundledServices: ["Wedding Videography", "Photobooth"],
  budgetRange: {
    min: 90000,
    max: 220000,
  },
  isApproved: true,
  media: [
    {
      _id: "media_1",
      filename: "hero-cover.jpg",
      type: "IMAGE",
      url: "/MainHero.png",
      altText: "Bride and groom portrait",
      caption: "Destination wedding portrait",
      sortOrder: 0,
      isVisible: true,
      isCover: true,
    },
    {
      _id: "media_2",
      filename: "thumbnail-showcase.png",
      type: "IMAGE",
      url: "/Thumbnail.png",
      altText: "VivahGo wedding highlight",
      caption: "Highlight cover artwork",
      sortOrder: 1,
      isVisible: true,
      isCover: false,
    },
    {
      _id: "media_3",
      filename: "social-preview.jpg",
      type: "IMAGE",
      url: "/social-preview.jpg",
      altText: "Decor setup preview",
      caption: "Sangeet evening setup",
      sortOrder: 2,
      isVisible: true,
      isCover: false,
    },
  ],
  verificationDocuments: [
    {
      _id: "verification_1",
      documentType: "AADHAAR",
      filename: "aadhaar-card.pdf",
      size: 540000,
      accessUrl: "/Thumbnail.png",
      uploadedAt: "2026-03-18T09:30:00.000Z",
    },
  ],
  verificationStatus: "approved",
  availabilitySettings: {
    hasDefaultCapacity: true,
    defaultMaxCapacity: 2,
    dateOverrides: [
      { date: "2026-04-04", maxCapacity: 2, bookingsCount: 1 },
      { date: "2026-04-11", maxCapacity: 0, bookingsCount: 0 },
      { date: "2026-04-18", maxCapacity: 2, bookingsCount: 2 },
      { date: "2026-04-26", maxCapacity: 1, bookingsCount: 0 },
    ],
  },
};

const injectedSetup = `
(() => {
  const frozenNow = ${JSON.stringify(FROZEN_NOW)};
  const NativeDate = Date;
  const frozenTimestamp = NativeDate.parse(frozenNow);

  class FrozenDate extends NativeDate {
    constructor(...args) {
      if (args.length === 0) {
        super(frozenTimestamp);
        return;
      }
      super(...args);
    }

    static now() {
      return frozenTimestamp;
    }
  }

  Object.setPrototypeOf(FrozenDate, NativeDate);
  FrozenDate.UTC = NativeDate.UTC;
  FrozenDate.parse = NativeDate.parse;
  window.Date = FrozenDate;

  const sessionKey = "vivahgo.session";
  const captureModeKey = "vivahgo.vendorCaptureMode";
  const tipDismissedKey = "vendor-availability-tip-dismissed";
  const demoVendor = ${JSON.stringify(demoVendor)};
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const okJson = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const captureSession = {
    mode: "google",
    user: {
      id: "vendor-demo-user",
      name: "Aarav Malhotra",
      given_name: "Aarav",
      email: "aarav@vivahgo.local",
      picture: "",
    },
  };

  window.__setVendorCaptureMode = (mode) => {
    window.localStorage.setItem(captureModeKey, mode);
    window.localStorage.setItem(tipDismissedKey, "true");
    if (mode === "login") {
      window.localStorage.removeItem(sessionKey);
    } else {
      window.localStorage.setItem(sessionKey, JSON.stringify(captureSession));
    }
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const method = (init?.method || request?.method || "GET").toUpperCase();
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : request?.url || "";

    if (!rawUrl) {
      return originalFetch(input, init);
    }

    const url = new URL(rawUrl, window.location.origin);
    const mode = window.localStorage.getItem(captureModeKey) || "login";

    if (url.pathname.endsWith("/api/auth/csrf")) {
      return okJson({ csrfToken: "vendor-capture-csrf" });
    }

    if (url.pathname.endsWith("/api/vendor/me")) {
      if (method === "GET") {
        if (mode === "registration") {
          return okJson({ error: "No vendor profile found. Please register.", code: "NOT_FOUND" }, 404);
        }
        return okJson({ vendor: clone(demoVendor) });
      }

      if (method === "POST" || method === "PATCH") {
        return okJson({ vendor: clone(demoVendor) });
      }
    }

    if (url.pathname.endsWith("/api/vendor/media")) {
      return okJson({ vendor: clone(demoVendor) });
    }

    if (url.pathname.endsWith("/api/media/presigned-url")) {
      return okJson({
        uploadUrl: "https://example.com/demo-upload",
        key: "demo/media/key",
        publicUrl: "/Thumbnail.png",
      });
    }

    if (url.pathname.endsWith("/api/media/verification-presigned-url")) {
      return okJson({
        uploadUrl: "https://example.com/demo-verification-upload",
        key: "demo/verification/key",
        publicUrl: "/Thumbnail.png",
      });
    }

    if (url.pathname.endsWith("/api/vendor/verification")) {
      return okJson({ vendor: clone(demoVendor) });
    }

    return originalFetch(input, init);
  };
})();
`;

const main = async () => {
  const webSocketUrl = await waitForDebugger();
  const client = new CDPClient(webSocketUrl);

  const evaluate = async (expression) => {
    const result = await client.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    return result?.result?.value;
  };

  const waitForExpression = async (expression, timeoutMs = 15000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = await evaluate(expression);
      if (value) {
        return value;
      }
      await wait(250);
    }

    throw new Error(`Timed out waiting for expression: ${expression}`);
  };

  const setCaptureMode = async (mode) => {
    await evaluate(`window.__setVendorCaptureMode(${JSON.stringify(mode)}); true`);
  };

  const navigate = async () => {
    await client.send("Page.navigate", { url: SCREENSHOT_URL });
  };

  const capture = async (filename) => {
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(path.join(outputDir, filename), screenshot.data, "base64");
    console.log(`Captured ${filename}`);
  };

  const clickSidebar = async (label, assertionExpression) => {
    await evaluate(`(() => {
      const button = [...document.querySelectorAll('.vendor-portal-sidebar-item')]
        .find((node) => node.textContent && node.textContent.includes(${JSON.stringify(label)}));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    await waitForExpression(assertionExpression);
    await wait(700);
  };

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setTimezoneOverride", {
      timezoneId: TIMEZONE,
    });
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      mobile: false,
      screenWidth: VIEWPORT_WIDTH,
      screenHeight: VIEWPORT_HEIGHT,
      positionX: 0,
      positionY: 0,
    });
    await client.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      platform: "MacIntel",
    });
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: injectedSetup,
    });

    await navigate();

    await waitForExpression(
      "document.readyState === 'complete' && Boolean(document.querySelector('.vendor-login-screen'))",
    );
    await wait(1200);
    await capture("login.png");

    await setCaptureMode("registration");
    await navigate();
    await waitForExpression(
      "document.readyState === 'complete' && Boolean(document.querySelector('.vendor-registration-shell'))",
      20000,
    );
    await evaluate("window.scrollTo(0, 0); true");
    await wait(900);
    await capture("registration.png");

    await setCaptureMode("portal");
    await navigate();
    await waitForExpression(
      "document.readyState === 'complete' && Boolean(document.querySelector('.vendor-portal-hero-card'))",
      20000,
    );
    await evaluate("window.scrollTo(0, 0); true");
    await wait(900);
    await capture("dashboard.png");

    await clickSidebar(
      "Live Preview",
      "Boolean(document.querySelector('.vendor-card')) && Boolean(document.body.textContent?.includes('Vendor Detail Preview'))",
    );
    await capture("preview.png");

    await clickSidebar(
      "Media Manager",
      "Boolean(document.body.textContent?.includes('Upload New Work')) && Boolean(document.body.textContent?.includes('Portfolio'))",
    );
    await capture("portfolio.png");

    await clickSidebar(
      "Availability",
      "Boolean(document.body.textContent?.includes('Selected Day')) && Boolean(document.body.textContent?.includes('Near capacity')) && Boolean(document.body.textContent?.includes('Previous'))",
    );
    await capture("availability.png");

    await clickSidebar(
      "Business Details",
      "Boolean(document.querySelector('#businessName')) && Boolean(document.body.textContent?.includes('Business Details'))",
    );
    await capture("details.png");

    console.log(`Saved vendor screenshots to ${outputDir}`);
  } finally {
    client.close();
    chrome.kill("SIGTERM");
    try {
      rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Chrome can leave temporary files around briefly after shutdown.
    }
  }
};

main().catch((error) => {
  console.error(error);
  chrome.kill("SIGTERM");
  process.exit(1);
});
