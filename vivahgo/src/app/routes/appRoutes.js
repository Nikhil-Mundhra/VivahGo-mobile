import { isLocalHostname, isPlannerHostname, normalizeHostname, shouldRenderMarketingHomeAtRoot } from "../../siteUrls.js";

export const QUERY_CAPTURE_PAGE_SLUGS = [
  "wedding-planner-app",
  "wedding-checklist-app",
  "wedding-budget-planner-app",
  "guest-list-rsvp-app",
  "wedding-vendor-manager-app",
  "indian-wedding-budget-template",
  "free-wedding-budget-template",
  "wedding-guest-list-template",
  "for-wedding-planners",
];

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
  const isTermsRoute = normalizedPathname === "/terms";
  const isPrivacyRoute = normalizedPathname === "/privacy-policy";
  const isDataDeletionRoute = normalizedPathname === "/data-deletion-instructions";
  const isGuidesRoute = normalizedPathname === "/guides";
  const guideMatch = normalizedPathname.match(/^\/guides\/([^/]+)$/);
  const guideSlug = guideMatch ? decodeURIComponent(guideMatch[1]) : "";
  const queryPageMatch = normalizedPathname.match(/^\/([^/]+)$/);
  const queryPageSlug = queryPageMatch && QUERY_CAPTURE_PAGE_SLUGS.includes(queryPageMatch[1])
    ? decodeURIComponent(queryPageMatch[1])
    : "";
  const isCareersRoute = normalizedPathname === "/careers";
  const isWeddingWebsiteRoute = normalizedPathname === "/wedding";
  const rsvpMatch = normalizedPathname.match(/^\/rsvp\/([^/]+)$/);
  const rsvpToken = rsvpMatch ? decodeURIComponent(rsvpMatch[1]) : "";
  const isVendorRoute = normalizedPathname === "/vendor";
  const isAdminRoute = normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/");
  const isClerkSsoCallbackRoute = normalizedPathname === "/auth/sso-callback";
  const publicWeddingSlugMatch = normalizedPathname.match(/^\/([^/.][^/]*)$/);
  const publicWeddingSlug = publicWeddingSlugMatch
    && !queryPageSlug
    && !["home", "planner", "pricing", "terms", "privacy-policy", "data-deletion-instructions", "guides", "rsvp", "vendor", "wedding", "admin", "careers"].includes(publicWeddingSlugMatch[1].toLowerCase())
    ? decodeURIComponent(publicWeddingSlugMatch[1])
    : "";

  const bodyRoute = isMarketingHomeRoute || isPricingRoute || isTermsRoute || isPrivacyRoute || isDataDeletionRoute || isGuidesRoute || guideSlug || queryPageSlug ? "home"
    : rsvpToken ? "rsvp"
    : isWeddingWebsiteRoute ? "wedding"
    : isCareersRoute ? "careers"
    : isVendorRoute ? "vendor"
    : isAdminRoute ? "admin"
    : isClerkSsoCallbackRoute ? "app"
    : publicWeddingSlug ? "wedding"
    : "app";

  return {
    normalizedPathname,
    normalizedHostname,
    isRootMarketingHomeRoute,
    isLocalPlannerRoute,
    isMarketingHomeRoute,
    isPricingRoute,
    isTermsRoute,
    isPrivacyRoute,
    isDataDeletionRoute,
    isGuidesRoute,
    guideSlug,
    queryPageSlug,
    isCareersRoute,
    isWeddingWebsiteRoute,
    rsvpToken,
    isVendorRoute,
    isAdminRoute,
    isClerkSsoCallbackRoute,
    publicWeddingSlug,
    bodyRoute,
  };
}
