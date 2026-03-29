import { isLocalHostname, isPlannerHostname, normalizeHostname, shouldRenderMarketingHomeAtRoot } from "./siteUrls.js";

export function normalizePathname(pathname = "/") {
  return pathname.replace(/\/+$/, "") || "/";
}

export function getRouteInfo(pathname = "/", options = {}) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedHostname = normalizeHostname(options.hostname || "");
  const isRootMarketingHomeRoute = normalizedPathname === "/" && shouldRenderMarketingHomeAtRoot(normalizedHostname);
  const isLocalPlannerRoute = isLocalHostname(normalizedHostname) && normalizedPathname === "/planner";
  const isMarketingHomeAliasRoute = normalizedPathname === "/home" && !isPlannerHostname(normalizedHostname);
  const isMarketingHomeRoute = isRootMarketingHomeRoute || isMarketingHomeAliasRoute;
  const isPricingRoute = normalizedPathname === "/pricing";
  const isGuidesRoute = normalizedPathname === "/guides";
  const guideMatch = normalizedPathname.match(/^\/guides\/([^/]+)$/);
  const guideSlug = guideMatch ? decodeURIComponent(guideMatch[1]) : "";
  const isCareersRoute = normalizedPathname === "/careers";
  const isWeddingWebsiteRoute = normalizedPathname === "/wedding";
  const rsvpMatch = normalizedPathname.match(/^\/rsvp\/([^/]+)$/);
  const rsvpToken = rsvpMatch ? decodeURIComponent(rsvpMatch[1]) : "";
  const isVendorRoute = normalizedPathname === "/vendor";
  const isAdminRoute = normalizedPathname === "/admin";
  const publicWeddingSlugMatch = normalizedPathname.match(/^\/([^/.][^/]*)$/);
  const publicWeddingSlug = publicWeddingSlugMatch && !["home", "planner", "pricing", "guides", "rsvp", "vendor", "wedding", "admin", "careers"].includes(publicWeddingSlugMatch[1].toLowerCase())
    ? decodeURIComponent(publicWeddingSlugMatch[1])
    : "";

  const bodyRoute = isMarketingHomeRoute || isPricingRoute || isGuidesRoute || guideSlug ? "home"
    : rsvpToken ? "rsvp"
    : isWeddingWebsiteRoute ? "wedding"
    : isCareersRoute ? "careers"
    : isVendorRoute ? "vendor"
    : isAdminRoute ? "admin"
    : publicWeddingSlug ? "wedding"
    : "app";

  return {
    normalizedPathname,
    normalizedHostname,
    isRootMarketingHomeRoute,
    isLocalPlannerRoute,
    isMarketingHomeRoute,
    isPricingRoute,
    isGuidesRoute,
    guideSlug,
    isCareersRoute,
    isWeddingWebsiteRoute,
    rsvpToken,
    isVendorRoute,
    isAdminRoute,
    publicWeddingSlug,
    bodyRoute,
  };
}
