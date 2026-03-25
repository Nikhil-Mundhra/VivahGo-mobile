import { useEffect, useRef, useState } from 'react';
import './vendor.css';
import './styles.css';
import GoogleLoginButton from './components/GoogleLoginButton';
import VendorRegistrationForm from './components/VendorRegistrationForm';
import VendorPortfolioManager from './components/VendorPortfolioManager';
import VendorPortfolioGallery from './components/VendorPortfolioGallery';
import VendorBusinessProfileEditor from './components/VendorBusinessProfileEditor';
import { deleteAccount, fetchVendorProfile, loginWithGoogle } from './api';
import { formatCoverageLocation } from './locationOptions';

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
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  // Track which token we last completed a fetch for.
  // loadingVendor is derived: we have a token but haven't finished fetching for it yet.
  const [lastFetchedToken, setLastFetchedToken] = useState(null);
  const loadingVendor = Boolean(session?.token) && session.token !== lastFetchedToken;
  const profileEditorRef = useRef(null);

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

  function handleLogout() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setVendor(null);
    setLastFetchedToken(null);
    setShowSettingsMenu(false);
  }

  async function handleDeleteAccount() {
    if (!session?.token || isDeletingAccount) {
      return;
    }

    const confirmed = window.confirm('Delete this account and vendor profile permanently? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setDeleteError('');
    setIsDeletingAccount(true);

    try {
      await deleteAccount(session.token);
      handleLogout();
    } catch (error) {
      setDeleteError(error.message || 'Could not delete account.');
    } finally {
      setIsDeletingAccount(false);
      setShowSettingsMenu(false);
    }
  }

  function focusUserPreferences() {
    setShowSettingsMenu(false);
    profileEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            <div className="relative">
              <button
                type="button"
                className="vendor-settings-pill"
                onClick={() => setShowSettingsMenu(current => !current)}
              >
                Account & Settings
              </button>
              {showSettingsMenu && (
                <div className="vendor-settings-menu">
                  <button type="button" className="vendor-settings-menu-item" onClick={focusUserPreferences}>
                    User Preferences
                  </button>
                  <button type="button" className="vendor-settings-menu-item" onClick={handleLogout}>
                    Logout
                  </button>
                  <button
                    type="button"
                    className="vendor-settings-menu-item vendor-settings-menu-item-danger"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                  >
                    {isDeletingAccount ? 'Deleting…' : 'Delete Account'}
                  </button>
                </div>
              )}
            </div>
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
                  {vendor.subType && <p className="text-gray-500 text-sm">{vendor.subType}</p>}
                  {[vendor.city, vendor.state, vendor.country].filter(Boolean).length > 0 && (
                    <p className="text-gray-500 text-sm">{[vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ')}</p>
                  )}
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
                  {Array.isArray(vendor.coverageAreas) && vendor.coverageAreas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {vendor.coverageAreas.map(area => (
                        <span key={`${area.country}-${area.state}-${area.city}`} className="vendor-coverage-chip">
                          {formatCoverageLocation(area)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`inline-flex w-fit items-center px-3 py-1 rounded-full text-xs font-semibold ${vendor.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {vendor.isApproved ? '✓ Approved' : 'Pending Approval'}
                </span>
              </div>
            </div>

            <div ref={profileEditorRef} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Business Details</h2>
              <p className="text-sm text-gray-500 mb-4">Update your contact information, locations, and category preferences anytime.</p>
              <VendorBusinessProfileEditor token={session.token} vendor={vendor} onVendorUpdated={setVendor} />
              {deleteError && (
                <p className="mt-3 text-sm text-red-600">{deleteError}</p>
              )}
            </div>

            {/* Portfolio section */}
            <div className="space-y-6">
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
