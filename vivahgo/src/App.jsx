import { Suspense, lazy, useEffect } from "react";
import { getRouteInfo } from "./appRoutes.js";
import { shouldShowChatbaseForRoute } from "./chatbase.js";
import ChatbaseChatbot from "./components/ChatbaseChatbot.jsx";
import { usePageSeo } from "./seo.js";
import { getMarketingUrl, getPlannerUrl } from "./siteUrls.js";
import queryPages from "./content/query-pages.json";

const PlannerPage = lazy(() => import("./pages/PlannerPage.jsx"));
const MarketingHomePage = lazy(() => import("./pages/MarketingHomePage.jsx"));
const CareersPage = lazy(() => import("./pages/CareersPage.jsx"));
const TermsPage = lazy(() => import("./pages/TermsPage.jsx"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage.jsx"));
const DataDeletionInstructionsPage = lazy(() => import("./pages/DataDeletionInstructionsPage.jsx"));
const GuidesPage = lazy(() => import("./pages/GuidesPage.jsx"));
const GuideArticlePage = lazy(() => import("./pages/GuideArticlePage.jsx"));
const QueryCapturePage = lazy(() => import("./pages/QueryCapturePage.jsx"));
const GuestRsvpPage = lazy(() => import("./pages/GuestRsvpPage.jsx"));
const WeddingWebsitePage = lazy(() => import("./pages/WeddingWebsitePage.jsx"));
const VendorPortalPage = lazy(() => import("./pages/VendorPortalPage.jsx"));
const AdminPortalPage = lazy(() => import("./pages/AdminPortalPage.jsx"));
const ClerkSsoCallbackPage = lazy(() => import("./pages/ClerkSsoCallbackPage.jsx"));
const QUERY_PAGE_BY_SLUG = Object.fromEntries(queryPages.map((page) => [page.slug, page]));

function PageFallback() {
  return <div className="app-page-fallback" aria-hidden="true" />;
}

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const routeInfo = getRouteInfo(pathname, { hostname });
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

  usePageSeo(fallbackSeo);

  let page = <PlannerPage />;

  if (routeInfo.isVendorRoute) {
    page = <VendorPortalPage />;
  } else if (routeInfo.isAdminRoute) {
    page = <AdminPortalPage />;
  } else if (routeInfo.isClerkSsoCallbackRoute) {
    page = <ClerkSsoCallbackPage />;
  } else if (routeInfo.isCareersRoute) {
    page = <CareersPage />;
  } else if (routeInfo.isTermsRoute) {
    page = <TermsPage />;
  } else if (routeInfo.isPrivacyRoute) {
    page = <PrivacyPolicyPage />;
  } else if (routeInfo.isDataDeletionRoute) {
    page = <DataDeletionInstructionsPage />;
  } else if (routeInfo.isGuidesRoute) {
    page = <GuidesPage />;
  } else if (routeInfo.guideSlug) {
    page = <GuideArticlePage guideSlug={routeInfo.guideSlug} />;
  } else if (routeInfo.queryPageSlug) {
    page = <QueryCapturePage pageSlug={routeInfo.queryPageSlug} />;
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

  return (
    <>
      <ChatbaseChatbot enabled={shouldShowChatbase} />
      <Suspense fallback={<PageFallback />}>{page}</Suspense>
    </>
  );
}
