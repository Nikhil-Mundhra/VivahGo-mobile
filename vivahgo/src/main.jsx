import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import App from './App.jsx'
import MarketingHomePage from './MarketingHomePage.jsx'
import WeddingWebsitePage from './components/WeddingWebsitePage.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
const isMarketingHomeRoute = /^\/home\/?$/.test(pathname);
const isWeddingWebsiteRoute = /^\/wedding\/?$/.test(pathname);

if (typeof document !== 'undefined') {
  document.body.dataset.route = isMarketingHomeRoute ? 'home' : isWeddingWebsiteRoute ? 'wedding' : 'app';
}

const app = (
  <StrictMode>
    {isMarketingHomeRoute ? <MarketingHomePage /> : isWeddingWebsiteRoute ? <WeddingWebsitePage /> : <App />}
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);

createRoot(document.getElementById('root')).render(
  clientId ? <GoogleOAuthProvider clientId={clientId}>{app}</GoogleOAuthProvider> : app,
)
