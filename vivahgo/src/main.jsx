import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ClerkProvider } from '@clerk/react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import App from './App.jsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const app = (
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);

const providers = app;
let wrappedApp = providers;

if (clientId) {
  wrappedApp = <GoogleOAuthProvider clientId={clientId}>{wrappedApp}</GoogleOAuthProvider>;
}

if (clerkPublishableKey) {
  wrappedApp = <ClerkProvider publishableKey={clerkPublishableKey}>{wrappedApp}</ClerkProvider>;
}

createRoot(document.getElementById('root')).render(wrappedApp)
