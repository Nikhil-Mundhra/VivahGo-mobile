import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WebSocket } from "undici";

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const SCREENSHOT_URL =
  process.env.PLANNER_CAPTURE_URL || "http://127.0.0.1:4173/planner";
const VIEWPORT_WIDTH = Number(process.env.PLANNER_CAPTURE_WIDTH || 430);
const VIEWPORT_HEIGHT = Number(process.env.PLANNER_CAPTURE_HEIGHT || 930);
const DEVICE_SCALE_FACTOR = Number(
  process.env.PLANNER_CAPTURE_SCALE || 2.5,
);
const USER_DATA_DIR =
  process.env.PLANNER_CAPTURE_PROFILE || "/tmp/vivahgo-planner-capture";

const outputDir = path.join(process.cwd(), "public", "tutorial", "screens");
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

  const waitForExpression = async (expression, timeoutMs = 12000) => {
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

  const clickNav = async (label, assertionExpression) => {
    await evaluate(`(() => {
      const match = [...document.querySelectorAll('.nav-item')]
        .find((node) => node.textContent && node.textContent.includes(${JSON.stringify(label)}));
      if (!match) return false;
      match.click();
      return true;
    })()`);
    await waitForExpression(assertionExpression);
    await wait(350);
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

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      mobile: true,
      screenWidth: VIEWPORT_WIDTH,
      screenHeight: VIEWPORT_HEIGHT,
      positionX: 0,
      positionY: 0,
    });
    await client.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    });
    await client.send("Page.navigate", { url: SCREENSHOT_URL });

    await waitForExpression(
      "document.readyState === 'complete' && Boolean(document.querySelector('.planner-login-screen'))",
    );
    await wait(800);
    await capture("login.png");

    await evaluate(`(() => {
      localStorage.setItem('vivahgo.session', JSON.stringify({
        mode: 'demo',
        user: {
          id: 'demo-user',
          name: 'VivahGo Demo',
          email: 'demo@vivahgo.local',
          picture: '',
        },
      }));
      window.location.reload();
      return true;
    })()`);
    await waitForExpression(
      "Boolean(document.querySelector('.splash-primary-btn')) || Boolean(document.querySelector('.dash-countdown'))",
      20000,
    );
    await evaluate(
      "document.querySelector('.splash-primary-btn')?.click() ?? false",
    );
    await waitForExpression(
      "Boolean(document.querySelector('.dash-countdown')) && Boolean(document.querySelector('.nav-item.active'))",
      20000,
    );
    await wait(1000);
    await capture("dashboard.png");

    await clickNav(
      "Events",
      "Boolean(document.querySelector('.section-title')?.textContent?.includes('Wedding Ceremonies'))",
    );
    await capture("events.png");

    await clickNav(
      "Tasks",
      "Boolean(document.querySelector('.section-title')?.textContent?.includes('Checklist'))",
    );
    await capture("tasks.png");

    await clickNav(
      "Budget",
      "Boolean(document.querySelector('.budget-summary'))",
    );
    await capture("budget.png");

    await clickNav(
      "Guests",
      "Boolean(document.querySelector('.guest-section-add'))",
    );
    await capture("guests.png");

    console.log(`Saved planner screenshots to ${outputDir}`);
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
