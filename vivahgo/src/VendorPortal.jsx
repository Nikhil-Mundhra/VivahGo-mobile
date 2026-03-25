import { useEffect, useState } from 'react';
import './vendor.css';
import GoogleLoginButton from './components/GoogleLoginButton';
import VendorRegistrationForm from './components/VendorRegistrationForm';
import VendorPortfolioManager from './components/VendorPortfolioManager';
import VendorPortfolioGallery from './components/VendorPortfolioGallery';
import { fetchVendorProfile, loginWithGoogle } from './api';

const SESSION_KEY = 'vivahgo.session';

function readSession() {
  if (typeof window === 'undefined') { return null; }
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export default function VendorPortal() {
  const [session, setSession] = useState(() => readSession());
  const [vendor, setVendor] = useState(null);
  const [vendorLoadError, setVendorLoadError] = useState('');
  // Track which token we last completed a fetch for.
  // loadingVendor is derived: we have a token but haven't finished fetching for it yet.
  const [lastFetchedToken, setLastFetchedToken] = useState(null);
  const loadingVendor = Boolean(session?.token) && session.token !== lastFetchedToken;

  useEffect(() => {
    document.title = 'VivahGo | Vendor Portal';
  }, []);

  useEffect(() => {
    if (!session?.token) { return; }

    let cancelled = false;

    fetchVendorProfile(session.token)
      .then(data => {
        if (cancelled) { return; }
        setVendor(data.vendor);
        setLastFetchedToken(session.token);
      })
      .catch(err => {
        if (cancelled) { return; }
        // 404 is expected when the user hasn't registered yet — not an error state
        if (err.message && !err.message.includes('404') && !err.message.includes('No vendor profile')) {
          setVendorLoadError(err.message || 'Could not load vendor profile.');
        }
        setVendor(null);
        setLastFetchedToken(session.token);
      });

    return () => { cancelled = true; };
  }, [session]);

  async function handleLoginSuccess(credentialResponse) {
    try {
      const data = await loginWithGoogle(credentialResponse.credential);
      const newSession = {
        mode: 'google',
        token: data.token,
        user: data.user,
        plannerOwnerId: data.plannerOwnerId || data.user?.id || '',
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      // Reset vendor state before the new session triggers a fresh fetch
      setVendor(null);
      setLastFetchedToken(null);
      setVendorLoadError('');
      setSession(newSession);
    } catch {
      // Error shown implicitly; user can retry
    }
  }

  if (!session?.token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center mb-6">
            <img src="/Thumbnail.png" alt="VivahGo" className="h-12 mb-3" />
            <h1 className="text-2xl font-bold text-gray-900">Vendor Portal</h1>
            <p className="text-gray-500 text-sm mt-1 text-center">
              List your business and showcase your portfolio to thousands of couples.
            </p>
          </div>
          <GoogleLoginButton onLoginSuccess={handleLoginSuccess} onLoginError={() => {}} />
          <div className="mt-4 text-center">
            <a href="/home" className="text-sm text-rose-600 hover:underline">← Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  if (loadingVendor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading your vendor profile…</p>
      </div>
    );
  }

  if (vendorLoadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{vendorLoadError}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 text-sm text-rose-600 hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-amber-50">
      <header className="bg-white shadow-sm border-b border-gray-100 px-3 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/home" className="flex items-center gap-2 min-w-0">
            <img src="/Thumbnail.png" alt="VivahGo" className="h-8" />
            <span className="font-semibold text-gray-900 truncate">Vendor Portal</span>
          </a>
          <div className="flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between sm:justify-end">
            {session.user?.name && (
              <span className="max-w-full text-sm text-gray-500 truncate">{session.user.name}</span>
            )}
            <a href="/" className="shrink-0 text-sm text-rose-600 font-medium hover:underline">Open Planner</a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 py-6 sm:px-4 sm:py-8">
        {!vendor ? (
          <VendorRegistrationForm
            token={session.token}
            onRegistered={setVendor}
          />
        ) : (
          <div className="space-y-6">
            {/* Profile card */}
            <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{vendor.businessName}</h1>
                  <p className="text-rose-600 font-medium text-sm mt-0.5">{vendor.type}</p>
                  {vendor.city && <p className="text-gray-500 text-sm">{vendor.city}</p>}
                  {vendor.phone && (
                    <p className="text-gray-500 text-sm">
                      <a href={`tel:${vendor.phone}`} className="hover:underline">{vendor.phone}</a>
                    </p>
                  )}
                  {vendor.website && (
                    <p className="text-sm mt-0.5">
                      <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:underline break-all">
                        {vendor.website}
                      </a>
                    </p>
                  )}
                  {vendor.description && (
                    <p className="text-gray-700 text-sm mt-3">{vendor.description}</p>
                  )}
                </div>
                <span className={`inline-flex w-fit items-center px-3 py-1 rounded-full text-xs font-semibold ${vendor.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {vendor.isApproved ? '✓ Approved' : 'Pending Approval'}
                </span>
              </div>
            </div>

            {/* Portfolio section */}
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Portfolio Manager</h2>
                <p className="text-sm text-gray-500 mb-4">Upload, organize, and fine-tune what couples see first.</p>

                <VendorPortfolioManager
                  token={session.token}
                  media={vendor.media || []}
                  onVendorUpdated={updatedVendor => setVendor(updatedVendor)}
                />
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Live Preview</h2>
                <p className="text-sm text-gray-500 mb-4">This is how your public portfolio is currently being presented.</p>

                <VendorPortfolioGallery media={vendor.media || []} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
