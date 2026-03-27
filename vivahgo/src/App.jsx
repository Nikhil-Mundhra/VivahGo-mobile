import { useEffect } from "react";
import PlannerPage from "./pages/PlannerPage.jsx";
import MarketingHomePage from "./pages/MarketingHomePage.jsx";
import CareersPage from "./pages/CareersPage.jsx";
import GuidesPage from "./pages/GuidesPage.jsx";
import GuideArticlePage from "./pages/GuideArticlePage.jsx";
import GuestRsvpPage from "./pages/GuestRsvpPage.jsx";
import WeddingWebsitePage from "./pages/WeddingWebsitePage.jsx";
import VendorPortalPage from "./pages/VendorPortalPage.jsx";
import AdminPortalPage from "./pages/AdminPortalPage.jsx";
import { getRouteInfo } from "./appRoutes.js";
import { usePageSeo } from "./seo.js";

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const routeInfo = getRouteInfo(pathname);
  const fallbackSeo = routeInfo.isMarketingHomeRoute
    ? {
      title: "VivahGo | Indian Wedding Planner App for Cultural Weddings",
      description: "VivahGo is an Indian wedding planner app for cultural weddings with checklist tracking, budgets, guest lists, vendors, RSVPs, ceremonies, and wedding websites.",
      path: "/home",
    }
    : routeInfo.isPricingRoute
      ? {
        title: "VivahGo Pricing | Plans for Couples and Planners",
        description: "Compare Indian wedding planner app pricing for couples, families, planners, and studios managing guests, budgets, vendors, RSVPs, and wedding websites.",
        path: "/pricing",
      }
      : routeInfo.isGuidesRoute
        ? {
          title: "VivahGo Guides | Indian Wedding Planning Resources",
          description: "Browse Indian wedding planning guides for checklists, budgets, guest lists, vendor coordination, cultural wedding timelines, and destination weddings.",
          path: "/guides",
        }
      : routeInfo.guideSlug
        ? {
          title: "VivahGo Guide",
          description: "An Indian wedding planning guide from VivahGo.",
          path: `/guides/${routeInfo.guideSlug}`,
        }
      : routeInfo.isCareersRoute
        ? {
          title: "VivahGo Careers | Join the Team",
          description: "Explore careers at VivahGo and help build better wedding planning tools for couples and planners.",
          path: "/careers",
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
                    path: "/",
                    noindex: true,
                  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.route = routeInfo.bodyRoute;
    }
  }, [routeInfo.bodyRoute]);

  usePageSeo(fallbackSeo);

  if (routeInfo.isVendorRoute) {
    return <VendorPortalPage />;
  }

  if (routeInfo.isAdminRoute) {
    return <AdminPortalPage />;
  }

  if (routeInfo.isCareersRoute) {
    return <CareersPage />;
  }

  if (routeInfo.isGuidesRoute) {
    return <GuidesPage />;
  }

  if (routeInfo.guideSlug) {
    return <GuideArticlePage guideSlug={routeInfo.guideSlug} />;
  }

  if (routeInfo.isMarketingHomeRoute) {
    return <MarketingHomePage page="home" />;
  }

  if (routeInfo.isPricingRoute) {
    return <MarketingHomePage page="pricing" />;
  }

  if (routeInfo.isWeddingWebsiteRoute) {
    return <WeddingWebsitePage />;
  }

  if (routeInfo.rsvpToken) {
    return <GuestRsvpPage rsvpToken={routeInfo.rsvpToken} />;
  }

  if (routeInfo.publicWeddingSlug) {
    return <WeddingWebsitePage websiteSlug={routeInfo.publicWeddingSlug} />;
  }

  return <PlannerPage />;
}
