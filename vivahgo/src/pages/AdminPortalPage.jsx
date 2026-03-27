import { useEffect, useMemo, useState } from 'react';
import '../styles.css';
import GoogleLoginButton from '../components/GoogleLoginButton';
import LoadingBar from '../components/LoadingBar';
import {
  addAdminStaff,
  fetchAdminApplications,
  fetchAdminSubscribers,
  fetchAdminSession,
  fetchAdminStaff,
  fetchAdminVendors,
  loginWithGoogle,
  removeAdminStaff,
  updateAdminStaff,
  updateAdminVendorApproval,
} from '../api';

const SESSION_KEY = 'vivahgo.session';

function readSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return parsed.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function rolePillClass(role) {
  if (role === 'owner') return 'bg-emerald-100 text-emerald-700';
  if (role === 'editor') return 'bg-sky-100 text-sky-700';
  return 'bg-stone-200 text-stone-700';
}

function formatFileSize(value) {
  if (!value) {
    return '0 MB';
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminPortalPage() {
  const [session, setSession] = useState(() => readSession());
  const [adminUser, setAdminUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [applications, setApplications] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(Boolean(readSession()?.token));
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('viewer');
  const [staffActionError, setStaffActionError] = useState('');
  const [savingVendorId, setSavingVendorId] = useState('');
  const [savingStaffEmail, setSavingStaffEmail] = useState('');
  const [vendorNotesDraft, setVendorNotesDraft] = useState({});

  useEffect(() => {
    document.title = 'VivahGo | Admin';
  }, []);

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      setAdminUser(null);
      setAccess(null);
      setVendors([]);
      setApplications([]);
      setSubscribers([]);
      setStaff([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminSession(session.token)
      .then(async (data) => {
        if (cancelled) {
          return;
        }

        setAdminUser(data.user || null);
        setAccess(data.access || null);

        setVendorsLoading(true);
        const vendorsPromise = fetchAdminVendors(session.token)
          .then(result => {
            if (!cancelled) {
              setVendors(Array.isArray(result?.vendors) ? result.vendors : []);
            }
          })
          .finally(() => {
            if (!cancelled) {
              setVendorsLoading(false);
            }
          });

        setApplicationsLoading(true);
        const applicationsPromise = fetchAdminApplications(session.token)
          .then(result => {
            if (!cancelled) {
              setApplications(Array.isArray(result?.applications) ? result.applications : []);
            }
          })
          .finally(() => {
            if (!cancelled) {
              setApplicationsLoading(false);
            }
          });

        setSubscribersLoading(true);
        const subscribersPromise = fetchAdminSubscribers(session.token)
          .then(result => {
            if (!cancelled) {
              setSubscribers(Array.isArray(result?.subscribers) ? result.subscribers : []);
            }
          })
          .finally(() => {
            if (!cancelled) {
              setSubscribersLoading(false);
            }
          });

        const staffPromise = data.access?.canManageStaff
          ? fetchAdminStaff(session.token)
            .then(result => {
              if (!cancelled) {
                setStaff(Array.isArray(result?.staff) ? result.staff : []);
              }
            })
            .finally(() => {
              if (!cancelled) {
                setStaffLoading(false);
              }
            })
          : Promise.resolve();

        if (data.access?.canManageStaff && !cancelled) {
          setStaffLoading(true);
        } else if (!cancelled) {
          setStaff([]);
        }

        await Promise.all([vendorsPromise, applicationsPromise, subscribersPromise, staffPromise]);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setError(nextError.message || 'Could not load admin access.');
        setAdminUser(null);
        setAccess(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const counts = useMemo(() => ({
    total: vendors.length,
    pending: vendors.filter(vendor => !vendor.isApproved).length,
    approved: vendors.filter(vendor => vendor.isApproved).length,
  }), [vendors]);

  const applicationCounts = useMemo(() => ({
    total: applications.length,
    new: applications.filter(item => item.status === 'new').length,
  }), [applications]);

  const subscriberCounts = useMemo(() => ({
    total: subscribers.length,
    premium: subscribers.filter(item => item.subscriptionTier === 'premium').length,
    studio: subscribers.filter(item => item.subscriptionTier === 'studio').length,
  }), [subscribers]);

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
      setSession(newSession);
    } catch (nextError) {
      setError(nextError.message || 'Could not sign in.');
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  async function handleVendorApproval(vendorId, isApproved) {
    if (!session?.token) {
      return;
    }

    setSavingVendorId(vendorId);
    setError('');

    try {
      const result = await updateAdminVendorApproval(session.token, {
        vendorId,
        isApproved,
        verificationNotes: vendorNotesDraft[vendorId] ?? undefined,
      });
      setVendors(current => current.map(vendor => (
        vendor.id === vendorId
          ? { ...vendor, ...(result.vendor || {}), isApproved }
          : vendor
      )));
    } catch (nextError) {
      setError(nextError.message || 'Could not update vendor approval.');
    } finally {
      setSavingVendorId('');
    }
  }

  async function handleVendorVerification(vendorId, verificationStatus) {
    if (!session?.token) {
      return;
    }

    setSavingVendorId(vendorId);
    setError('');

    try {
      const result = await updateAdminVendorApproval(session.token, {
        vendorId,
        verificationStatus,
        verificationNotes: vendorNotesDraft[vendorId] ?? '',
      });
      setVendors(current => current.map(vendor => (
        vendor.id === vendorId
          ? { ...vendor, ...(result.vendor || {}), verificationStatus: result.vendor?.verificationStatus || verificationStatus }
          : vendor
      )));
    } catch (nextError) {
      setError(nextError.message || 'Could not update vendor verification.');
    } finally {
      setSavingVendorId('');
    }
  }

  async function refreshStaff() {
    if (!session?.token || !access?.canManageStaff) {
      return;
    }

    setStaffLoading(true);
    try {
      const result = await fetchAdminStaff(session.token);
      setStaff(Array.isArray(result?.staff) ? result.staff : []);
    } catch (nextError) {
      setStaffActionError(nextError.message || 'Could not refresh staff.');
    } finally {
      setStaffLoading(false);
    }
  }

  async function handleAddStaff(event) {
    event.preventDefault();
    if (!session?.token) {
      return;
    }

    setSavingStaffEmail(staffEmail);
    setStaffActionError('');

    try {
      await addAdminStaff(session.token, { email: staffEmail, staffRole });
      setStaffEmail('');
      setStaffRole('viewer');
      await refreshStaff();
    } catch (nextError) {
      setStaffActionError(nextError.message || 'Could not add staff member.');
    } finally {
      setSavingStaffEmail('');
    }
  }

  async function handleChangeStaffRole(email, nextRole) {
    if (!session?.token) {
      return;
    }

    setSavingStaffEmail(email);
    setStaffActionError('');

    try {
      await updateAdminStaff(session.token, { email, staffRole: nextRole });
      await refreshStaff();
    } catch (nextError) {
      setStaffActionError(nextError.message || 'Could not update staff role.');
    } finally {
      setSavingStaffEmail('');
    }
  }

  async function handleRemoveStaff(email) {
    if (!session?.token) {
      return;
    }

    setSavingStaffEmail(email);
    setStaffActionError('');

    try {
      await removeAdminStaff(session.token, email);
      await refreshStaff();
    } catch (nextError) {
      setStaffActionError(nextError.message || 'Could not remove staff access.');
    } finally {
      setSavingStaffEmail('');
    }
  }

  if (!session?.token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-rose-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-stone-200 p-8 max-w-md w-full">
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <img src="/Thumbnail.png" alt="VivahGo" className="h-12" />
            <h1 className="text-2xl font-bold text-stone-900">VivahGo Staff Admin</h1>
            <p className="text-sm text-stone-500">
              Sign in with an approved staff account to review vendors and manage staff permissions.
            </p>
          </div>
          <GoogleLoginButton onLoginSuccess={handleLoginSuccess} onLoginError={() => setError('Google login failed.')} />
          {isSigningIn && (
            <div className="mt-4">
              <LoadingBar label="Signing you in with Google..." compact />
            </div>
          )}
          {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
          <div className="mt-4 text-center">
            <a href="/home" className="text-sm text-rose-600 hover:underline">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-rose-50 flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <p className="text-sm text-stone-500">Loading staff console...</p>
          <LoadingBar className="mt-4" />
        </div>
      </div>
    );
  }

  if (!access?.canViewAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-rose-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-stone-200 p-8 max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-stone-900">Access denied</h1>
          <p className="mt-3 text-sm text-stone-600">
            {adminUser?.email || session.user?.email || 'This account'} is not approved for VivahGo staff admin.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <button type="button" className="login-secondary-btn" onClick={handleLogout}>Logout</button>
            <a href="/home" className="text-sm text-rose-600 hover:underline">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-white to-rose-50">
      <header className="bg-white/90 backdrop-blur border-b border-stone-200 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">VivahGo Staff</p>
            <h1 className="text-2xl font-bold text-stone-900">Admin Console</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${rolePillClass(access.role)}`}>
              {access.role}
            </span>
            <span className="text-sm text-stone-500">{adminUser?.email || session.user?.email}</span>
            <a href="/home" className="text-sm text-rose-600 hover:underline">Home</a>
            <button type="button" className="login-secondary-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
            <p className="text-sm text-stone-500">Total vendors</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{counts.total}</p>
          </div>
          <div className="bg-white rounded-3xl border border-amber-200 p-5 shadow-sm">
            <p className="text-sm text-amber-700">Pending approval</p>
            <p className="mt-2 text-3xl font-bold text-amber-900">{counts.pending}</p>
          </div>
          <div className="bg-white rounded-3xl border border-emerald-200 p-5 shadow-sm">
            <p className="text-sm text-emerald-700">Approved vendors</p>
            <p className="mt-2 text-3xl font-bold text-emerald-900">{counts.approved}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
            <p className="text-sm text-stone-500">Applications</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{applicationCounts.total}</p>
          </div>
          <div className="bg-white rounded-3xl border border-rose-200 p-5 shadow-sm">
            <p className="text-sm text-rose-700">New resumes</p>
            <p className="mt-2 text-3xl font-bold text-rose-900">{applicationCounts.new}</p>
          </div>
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
            <p className="text-sm text-stone-500">Latest applicant</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{applications[0]?.fullName || 'No applications yet'}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
            <p className="text-sm text-stone-500">Subscribers</p>
            <p className="mt-2 text-3xl font-bold text-stone-900">{subscriberCounts.total}</p>
          </div>
          <div className="bg-white rounded-3xl border border-sky-200 p-5 shadow-sm">
            <p className="text-sm text-sky-700">Premium</p>
            <p className="mt-2 text-3xl font-bold text-sky-900">{subscriberCounts.premium}</p>
          </div>
          <div className="bg-white rounded-3xl border border-violet-200 p-5 shadow-sm">
            <p className="text-sm text-violet-700">Studio</p>
            <p className="mt-2 text-3xl font-bold text-violet-900">{subscriberCounts.studio}</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Vendor approvals</h2>
            <p className="text-sm text-stone-500">Editors and owners can approve vendors. Viewers can audit the queue.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {vendorsLoading && (
              <div className="px-5 py-10 text-sm text-stone-500">Loading vendors...</div>
            )}
            {!vendorsLoading && vendors.length === 0 && (
              <div className="px-5 py-10 text-sm text-stone-500">No vendors found yet.</div>
            )}
            {!vendorsLoading && vendors.map(vendor => (
              <div key={vendor.id} className="px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-stone-900">{vendor.businessName}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${vendor.isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {vendor.isApproved ? 'Approved' : 'Pending'}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2.5 py-1 text-xs font-medium">
                      {vendor.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ') || 'Location not set'}
                  </p>
                  {vendor.description && (
                    <p className="mt-2 text-sm text-stone-700">{vendor.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
                    <span>Media: {vendor.mediaCount || 0}</span>
                    <span>Verification docs: {vendor.verificationDocumentCount || 0}</span>
                    <span>Joined: {formatDate(vendor.createdAt)}</span>
                    {vendor.phone && <span>Phone: {vendor.phone}</span>}
                    {vendor.website && <span>Website: {vendor.website}</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      vendor.verificationStatus === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : vendor.verificationStatus === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : vendor.verificationStatus === 'submitted'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-stone-100 text-stone-700'
                    }`}>
                      Verification: {vendor.verificationStatus || 'not_submitted'}
                    </span>
                    {Array.isArray(vendor.verificationDocuments) && vendor.verificationDocuments.map(document => (
                      <span key={document._id || document.key} className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                        {document.documentType || 'OTHER'}
                      </span>
                    ))}
                  </div>
                  {Array.isArray(vendor.verificationDocuments) && vendor.verificationDocuments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {vendor.verificationDocuments.map(document => (
                        <a
                          key={`${document._id || document.key}_preview`}
                          href={document.accessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-rose-600 hover:underline"
                        >
                          Open {document.documentType || 'document'}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Verification notes</span>
                      <textarea
                        value={vendorNotesDraft[vendor.id] ?? vendor.verificationNotes ?? ''}
                        onChange={event => setVendorNotesDraft(current => ({ ...current, [vendor.id]: event.target.value }))}
                        rows={3}
                        className="w-full rounded-2xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-rose-300"
                        placeholder="Add reviewer notes for the vendor"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={() => handleVendorVerification(vendor.id, 'approved')}
                    disabled={!access.canManageVendors || savingVendorId === vendor.id || !vendor.verificationDocumentCount}
                  >
                    Verify Docs
                  </button>
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={() => handleVendorVerification(vendor.id, 'rejected')}
                    disabled={!access.canManageVendors || savingVendorId === vendor.id || !vendor.verificationDocumentCount}
                  >
                    Reject Docs
                  </button>
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={() => handleVendorApproval(vendor.id, true)}
                    disabled={!access.canManageVendors || savingVendorId === vendor.id || vendor.isApproved}
                  >
                    {savingVendorId === vendor.id && !vendor.isApproved ? 'Saving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={() => handleVendorApproval(vendor.id, false)}
                    disabled={!access.canManageVendors || savingVendorId === vendor.id || !vendor.isApproved}
                  >
                    {savingVendorId === vendor.id && vendor.isApproved ? 'Saving...' : 'Move to Pending'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Subscribers</h2>
            <p className="text-sm text-stone-500">Track active premium/studio customers, zero-rupee coupon activations, and latest receipt delivery status.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {subscribersLoading && (
              <div className="px-5 py-10 text-sm text-stone-500">Loading subscribers...</div>
            )}
            {!subscribersLoading && subscribers.length === 0 && (
              <div className="px-5 py-10 text-sm text-stone-500">No subscribers found yet.</div>
            )}
            {!subscribersLoading && subscribers.map(subscriber => (
              <div key={subscriber.id} className="px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-stone-900">{subscriber.name || subscriber.email}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${subscriber.subscriptionTier === 'studio' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                      {subscriber.subscriptionTier}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${subscriber.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'}`}>
                      {subscriber.subscriptionStatus}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">{subscriber.email}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
                    <span>Valid until: {formatDate(subscriber.subscriptionCurrentPeriodEnd)}</span>
                    {subscriber.latestReceipt?.receiptNumber && <span>Receipt: {subscriber.latestReceipt.receiptNumber}</span>}
                    {subscriber.latestReceipt?.couponCode && <span>Coupon: {subscriber.latestReceipt.couponCode}</span>}
                    {subscriber.latestReceipt && <span>Amount: INR {(Number(subscriber.latestReceipt.amount || 0) / 100).toFixed(2)}</span>}
                  </div>
                </div>
                <div className="text-sm text-stone-500 lg:text-right">
                  <p>Email receipt: <span className="font-medium text-stone-700">{subscriber.latestReceipt?.emailDeliveryStatus || 'not sent'}</span></p>
                  {subscriber.latestReceipt?.paymentProvider && <p className="mt-1">Provider: {subscriber.latestReceipt.paymentProvider}</p>}
                  {subscriber.latestReceipt?.issuedAt && <p className="mt-1">Issued: {formatDate(subscriber.latestReceipt.issuedAt)}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Career applications</h2>
            <p className="text-sm text-stone-500">Resumes are stored in Google Drive and linked here for staff review.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {applicationsLoading && (
              <div className="px-5 py-10 text-sm text-stone-500">Loading applications...</div>
            )}
            {!applicationsLoading && applications.length === 0 && (
              <div className="px-5 py-10 text-sm text-stone-500">No applications submitted yet.</div>
            )}
            {!applicationsLoading && applications.map(application => (
              <div key={application.id} className="px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-stone-900">{application.fullName}</h3>
                    <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2.5 py-1 text-xs font-medium">
                      {application.jobTitle}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 px-2.5 py-1 text-xs font-semibold">
                      {application.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">{application.email}{application.phone ? ` | ${application.phone}` : ''}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
                    <span>Applied: {formatDate(application.createdAt)}</span>
                    {application.location && <span>Location: {application.location}</span>}
                    <span>Resume: {formatFileSize(application.resumeSize)}</span>
                  </div>
                  {application.coverLetter && (
                    <p className="mt-3 text-sm text-stone-700 whitespace-pre-line">{application.coverLetter}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {application.linkedInUrl && <a href={application.linkedInUrl} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">LinkedIn</a>}
                    {application.portfolioUrl && <a href={application.portfolioUrl} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">Portfolio</a>}
                    {application.resumeDriveViewUrl && <a href={application.resumeDriveViewUrl} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">Open resume</a>}
                    {application.resumeDriveDownloadUrl && <a href={application.resumeDriveDownloadUrl} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">Download PDF</a>}
                  </div>
                </div>
                <div className="text-xs text-stone-400 lg:text-right">
                  <p>Drive file</p>
                  <p className="mt-1 break-all">{application.resumeDriveFileName || application.resumeOriginalFileName || 'Resume PDF'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {access.canManageStaff && (
          <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-lg font-semibold text-stone-900">Staff permissions</h2>
              <p className="text-sm text-stone-500">The bootstrap owner can grant `editor` or `viewer` access to signed-in staff accounts.</p>
            </div>
            <div className="p-5 border-b border-stone-100">
              <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]" onSubmit={handleAddStaff}>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={event => setStaffEmail(event.target.value)}
                  placeholder="staff@vivahgo.com"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-400"
                />
                <select
                  value={staffRole}
                  onChange={event => setStaffRole(event.target.value)}
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-400"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="submit"
                  className="login-secondary-btn"
                  disabled={!staffEmail.trim() || Boolean(savingStaffEmail)}
                >
                  {savingStaffEmail === staffEmail ? 'Adding...' : 'Grant access'}
                </button>
              </form>
              {staffActionError && <p className="mt-3 text-sm text-red-600">{staffActionError}</p>}
            </div>
            <div className="divide-y divide-stone-100">
              {staffLoading && <div className="px-5 py-8 text-sm text-stone-500">Loading staff...</div>}
              {!staffLoading && staff.length === 0 && <div className="px-5 py-8 text-sm text-stone-500">No staff members found.</div>}
              {!staffLoading && staff.map(member => (
                <div key={member.email} className="px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-900">{member.name || member.email}</p>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${rolePillClass(member.staffRole)}`}>
                        {member.staffRole}
                      </span>
                      {member.isBootstrapOwner && (
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                          bootstrap owner
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-500">{member.email}</p>
                    <p className="mt-1 text-xs text-stone-400">Granted: {formatDate(member.staffGrantedAt)}</p>
                  </div>
                  {!member.isBootstrapOwner && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={member.staffRole}
                        onChange={event => handleChangeStaffRole(member.email, event.target.value)}
                        className="rounded-2xl border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-rose-400"
                        disabled={savingStaffEmail === member.email}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        type="button"
                        className="login-secondary-btn"
                        onClick={() => handleRemoveStaff(member.email)}
                        disabled={savingStaffEmail === member.email}
                      >
                        {savingStaffEmail === member.email ? 'Saving...' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
