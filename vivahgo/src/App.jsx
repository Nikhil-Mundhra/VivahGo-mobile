import { useEffect } from "react";
import PlannerPage from "./pages/PlannerPage.jsx";
import MarketingHomePage from "./pages/MarketingHomePage.jsx";
import CareersPage from "./pages/CareersPage.jsx";
import WeddingWebsitePage from "./pages/WeddingWebsitePage.jsx";
import VendorPortalPage from "./pages/VendorPortalPage.jsx";
import AdminPortalPage from "./pages/AdminPortalPage.jsx";
import { getRouteInfo } from "./appRoutes.js";

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const routeInfo = getRouteInfo(pathname);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.route = routeInfo.bodyRoute;
    }
  }, [routeInfo.bodyRoute]);

  if (routeInfo.isVendorRoute) {
    return <VendorPortalPage />;
  }

  if (routeInfo.isAdminRoute) {
    return <AdminPortalPage />;
  }

  if (routeInfo.isCareersRoute) {
    return <CareersPage />;
  }

  if (routeInfo.isMarketingHomeRoute) {
    return <MarketingHomePage />;
  }

  if (routeInfo.isWeddingWebsiteRoute) {
    return <WeddingWebsitePage />;
  }

  if (routeInfo.publicWeddingSlug) {
    return <WeddingWebsitePage websiteSlug={routeInfo.publicWeddingSlug} />;
  }

  return <PlannerPage />;
}
