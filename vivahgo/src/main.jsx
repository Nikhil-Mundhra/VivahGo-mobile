import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import PlannerPage from './pages/PlannerPage.jsx'
import MarketingHomePage from './pages/MarketingHomePage.jsx'
import CareersPage from './pages/CareersPage.jsx'
import WeddingWebsitePage from './pages/WeddingWebsitePage.jsx'
import VendorPortalPage from './pages/VendorPortalPage.jsx'
import AdminPortalPage from './pages/AdminPortalPage.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
const isMarketingHomeRoute = /^\/home\/?$/.test(pathname);
const isCareersRoute = /^\/careers\/?$/.test(pathname);
const isWeddingWebsiteRoute = /^\/wedding\/?$/.test(pathname);
const isVendorRoute = /^\/vendor\/?$/.test(pathname);
const isAdminRoute = /^\/admin\/?$/.test(pathname);
const publicWeddingSlugMatch = normalizedPathname.match(/^\/([^/.][^/]*)$/);
const publicWeddingSlug = publicWeddingSlugMatch && !['home', 'vendor', 'wedding', 'admin', 'careers'].includes(publicWeddingSlugMatch[1].toLowerCase())
  ? decodeURIComponent(publicWeddingSlugMatch[1])
  : '';

if (typeof document !== 'undefined') {
  document.body.dataset.route = isMarketingHomeRoute ? 'home'
    : isWeddingWebsiteRoute ? 'wedding'
    : isCareersRoute ? 'careers'
    : isVendorRoute ? 'vendor'
    : isAdminRoute ? 'admin'
    : publicWeddingSlug ? 'wedding'
    : 'app';
}

const app = (
  <StrictMode>
    {isVendorRoute ? <VendorPortalPage />
      : isAdminRoute ? <AdminPortalPage />
      : isCareersRoute ? <CareersPage />
      : isMarketingHomeRoute ? <MarketingHomePage />
      : isWeddingWebsiteRoute ? <WeddingWebsitePage />
      : publicWeddingSlug ? <WeddingWebsitePage websiteSlug={publicWeddingSlug} />
      : <PlannerPage />}
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);

createRoot(document.getElementById('root')).render(
  clientId ? <GoogleOAuthProvider clientId={clientId}>{app}</GoogleOAuthProvider> : app,
)
