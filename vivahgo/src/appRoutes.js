export function normalizePathname(pathname = "/") {
  return pathname.replace(/\/+$/, "") || "/";
}

export function getRouteInfo(pathname = "/") {
  const normalizedPathname = normalizePathname(pathname);
  const isMarketingHomeRoute = /^\/home\/?$/.test(pathname);
  const isPricingRoute = /^\/pricing\/?$/.test(pathname);
  const isGuidesRoute = /^\/guides\/?$/.test(pathname);
  const guideMatch = normalizedPathname.match(/^\/guides\/([^/]+)$/);
  const guideSlug = guideMatch ? decodeURIComponent(guideMatch[1]) : "";
  const isCareersRoute = /^\/careers\/?$/.test(pathname);
  const isWeddingWebsiteRoute = /^\/wedding\/?$/.test(pathname);
  const rsvpMatch = normalizedPathname.match(/^\/rsvp\/([^/]+)$/);
  const rsvpToken = rsvpMatch ? decodeURIComponent(rsvpMatch[1]) : '';
  const isVendorRoute = /^\/vendor\/?$/.test(pathname);
  const isAdminRoute = /^\/admin\/?$/.test(pathname);
  const publicWeddingSlugMatch = normalizedPathname.match(/^\/([^/.][^/]*)$/);
  const publicWeddingSlug = publicWeddingSlugMatch && !["home", "pricing", "guides", "rsvp", "vendor", "wedding", "admin", "careers"].includes(publicWeddingSlugMatch[1].toLowerCase())
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
