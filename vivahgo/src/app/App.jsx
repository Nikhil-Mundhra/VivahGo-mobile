import { Suspense, lazy, useEffect, useRef, useSyncExternalStore } from "react";
import { getRouteInfo } from "./routes/appRoutes.js";
import { shouldShowChatbaseForRoute } from "../chatbase.js";
import ChatbaseChatbot from "../components/ChatbaseChatbot.jsx";
import ObservabilitySmokePanel from "../components/ObservabilitySmokePanel.jsx";
import { usePageSeo } from "../seo.js";
import { getMarketingUrl, getPlannerUrl } from "../siteUrls.js";
import queryPages from "../shared/content/query-pages.json";
import { setClarityRouteContext } from "../shared/clarity.js";
import {
  capturePostHogEvent,
  getCurrentPostHogRoutePath,
  setPostHogRouteContext,
  subscribeToPostHogRouteChanges,
} from "../shared/posthog.js";
import { setSentryRoute } from "../shared/sentry.js";

const PlannerPage = lazy(() => import("../pages/PlannerPage.jsx"));
const MarketingHomePage = lazy(() => import("../features/marketing/pages/MarketingHomePage.jsx"));
const CareersPage = lazy(() => import("../features/marketing/pages/CareersPage.jsx"));
const TermsPage = lazy(() => import("../features/marketing/pages/TermsPage.jsx"));
const PrivacyPolicyPage = lazy(() => import("../features/marketing/pages/PrivacyPolicyPage.jsx"));
const DataDeletionInstructionsPage = lazy(() => import("../features/marketing/pages/DataDeletionInstructionsPage.jsx"));
const GuidesPage = lazy(() => import("../features/guides/pages/GuidesPage.jsx"));
const GuideArticlePage = lazy(() => import("../features/guides/pages/GuideArticlePage.jsx"));
const QueryCapturePage = lazy(() => import("../features/marketing/pages/QueryCapturePage.jsx"));
const GuestRsvpPage = lazy(() => import("../features/guest-rsvp/pages/GuestRsvpPage.jsx"));
const WeddingWebsitePage = lazy(() => import("../features/wedding-website/pages/WeddingWebsitePage.jsx"));
const VendorPortalPage = lazy(() => import("../features/vendor/pages/VendorPortalPage.jsx"));
const AdminPortalPage = lazy(() => import("../features/admin/pages/AdminPortalPage.jsx"));
const ClerkSsoCallbackPage = lazy(() => import("../pages/ClerkSsoCallbackPage.jsx"));
const QUERY_PAGE_BY_SLUG = Object.fromEntries(queryPages.map((page) => [page.slug, page]));
const ROUTE_COMPONENTS = [
  { when: (routeInfo) => routeInfo.isVendorRoute, render: () => <VendorPortalPage /> },
  { when: (routeInfo) => routeInfo.isAdminRoute, render: () => <AdminPortalPage /> },
  { when: (routeInfo) => routeInfo.isClerkSsoCallbackRoute, render: () => <ClerkSsoCallbackPage /> },
  { when: (routeInfo) => routeInfo.isCareersRoute, render: () => <CareersPage /> },
  { when: (routeInfo) => routeInfo.isTermsRoute, render: () => <TermsPage /> },
  { when: (routeInfo) => routeInfo.isPrivacyRoute, render: () => <PrivacyPolicyPage /> },
  { when: (routeInfo) => routeInfo.isDataDeletionRoute, render: () => <DataDeletionInstructionsPage /> },
  { when: (routeInfo) => routeInfo.isGuidesRoute, render: () => <GuidesPage /> },
  { when: (routeInfo) => routeInfo.guideSlug, render: (routeInfo) => <GuideArticlePage guideSlug={routeInfo.guideSlug} /> },
  { when: (routeInfo) => routeInfo.queryPageSlug, render: (routeInfo) => <QueryCapturePage pageSlug={routeInfo.queryPageSlug} /> },
  { when: (routeInfo) => routeInfo.isMarketingHomeRoute, render: () => <MarketingHomePage page="home" /> },
  { when: (routeInfo) => routeInfo.isPricingRoute, render: () => <MarketingHomePage page="pricing" /> },
  { when: (routeInfo) => routeInfo.isWeddingWebsiteRoute, render: () => <WeddingWebsitePage /> },
  { when: (routeInfo) => routeInfo.rsvpToken, render: (routeInfo) => <GuestRsvpPage rsvpToken={routeInfo.rsvpToken} /> },
  { when: (routeInfo) => routeInfo.publicWeddingSlug, render: (routeInfo) => <WeddingWebsitePage websiteSlug={routeInfo.publicWeddingSlug} /> },
];

