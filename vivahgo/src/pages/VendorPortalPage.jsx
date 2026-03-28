import { useEffect, useRef, useState } from 'react';
import '../vendor.css';
import '../styles.css';
import GoogleLoginButton from '../components/GoogleLoginButton';
import LoadingBar from '../components/LoadingBar';
import VendorRegistrationForm from '../components/VendorRegistrationForm';
import VendorPortfolioManager from '../components/VendorPortfolioManager';
import VendorDirectoryPreview from '../components/VendorDirectoryPreview';
import VendorBusinessProfileEditor from '../components/VendorBusinessProfileEditor';
import VendorPortalDashboard from '../components/VendorPortalDashboard';
import NavIcon from '../components/NavIcon';
import { clearAuthStorage } from '../authStorage';
import { deleteAccount, fetchVendorProfile, loginWithGoogle } from '../api';

const SESSION_KEY = 'vivahgo.session';
const VENDOR_PORTAL_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'preview', label: 'Live Preview', icon: 'vendors' },
  { id: 'portfolio', label: 'Media Manager', icon: 'tasks' },
  { id: 'details', label: 'Business Details', icon: 'budget' },
];

function readSession() {
  if (typeof window === 'undefined') { return null; }
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export default function VendorPortalPage() {
  const [session, setSession] = useState(() => readSession());
  const [vendor, setVendor] = useState(null);
  const [vendorLoadError, setVendorLoadError] = useState('');
  const [previewVendor, setPreviewVendor] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  // Track which token we last completed a fetch for.
  // loadingVendor is derived: we have a token but haven't finished fetching for it yet.
  const [lastFetchedToken, setLastFetchedToken] = useState(null);
  const loadingVendor = Boolean(session?.token) && session.token !== lastFetchedToken;
  const profileEditorRef = useRef(null);
  const accountFirstName = session?.user?.given_name || session?.user?.name?.split(' ')[0] || 'You';
  const profileInitial = accountFirstName.trim().charAt(0).toUpperCase() || 'Y';

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
        setPreviewVendor(data.vendor);
        setLastFetchedToken(session.token);
      })
      .catch(err => {
        if (cancelled) { return; }
        // 404 is expected when the user hasn't registered yet — not an error state
        if (err.message && !err.message.includes('404') && !err.message.includes('No vendor profile')) {
          setVendorLoadError(err.message || 'Could not load vendor profile.');
        }
        setVendor(null);
        setPreviewVendor(null);
        setLastFetchedToken(session.token);
      });

    return () => { cancelled = true; };
  }, [session]);

  async function handleLoginSuccess(credentialResponse) {
    setIsSigningIn(true);
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
      setPreviewVendor(null);
      setLastFetchedToken(null);
      setVendorLoadError('');
      setAvatarLoadError(false);
      setSession(newSession);
    } catch {
      // Error shown implicitly; user can retry
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleLogout() {
    clearAuthStorage('vendor');
    setSession(null);
    setVendor(null);
    setPreviewVendor(null);
    setLastFetchedToken(null);
    setShowSettingsMenu(false);
    setDeleteError('');
    setVendorLoadError('');
    setAvatarLoadError(false);
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
            <img src="/Thumbnail.png" alt="VivahGo" className="login-logo-image" style={{ maxWidth: 140, margin: '0 auto 12px' }} />
            <h1 className="text-2xl font-bold text-gray-900">Vendor Portal</h1>
            <p className="text-gray-500 text-sm mt-1 text-center">
              List your business and showcase your portfolio to thousands of couples.
            </p>
          </div>
          <GoogleLoginButton onLoginSuccess={handleLoginSuccess} onLoginError={() => {}} />
          {isSigningIn && (
            <div className="mt-4">
              <LoadingBar label="Signing you in with Google..." compact />
            </div>
          )}
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
        <div className="w-full max-w-sm px-6 text-center">
          <p className="text-gray-500 text-sm">Loading your vendor profile…</p>
          <LoadingBar className="mt-4" />
        </div>
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
          <a href="/home" className="vendor-home-pill">
            <img src="/Thumbnail.png" alt="VivahGo" className="h-8 w-8 rounded-full object-cover" />
            <span className="vendor-home-pill-text">Home</span>
          </a>
          <div className="flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between sm:justify-end">
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
            <a href="/" className="vendor-planner-pill">
              <span className="vendor-planner-pill-text">Open Planner</span>
              {session.user?.picture && !avatarLoadError ? (
                <img
                  src={session.user.picture}
                  alt={`${accountFirstName} profile`}
                  className="vendor-planner-pill-avatar"
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <span className="vendor-planner-pill-avatar vendor-planner-pill-avatar-fallback" aria-hidden="true">
                  {profileInitial}
                </span>
              )}
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 py-6 sm:px-4 sm:py-8">
        {!vendor ? (
          <VendorRegistrationForm
            token={session.token}
            onRegistered={registeredVendor => {
              setVendor(registeredVendor);
              setPreviewVendor(registeredVendor);
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="vendor-portal-summary-card">
              <div className="vendor-portal-summary-strip">
                <span className="vendor-portal-summary-item vendor-portal-summary-title">{vendor.businessName}</span>
                {vendor.type && (
                  <>
                    <span className="vendor-portal-summary-sep">|</span>
                    <span className="vendor-portal-summary-item">{vendor.type}</span>
                  </>
                )}
                {vendor.subType && (
                  <>
                    <span className="vendor-portal-summary-sep">|</span>
                    <span className="vendor-portal-summary-item">{vendor.subType}</span>
                  </>
                )}
                {[vendor.city, vendor.state, vendor.country].filter(Boolean).length > 0 && (
                  <>
                    <span className="vendor-portal-summary-sep">|</span>
                    <span className="vendor-portal-summary-item">
                      {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ')}
                    </span>
                  </>
                )}
                {vendor.phone && (
                  <>
                    <span className="vendor-portal-summary-sep">|</span>
                    <span className="vendor-portal-summary-item">{vendor.phone}</span>
                  </>
                )}
                <span className="vendor-portal-summary-spacer" />
                <span className={`vendor-portal-summary-status ${vendor.isApproved ? 'approved' : 'pending'}`}>
                  {vendor.isApproved ? '✓ Approved' : 'Pending Approval'}
                </span>
              </div>
            </div>

            <div className="vendor-portal-shell">
              <aside className="vendor-portal-sidebar">
                <div className="vendor-portal-sidebar-title">Vendor Menu</div>
                <div className="vendor-portal-sidebar-nav">
                  {VENDOR_PORTAL_SECTIONS.map(section => (
                    <button
                      key={section.id}
                      type="button"
                      className={`vendor-portal-sidebar-item${activeSection === section.id ? ' active' : ''}`}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <span className="vendor-portal-sidebar-icon">
                        <NavIcon name={section.icon} size={20} />
                      </span>
                      <span className="vendor-portal-sidebar-label">{section.label}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="vendor-portal-content">
                {activeSection === 'dashboard' && (
                  <VendorPortalDashboard vendor={{ ...(vendor || {}), ...(previewVendor || {}) }} />
                )}

                {activeSection === 'preview' && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Live Preview</h2>
                    <p className="text-sm text-gray-500 mb-4">This uses the real vendor directory card and detail layout, and updates as you edit your profile.</p>

                    <VendorDirectoryPreview vendor={{ ...(vendor || {}), ...(previewVendor || {}), media: vendor.media || [] }} />
                  </div>
                )}

                {activeSection === 'portfolio' && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Media Manager</h2>
                    <p className="text-sm text-gray-500 mb-4">Upload, organize, and fine-tune what couples see first.</p>

                    <VendorPortfolioManager
                      token={session.token}
                      vendor={{ ...(vendor || {}), ...(previewVendor || {}) }}
                      media={vendor.media || []}
                      onVendorUpdated={updatedVendor => {
                        setVendor(updatedVendor);
                        setPreviewVendor(updatedVendor);
                      }}
                    />
                  </div>
                )}

                {activeSection === 'details' && (
                  <div ref={profileEditorRef} className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Business Details</h2>
                    <p className="text-sm text-gray-500 mb-4">Update your contact information, locations, and category preferences anytime.</p>
                    <VendorBusinessProfileEditor
                      token={session.token}
                      vendor={vendor}
                      onVendorUpdated={updatedVendor => {
                        setVendor(updatedVendor);
                        setPreviewVendor(updatedVendor);
                      }}
                      onPreviewChange={setPreviewVendor}
                    />
                    {deleteError && (
                      <p className="mt-3 text-sm text-red-600">{deleteError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {vendor && (
        <div className="bottom-nav vendor-portal-mobile-nav">
          {VENDOR_PORTAL_SECTIONS.map(section => (
            <div
              key={section.id}
              className={`nav-item${activeSection===section.id ? " active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <div className="nav-icon"><NavIcon name={section.icon} /></div>
              <div className="nav-label">{section.label}</div>
              {activeSection===section.id && <div className="nav-active-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
