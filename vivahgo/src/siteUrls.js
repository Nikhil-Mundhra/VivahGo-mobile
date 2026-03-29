export const MARKETING_SITE_URL = "https://vivahgo.com";
export const PLANNER_SITE_URL = "https://planner.vivahgo.com";
export const PLANNER_HOSTNAME = "planner.vivahgo.com";
export const LOCAL_PLANNER_ROUTE = "/planner";

const LOCAL_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/i;

export function normalizeHostname(hostname = "") {
  return String(hostname || "").trim().toLowerCase().replace(/:\d+$/, "");
}

export function isLocalHostname(hostname = "") {
  return LOCAL_HOST_PATTERN.test(normalizeHostname(hostname));
}

export function isPlannerHostname(hostname = "") {
  return normalizeHostname(hostname) === PLANNER_HOSTNAME;
}

export function shouldRenderMarketingHomeAtRoot(hostname = "") {
  const normalizedHostname = normalizeHostname(hostname);
  return Boolean(normalizedHostname) && !isPlannerHostname(normalizedHostname);
}

function buildSiteUrl(siteUrl, pathname = "/") {
  const normalizedPath = pathname
    ? (pathname.startsWith("/") ? pathname : `/${pathname}`)
    : "/";

  return new URL(normalizedPath, `${siteUrl}/`).href;
}

function normalizeMarketingPath(pathname = "/") {
  const normalizedPath = pathname
    ? (pathname.startsWith("/") ? pathname : `/${pathname}`)
    : "/";

  return normalizedPath === "/home" ? "/" : normalizedPath;
}

function normalizePlannerPath(pathname = "/") {
  const normalizedPath = pathname
    ? (pathname.startsWith("/") ? pathname : `/${pathname}`)
    : "/";

  if (normalizedPath === "/" || normalizedPath === "/home" || normalizedPath === LOCAL_PLANNER_ROUTE) {
    return LOCAL_PLANNER_ROUTE;
  }

  return normalizedPath.startsWith(`${LOCAL_PLANNER_ROUTE}/`)
    ? normalizedPath
    : `${LOCAL_PLANNER_ROUTE}${normalizedPath}`;
}

function getRuntimeLocation(options = {}) {
  const win = options.win ?? (typeof window !== "undefined" ? window : undefined);
  const hostname = typeof options.hostname === "string"
    ? options.hostname
    : (typeof win?.location?.hostname === "string" ? win.location.hostname : "");
  const origin = typeof options.origin === "string"
    ? options.origin
    : (typeof win?.location?.origin === "string" ? win.location.origin : "");

  return {
    hostname: normalizeHostname(hostname),
    origin: String(origin || "").trim().replace(/\/$/, ""),
  };
}

function shouldUseLocalUrls(options = {}) {
  const { hostname, origin } = getRuntimeLocation(options);
  return Boolean(origin) && isLocalHostname(hostname);
}

function buildOriginUrl(origin, pathname = "/") {
  const normalizedOrigin = String(origin || "").trim().replace(/\/$/, "");
  const normalizedPath = pathname
    ? (pathname.startsWith("/") ? pathname : `/${pathname}`)
    : "/";

  return new URL(normalizedPath, `${normalizedOrigin}/`).href;
}

export function getMarketingUrl(pathname = "/", options = {}) {
  const normalizedPath = normalizeMarketingPath(pathname);
  if (shouldUseLocalUrls(options)) {
    return buildOriginUrl(getRuntimeLocation(options).origin, normalizedPath);
  }

  return buildSiteUrl(MARKETING_SITE_URL, normalizedPath);
}

export function getPlannerUrl(pathname = "/", options = {}) {
  if (shouldUseLocalUrls(options)) {
    return buildOriginUrl(getRuntimeLocation(options).origin, normalizePlannerPath(pathname));
  }

  return buildSiteUrl(PLANNER_SITE_URL, pathname);
}