function PageFallback() {
  return <div className="app-page-fallback" aria-hidden="true" />;
}

export default function App() {
  const routePath = useSyncExternalStore(
    subscribeToPostHogRouteChanges,
    getCurrentPostHogRoutePath,
    () => "/"
  );
  const pathname = routePath.split("?")[0] || "/";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const routeInfo = getRouteInfo(pathname, { hostname });
  const lastTrackedRouteRef = useRef("");
  const shouldShowChatbase = shouldShowChatbaseForRoute(routeInfo);
  const queryPage = routeInfo.queryPageSlug ? QUERY_PAGE_BY_SLUG[routeInfo.queryPageSlug] : null;
  const fallbackSeo = routeInfo.isMarketingHomeRoute
    ? {
      title: "VivahGo | Wedding Planner App for Indian Weddings",
      description: "VivahGo is a wedding planner app for Indian weddings that helps couples, families, and planners manage checklists, budgets, guests, vendors, RSVPs, timelines, and wedding websites in one shared workspace.",
      canonicalUrl: getMarketingUrl("/"),
    }
    : routeInfo.isPricingRoute
      ? {
        title: "VivahGo Pricing | Plans for Couples and Planners",
        description: "Compare wedding planner app pricing for couples, families, planners, and studios managing guests, budgets, vendors, RSVPs, and wedding websites.",
        canonicalUrl: getMarketingUrl("/pricing"),
      }
      : routeInfo.isTermsRoute
        ? {
          title: "VivahGo Terms and Conditions",
          description: "Read the terms and conditions for using VivahGo.",
          canonicalUrl: getMarketingUrl("/terms"),
        }
      : routeInfo.isPrivacyRoute
        ? {
          title: "VivahGo Privacy Policy",
          description: "Read how VivahGo collects, uses, and protects your information.",
          canonicalUrl: getMarketingUrl("/privacy-policy"),
        }
      : routeInfo.isDataDeletionRoute
        ? {
          title: "VivahGo Data Deletion Instructions",
          description: "Learn how to request deletion of your VivahGo account and associated personal data.",
          canonicalUrl: getMarketingUrl("/data-deletion-instructions"),
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
      : queryPage
        ? {
          title: queryPage.seoTitle,
          description: queryPage.seoDescription,
          canonicalUrl: getMarketingUrl(`/${queryPage.slug}`),
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
                : routeInfo.isClerkSsoCallbackRoute
                  ? {
                    title: "VivahGo | Completing Sign In",
                    description: "Completing your sign-in.",
                    path: "/auth/sso-callback",
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
    setClarityRouteContext(routePath, { bodyRoute: routeInfo.bodyRoute });
    const routeProperties = setPostHogRouteContext(routePath, { bodyRoute: routeInfo.bodyRoute });
    setSentryRoute(routePath, { bodyRoute: routeInfo.bodyRoute });

    if (lastTrackedRouteRef.current === routePath) {
      return;
    }

    lastTrackedRouteRef.current = routePath;
    capturePostHogEvent("$pageview", routeProperties);
  }, [routeInfo.bodyRoute, routePath]);

  usePageSeo(fallbackSeo);

  const matchedRoute = ROUTE_COMPONENTS.find((entry) => entry.when(routeInfo));
  const page = matchedRoute ? matchedRoute.render(routeInfo) : <PlannerPage />;

  return (
    <>
      <ChatbaseChatbot enabled={shouldShowChatbase} />
      <Suspense fallback={<PageFallback />}>{page}</Suspense>
      <ObservabilitySmokePanel routePath={routePath} bodyRoute={routeInfo.bodyRoute} />
    </>
  );
}
