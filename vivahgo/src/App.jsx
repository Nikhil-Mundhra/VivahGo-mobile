import { Suspense, lazy, useEffect } from "react";
import { getRouteInfo } from "./appRoutes.js";
import { CHATBASE_CHATBOT_ID, initializeChatbase, removeChatbaseArtifacts, shouldShowChatbaseForRoute } from "./chatbase.js";
import { usePageSeo } from "./seo.js";
import { getMarketingUrl, getPlannerUrl } from "./siteUrls.js";

const PlannerPage = lazy(() => import("./pages/PlannerPage.jsx"));
const MarketingHomePage = lazy(() => import("./pages/MarketingHomePage.jsx"));
const CareersPage = lazy(() => import("./pages/CareersPage.jsx"));
const GuidesPage = lazy(() => import("./pages/GuidesPage.jsx"));
const GuideArticlePage = lazy(() => import("./pages/GuideArticlePage.jsx"));
const GuestRsvpPage = lazy(() => import("./pages/GuestRsvpPage.jsx"));
const WeddingWebsitePage = lazy(() => import("./pages/WeddingWebsitePage.jsx"));
const VendorPortalPage = lazy(() => import("./pages/VendorPortalPage.jsx"));
const AdminPortalPage = lazy(() => import("./pages/AdminPortalPage.jsx"));

function PageFallback() {
  return <div className="app-page-fallback" aria-hidden="true" />;
}

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const routeInfo = getRouteInfo(pathname, { hostname });
  const shouldShowChatbase = shouldShowChatbaseForRoute(routeInfo);
  const fallbackSeo = routeInfo.isMarketingHomeRoute
    ? {
      title: "VivahGo | Indian Wedding Planner App for Cultural Weddings",
      description: "VivahGo is an Indian wedding planner app for cultural weddings with checklist tracking, budgets, guest lists, vendors, RSVPs, ceremonies, and wedding websites.",
      canonicalUrl: getMarketingUrl("/"),
    }
    : routeInfo.isPricingRoute
      ? {
        title: "VivahGo Pricing | Plans for Couples and Planners",
        description: "Compare Indian wedding planner app pricing for couples, families, planners, and studios managing guests, budgets, vendors, RSVPs, and wedding websites.",
        canonicalUrl: getMarketingUrl("/pricing"),
      }
      : routeInfo.isGuidesRoute
        ? {
          title: "VivahGo Guides | Indian Wedding Planning Resources",
          description: "Browse Indian wedding planning guides for checklists, budgets, guest lists, vendor coordination, cultural wedding timelines, and destination weddings.",
          canonicalUrl: getMarketingUrl("/guides"),
        }
      : routeInfo.guideSlug
        ? {
          title: "VivahGo Guide",
          description: "An Indian wedding planning guide from VivahGo.",
          canonicalUrl: getMarketingUrl(`/guides/${routeInfo.guideSlug}`),
        }
      : routeInfo.isCareersRoute
        ? {
          title: "VivahGo Careers | Join the Team",
          description: "Explore careers at VivahGo and help build better wedding planning tools for couples and planners.",
          canonicalUrl: getMarketingUrl("/careers"),
        }
        : routeInfo.isWeddingWebsiteRoute
          ? {
            title: "VivahGo Wedding Website | Beautiful Public Wedding Pages",
            description: "Create a wedding website with event details, venue information, and a polished guest-facing experience.",
            path: "/wedding",
            noindex: true,
          }
          : routeInfo.rsvpToken
            ? {
              title: "VivahGo RSVP | Confirm Your Invitation",
              description: "Confirm your attendance, update guest counts, and respond to your invitation in a few clicks.",
              path: `/rsvp/${routeInfo.rsvpToken}`,
              noindex: true,
            }
            : routeInfo.isVendorRoute
              ? {
                title: "VivahGo | Vendor Portal",
                description: "Manage your VivahGo vendor profile, portfolio, and approvals from one place.",
                path: "/vendor",
                noindex: true,
              }
              : routeInfo.isAdminRoute
                ? {
                  title: "VivahGo | Admin Portal",
                  description: "VivahGo internal administration tools.",
                  path: "/admin",
                  noindex: true,
                }
                : routeInfo.publicWeddingSlug
                  ? {
                    title: "VivahGo Wedding Website",
                    description: "A public wedding website powered by VivahGo.",
                    path: `/${routeInfo.publicWeddingSlug}`,
                    noindex: true,
                  }
                  : {
                    title: "VivahGo Planner | Shared Wedding Workspace",
                    description: "Manage your wedding checklist, guests, budget, events, and vendors from one workspace.",
                    canonicalUrl: getPlannerUrl("/"),
                    noindex: true,
                  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.route = routeInfo.bodyRoute;
    }
  }, [routeInfo.bodyRoute]);

  useEffect(() => {
    if (shouldShowChatbase) {
      return initializeChatbase(CHATBASE_CHATBOT_ID);
    }

    removeChatbaseArtifacts(CHATBASE_CHATBOT_ID);
    return undefined;
  }, [shouldShowChatbase]);

  usePageSeo(fallbackSeo);

  let page = <PlannerPage />;

  if (routeInfo.isVendorRoute) {
    page = <VendorPortalPage />;
  } else if (routeInfo.isAdminRoute) {
    page = <AdminPortalPage />;
  } else if (routeInfo.isCareersRoute) {
    page = <CareersPage />;
  } else if (routeInfo.isGuidesRoute) {
    page = <GuidesPage />;
  } else if (routeInfo.guideSlug) {
    page = <GuideArticlePage guideSlug={routeInfo.guideSlug} />;
  } else if (routeInfo.isMarketingHomeRoute) {
    page = <MarketingHomePage page="home" />;
  } else if (routeInfo.isPricingRoute) {
    page = <MarketingHomePage page="pricing" />;
  } else if (routeInfo.isWeddingWebsiteRoute) {
    page = <WeddingWebsitePage />;
  } else if (routeInfo.rsvpToken) {
    page = <GuestRsvpPage rsvpToken={routeInfo.rsvpToken} />;
  } else if (routeInfo.publicWeddingSlug) {
    page = <WeddingWebsitePage websiteSlug={routeInfo.publicWeddingSlug} />;
  }

  return <Suspense fallback={<PageFallback />}>{page}</Suspense>;
}
