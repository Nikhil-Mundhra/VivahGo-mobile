import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import App from './App.jsx'
import MarketingHomePage from './MarketingHomePage.jsx'
import WeddingWebsitePage from './components/WeddingWebsitePage.jsx'
import VendorPortal from './VendorPortal.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
const isMarketingHomeRoute = /^\/home\/?$/.test(pathname);
const isWeddingWebsiteRoute = /^\/wedding\/?$/.test(pathname);
const isVendorRoute = /^\/vendor\/?$/.test(pathname);
const publicWeddingSlugMatch = normalizedPathname.match(/^\/([^/.][^/]*)$/);
const publicWeddingSlug = publicWeddingSlugMatch && !['home', 'vendor', 'wedding'].includes(publicWeddingSlugMatch[1].toLowerCase())
  ? decodeURIComponent(publicWeddingSlugMatch[1])
  : '';

if (typeof document !== 'undefined') {
  document.body.dataset.route = isMarketingHomeRoute ? 'home'
    : isWeddingWebsiteRoute ? 'wedding'
    : publicWeddingSlug ? 'wedding'
    : isVendorRoute ? 'vendor'
    : 'app';
}

const app = (
  <StrictMode>
    {isVendorRoute ? <VendorPortal />
      : isMarketingHomeRoute ? <MarketingHomePage />
      : isWeddingWebsiteRoute ? <WeddingWebsitePage />
      : publicWeddingSlug ? <WeddingWebsitePage websiteSlug={publicWeddingSlug} />
      : <App />}
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);

createRoot(document.getElementById('root')).render(
  clientId ? <GoogleOAuthProvider clientId={clientId}>{app}</GoogleOAuthProvider> : app,
)
