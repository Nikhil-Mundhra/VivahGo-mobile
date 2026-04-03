import { useEffect, useMemo, useState } from 'react';
import '../../../vendor.css';
import '../../../styles.css';
import GoogleLoginButton from '../../../components/GoogleLoginButton';
import LoadingBar from '../../../components/LoadingBar';
import NavIcon from '../../../components/NavIcon';
import AdminChoiceProfilesPanel from '../components/AdminChoiceProfilesPanel';
import { clearAuthStorage, persistAuthSession, readAuthSession } from '../../../authStorage';
import {
  addAdminStaff,
  fetchAdminApplications,
  fetchAdminResumeAccessUrl,
  fetchAdminSubscribers,
  fetchAdminSession,
  fetchAdminStaff,
  fetchAdminVendors,
  rejectAdminCareerApplication,
  removeAdminStaff,
  saveAdminCareerRejectionTemplate,
  updateAdminStaff,
  updateAdminVendorApproval,
} from '../api.js';
import { loginWithGoogle, logoutSession } from '../../auth/api.js';
import { getMarketingUrl } from '../../../siteUrls.js';

const MARKETING_HOME_URL = getMarketingUrl('/');
const ADMIN_SECTION_PATHS = {
  vendors: '/admin/vendors',
  choice: '/admin/vendors/choice',
  subscribers: '/admin/subscribers',
  applications: '/admin/applications',
  staff: '/admin/staff',
};

const ADMIN_PORTAL_SECTIONS = [
  {
    id: 'vendors',
    label: 'Vendor Approvals',
    mobileLabel: 'Vendors',
    icon: 'vendors',
    description: 'Review verification documents, approval state, and internal notes for vendor listings.',
  },
  {
    id: 'choice',
    label: 'Choice',
    mobileLabel: 'Choice',
    icon: 'vendors',
    description: "Curate VivahGo's Choice profiles from approved vendor assets, aggregated values, and lead details.",
  },
  {
    id: 'subscribers',
    label: 'Subscribers',
    mobileLabel: 'Billing',
    icon: 'budget',
    description: 'Track premium and studio customers, receipt delivery, and renewal timing.',
  },
  {
    id: 'applications',
    label: 'Career Applications',
    mobileLabel: 'Careers',
    icon: 'tasks',
    description: 'Review resumes, outbound links, and incoming hiring activity from the careers page.',
  },
  {
    id: 'staff',
    label: 'Staff Permissions',
    mobileLabel: 'Staff',
    icon: 'guests',
    description: 'Grant editor or viewer access to signed-in staff accounts and keep admin permissions tidy.',
    requiresOwner: true,
  },
];

function getAllowedAdminSections(canManageStaff = false) {
  return ADMIN_PORTAL_SECTIONS.filter(section => !section.requiresOwner || canManageStaff);
}

function readAdminSectionFromPathname(pathname = '') {
  const normalizedPathname = String(pathname || '').replace(/\/+$/, '').toLowerCase();

  if (normalizedPathname === '/admin/vendors/choice' || normalizedPathname === '/admin/choice') {
    return 'choice';
  }
  if (normalizedPathname === '/admin/vendors') {
    return 'vendors';
  }
  if (normalizedPathname === '/admin/subscribers') {
    return 'subscribers';
  }
  if (normalizedPathname === '/admin/applications') {
    return 'applications';
  }
  if (normalizedPathname === '/admin/staff') {
    return 'staff';
  }

  return '';
}

function readAdminSectionFromLocation(win = typeof window !== 'undefined' ? window : undefined) {
  const sectionFromPath = readAdminSectionFromPathname(win?.location?.pathname || '');
  if (sectionFromPath) {
    return sectionFromPath;
  }

  return String(win?.location?.hash || '').replace(/^#/, '').trim().toLowerCase();
}

function normalizeAdminSectionId(value, canManageStaff = false) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const allowedSections = getAllowedAdminSections(canManageStaff);
  return allowedSections.some(section => section.id === normalizedValue)
    ? normalizedValue
    : (allowedSections[0]?.id || 'vendors');
}

function writeAdminSectionToLocation(sectionId, options = {}) {
  const { replace = false, win = typeof window !== 'undefined' ? window : undefined } = options;
  if (!win?.location) {
    return;
  }

  const nextPath = ADMIN_SECTION_PATHS[sectionId] || '/admin';
  const nextUrl = `${nextPath}${win.location.search}`;

  if (replace && typeof win.history?.replaceState === 'function') {
    win.history.replaceState(null, '', nextUrl);
    return;
  }

  if (typeof win.history?.pushState === 'function') {
    win.history.pushState(null, '', nextUrl);
    return;
  }

  win.location.hash = sectionId;
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

function createEmptySectionErrors() {
  return {
    vendors: '',
    choice: '',
    applications: '',
    subscribers: '',
    staff: '',
  };
}

function createEmptyRejectionTemplate() {
  return {
    subject: '',
    body: '',
  };
}

export default function AdminPortalPage() {
  const [session, setSession] = useState(() => readAuthSession());
  const [activeSection, setActiveSection] = useState(() => normalizeAdminSectionId(readAdminSectionFromLocation()));
  const [adminUser, setAdminUser] = useState(null);
  const [access, setAccess] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [applications, setApplications] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(Boolean(readAuthSession()?.token));
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [error, setError] = useState('');
  const [sectionErrors, setSectionErrors] = useState(createEmptySectionErrors);
  const [rejectionEmailTemplate, setRejectionEmailTemplate] = useState(createEmptyRejectionTemplate);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('viewer');
  const [staffActionError, setStaffActionError] = useState('');
  const [applicationsActionError, setApplicationsActionError] = useState('');
  const [applicationsActionMessage, setApplicationsActionMessage] = useState('');
  const [savingRejectionTemplate, setSavingRejectionTemplate] = useState(false);
  const [rejectingApplicationId, setRejectingApplicationId] = useState('');
  const [openingResumeActionId, setOpeningResumeActionId] = useState('');
  const [savingVendorId, setSavingVendorId] = useState('');
  const [savingStaffEmail, setSavingStaffEmail] = useState('');
  const [vendorNotesDraft, setVendorNotesDraft] = useState({});

  function resetAdminState() {
    setAdminUser(null);
    setAccess(null);
    setVendors([]);
    setApplications([]);
    setSubscribers([]);
    setStaff([]);
    setLoading(false);
    setVendorsLoading(false);
    setApplicationsLoading(false);
    setSubscribersLoading(false);
    setStaffLoading(false);
    setError('');
    setSectionErrors(createEmptySectionErrors());
    setRejectionEmailTemplate(createEmptyRejectionTemplate());
    setIsSigningIn(false);
    setStaffEmail('');
    setStaffRole('viewer');
    setStaffActionError('');
    setApplicationsActionError('');
    setApplicationsActionMessage('');
    setSavingRejectionTemplate(false);
    setRejectingApplicationId('');
    setOpeningResumeActionId('');
    setSavingVendorId('');
    setSavingStaffEmail('');
    setVendorNotesDraft({});
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncActiveSectionFromLocation = () => {
      const requestedSection = readAdminSectionFromLocation(window);
      const nextSection = normalizeAdminSectionId(requestedSection, Boolean(access?.canManageStaff));

      if (requestedSection && requestedSection !== nextSection) {
        writeAdminSectionToLocation(nextSection, { replace: true, win: window });
      }

      setActiveSection(current => current === nextSection ? current : nextSection);
    };

    syncActiveSectionFromLocation();
    window.addEventListener('hashchange', syncActiveSectionFromLocation);
    window.addEventListener('popstate', syncActiveSectionFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncActiveSectionFromLocation);
      window.removeEventListener('popstate', syncActiveSectionFromLocation);
    };
  }, [access?.canManageStaff]);

  useEffect(() => {
    if (!session?.token) {
      resetAdminState();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setSectionErrors(createEmptySectionErrors());

    fetchAdminSession(session.token)
      .then(async (data) => {
        if (cancelled) {
          return;
        }

        setAdminUser(data.user || null);
        setAccess(data.access || null);

        const captureSectionError = (key, nextError, fallbackMessage) => {
          if (cancelled) {
            return;
          }

          setSectionErrors(current => ({
            ...current,
            [key]: nextError?.message || fallbackMessage,
          }));
        };

        setVendorsLoading(true);
        const vendorsPromise = fetchAdminVendors(session.token)
          .then(result => {
            if (!cancelled) {
              setVendors(Array.isArray(result?.vendors) ? result.vendors : []);
            }
          })
          .catch(nextError => {
            if (!cancelled) {
              setVendors([]);
            }
            captureSectionError('vendors', nextError, 'Could not load vendors.');
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
              setRejectionEmailTemplate({
                subject: result?.rejectionEmailTemplate?.subject || '',
                body: result?.rejectionEmailTemplate?.body || '',
              });
            }
          })
          .catch(nextError => {
            if (!cancelled) {
              setApplications([]);
              setRejectionEmailTemplate(createEmptyRejectionTemplate());
            }
            captureSectionError('applications', nextError, 'Could not load applications.');
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
          .catch(nextError => {
            if (!cancelled) {
              setSubscribers([]);
            }
            captureSectionError('subscribers', nextError, 'Could not load subscribers.');
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
            .catch(nextError => {
              if (!cancelled) {
                setStaff([]);
              }
              captureSectionError('staff', nextError, 'Could not load staff.');
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

        await Promise.allSettled([vendorsPromise, applicationsPromise, subscribersPromise, staffPromise]);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        if (nextError.message && /Authentication required|Session expired/i.test(nextError.message)) {
          clearAuthStorage('admin');
          setSession(null);
          resetAdminState();
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
  const staffCounts = useMemo(() => ({
    total: staff.length,
    owners: staff.filter(item => item.staffRole === 'owner').length,
    editors: staff.filter(item => item.staffRole === 'editor').length,
    viewers: staff.filter(item => item.staffRole === 'viewer').length,
  }), [staff]);
  const adminSections = useMemo(
    () => getAllowedAdminSections(Boolean(access?.canManageStaff)),
    [access?.canManageStaff]
  );
  const currentSection = adminSections.find(section => section.id === activeSection) || adminSections[0] || ADMIN_PORTAL_SECTIONS[0];
  const activeSectionId = currentSection?.id || 'vendors';
  const isExplicitAccessDenied = !loading && !access && /Staff access required/i.test(error);
  const isAdminAccessLoadFailure = !loading && !access && Boolean(error) && !isExplicitAccessDenied;
  const canManageApplications = access?.role === 'editor' || access?.role === 'owner';

  useEffect(() => {
    document.title = currentSection?.label
      ? `VivahGo | Admin | ${currentSection.label}`
      : 'VivahGo | Admin';
  }, [currentSection?.label]);

  async function handleLoginSuccess(credentialResponse) {
    setIsSigningIn(true);
    try {
      const data = await loginWithGoogle(credentialResponse.credential);
      const newSession = persistAuthSession({
        mode: 'google',
        user: data.user,
        plannerOwnerId: data.plannerOwnerId || data.user?.id || '',
      });
      setSession(newSession);
    } catch (nextError) {
      setError(nextError.message || 'Could not sign in.');
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutSession(session?.token);
    } catch {
      // Best effort only.
    }
    clearAuthStorage('admin');
    setSession(null);
    resetAdminState();
  }

  function handleSectionSelect(sectionId) {
    const nextSection = normalizeAdminSectionId(sectionId, Boolean(access?.canManageStaff));
    setActiveSection(nextSection);
    writeAdminSectionToLocation(nextSection);
  }

  async function handleVendorApproval(vendorId, vendorGoogleId, isApproved) {
    if (!session?.token) {
      return;
    }

    setSavingVendorId(vendorId);
    setError('');

    try {
      const result = await updateAdminVendorApproval(session.token, {
        vendorId,
        vendorGoogleId,
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

  async function handleVendorVerification(vendorId, vendorGoogleId, verificationStatus) {
    if (!session?.token) {
      return;
    }

    setSavingVendorId(vendorId);
    setError('');

    try {
      const result = await updateAdminVendorApproval(session.token, {
        vendorId,
        vendorGoogleId,
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

  async function handleVendorTier(vendorId, vendorGoogleId, tier) {
    if (!session?.token) {
      return;
    }

    setSavingVendorId(vendorId);
    setError('');

    try {
      const result = await updateAdminVendorApproval(session.token, {
        vendorId,
        vendorGoogleId,
        tier,
        verificationNotes: vendorNotesDraft[vendorId] ?? undefined,
      });
      setVendors(current => current.map(vendor => (
        vendor.id === vendorId
          ? { ...vendor, ...(result.vendor || {}), tier: result.vendor?.tier || tier }
          : vendor
      )));
    } catch (nextError) {
      setError(nextError.message || 'Could not update vendor tier.');
    } finally {
      setSavingVendorId('');
    }
  }

  function handleRejectionTemplateChange(field, value) {
    setRejectionEmailTemplate(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveRejectionTemplate() {
    if (!session?.token) {
      return;
    }

    setSavingRejectionTemplate(true);
    setApplicationsActionError('');
    setApplicationsActionMessage('');

    try {
      const result = await saveAdminCareerRejectionTemplate(session.token, rejectionEmailTemplate);
      const nextTemplate = {
        subject: result?.rejectionEmailTemplate?.subject || '',
        body: result?.rejectionEmailTemplate?.body || '',
      };
      setRejectionEmailTemplate(nextTemplate);
      setApplicationsActionMessage('Rejection email draft saved.');
    } catch (nextError) {
      setApplicationsActionError(nextError.message || 'Could not save rejection email draft.');
    } finally {
      setSavingRejectionTemplate(false);
    }
  }

  async function handleRejectApplication(application) {
    if (!session?.token || !application?.id) {
      return;
    }

    const shouldContinue = typeof window === 'undefined' || typeof window.confirm !== 'function'
      ? true
      : window.confirm(`Reject ${application.fullName || 'this application'}? This will email the applicant and permanently delete the stored resume PDF.`);

    if (!shouldContinue) {
      return;
    }

    setRejectingApplicationId(application.id);
    setApplicationsActionError('');
    setApplicationsActionMessage('');

    try {
      const result = await rejectAdminCareerApplication(session.token, {
        applicationId: application.id,
        subject: rejectionEmailTemplate.subject,
        body: rejectionEmailTemplate.body,
      });
      const nextTemplate = {
        subject: result?.rejectionEmailTemplate?.subject || '',
        body: result?.rejectionEmailTemplate?.body || '',
      };
      setRejectionEmailTemplate(nextTemplate);
      setApplications(current => current.map(item => (
        item.id === application.id
          ? { ...item, ...(result?.application || {}) }
          : item
      )));
      setApplicationsActionMessage(`Rejected ${application.fullName || 'the application'} and removed the stored resume.`);
    } catch (nextError) {
      setApplicationsActionError(nextError.message || 'Could not reject application.');
    } finally {
      setRejectingApplicationId('');
    }
  }

  async function handleResumeAccess(application, mode = 'download') {
    if (!session?.token || !application?.resumeFileId) {
      return;
    }

    const actionId = `${application.id}:${mode}`;
    const popup = typeof window !== 'undefined'
      ? window.open('', '_blank', 'noopener,noreferrer')
      : null;

    setOpeningResumeActionId(actionId);
    setApplicationsActionError('');
    setApplicationsActionMessage('');

    try {
      const result = await fetchAdminResumeAccessUrl(session.token, {
        key: application.resumeFileId,
        filename: application.resumeOriginalFileName || application.resumeFileName || 'resume.pdf',
        mode,
      });

      const signedUrl = typeof result?.url === 'string' ? result.url : '';
      if (!signedUrl || typeof window === 'undefined') {
        if (popup && !popup.closed) {
          popup.close();
        }
        throw new Error(`Could not ${mode === 'preview' ? 'open' : 'download'} this resume right now.`);
      }

      if (popup && !popup.closed) {
        popup.location.replace(signedUrl);
      } else {
        window.location.assign(signedUrl);
      }
    } catch (nextError) {
      if (popup && !popup.closed) {
        popup.close();
      }
      setApplicationsActionError(nextError.message || `Could not ${mode === 'preview' ? 'open' : 'download'} this resume.`);
    } finally {
      setOpeningResumeActionId('');
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

  const sectionStatCards = activeSectionId === 'vendors'
    ? [
      {
        key: 'total-vendors',
        label: 'Total vendors',
        value: counts.total,
        cardClass: 'border-stone-200',
        labelClass: 'text-stone-500',
        valueClass: 'text-3xl font-bold text-stone-900',
      },
      {
        key: 'pending-vendors',
        label: 'Pending approval',
        value: counts.pending,
        cardClass: 'border-amber-200',
        labelClass: 'text-amber-700',
        valueClass: 'text-3xl font-bold text-amber-900',
      },
      {
        key: 'approved-vendors',
        label: 'Approved vendors',
        value: counts.approved,
        cardClass: 'border-emerald-200',
        labelClass: 'text-emerald-700',
        valueClass: 'text-3xl font-bold text-emerald-900',
      },
    ]
    : activeSectionId === 'choice'
      ? []
    : activeSectionId === 'subscribers'
      ? [
        {
          key: 'total-subscribers',
          label: 'Subscribers',
          value: subscriberCounts.total,
          cardClass: 'border-stone-200',
          labelClass: 'text-stone-500',
          valueClass: 'text-3xl font-bold text-stone-900',
        },
        {
          key: 'premium-subscribers',
          label: 'Premium',
          value: subscriberCounts.premium,
          cardClass: 'border-sky-200',
          labelClass: 'text-sky-700',
          valueClass: 'text-3xl font-bold text-sky-900',
        },
        {
          key: 'studio-subscribers',
          label: 'Studio',
          value: subscriberCounts.studio,
          cardClass: 'border-violet-200',
          labelClass: 'text-violet-700',
          valueClass: 'text-3xl font-bold text-violet-900',
        },
      ]
      : activeSectionId === 'applications'
        ? [
          {
            key: 'total-applications',
            label: 'Applications',
            value: applicationCounts.total,
            cardClass: 'border-stone-200',
            labelClass: 'text-stone-500',
            valueClass: 'text-3xl font-bold text-stone-900',
          },
          {
            key: 'new-applications',
            label: 'New resumes',
            value: applicationCounts.new,
            cardClass: 'border-rose-200',
            labelClass: 'text-rose-700',
            valueClass: 'text-3xl font-bold text-rose-900',
          },
          {
            key: 'latest-applicant',
            label: 'Latest applicant',
            value: applications[0]?.fullName || 'No applications yet',
            cardClass: 'border-stone-200',
            labelClass: 'text-stone-500',
            valueClass: 'text-lg font-semibold text-stone-900',
          },
        ]
        : [
          {
            key: 'staff-total',
            label: 'Staff members',
            value: staffCounts.total,
            cardClass: 'border-stone-200',
            labelClass: 'text-stone-500',
            valueClass: 'text-3xl font-bold text-stone-900',
          },
          {
            key: 'staff-editors',
            label: 'Editors',
            value: staffCounts.editors,
            cardClass: 'border-sky-200',
            labelClass: 'text-sky-700',
            valueClass: 'text-3xl font-bold text-sky-900',
          },
          {
            key: 'staff-viewers',
            label: 'Viewers',
            value: staffCounts.viewers,
            cardClass: 'border-emerald-200',
            labelClass: 'text-emerald-700',
            valueClass: 'text-3xl font-bold text-emerald-900',
          },
        ];

  const currentSectionPanel = activeSectionId === 'vendors'
    ? (
      <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">Vendor approvals</h2>
          <p className="text-sm text-stone-500">Editors and owners can approve vendors. Viewers can audit the queue.</p>
        </div>
        <div className="divide-y divide-stone-100">
          {sectionErrors.vendors && (
            <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
              {sectionErrors.vendors}
            </div>
          )}
          {vendorsLoading && (
            <div className="px-5 py-10 text-sm text-stone-500">Loading vendors...</div>
          )}
          {!vendorsLoading && !sectionErrors.vendors && vendors.length === 0 && (
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
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${vendor.tier === 'Plus' ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-700'}`}>
                    Tier: {vendor.tier || 'Free'}
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
                <select
                  value={vendor.tier || 'Free'}
                  onChange={event => handleVendorTier(vendor.id, vendor.googleId, event.target.value)}
                  className="rounded-2xl border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-rose-400"
                  disabled={!access.canManageVendors || savingVendorId === vendor.id}
                >
                  <option value="Free">Free</option>
                  <option value="Plus">Plus</option>
                </select>
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={() => handleVendorVerification(vendor.id, vendor.googleId, 'approved')}
                  disabled={!access.canManageVendors || savingVendorId === vendor.id || !vendor.verificationDocumentCount}
                >
                  Verify Docs
                </button>
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={() => handleVendorVerification(vendor.id, vendor.googleId, 'rejected')}
                  disabled={!access.canManageVendors || savingVendorId === vendor.id || !vendor.verificationDocumentCount}
                >
                  Reject Docs
                </button>
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={() => handleVendorApproval(vendor.id, vendor.googleId, true)}
                  disabled={!access.canManageVendors || savingVendorId === vendor.id || vendor.isApproved}
                >
                  {savingVendorId === vendor.id && !vendor.isApproved ? 'Saving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={() => handleVendorApproval(vendor.id, vendor.googleId, false)}
                  disabled={!access.canManageVendors || savingVendorId === vendor.id || !vendor.isApproved}
                >
                  {savingVendorId === vendor.id && vendor.isApproved ? 'Saving...' : 'Move to Pending'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
    : activeSectionId === 'choice'
      ? (
        <AdminChoiceProfilesPanel token={session?.token} access={access} vendors={vendors} />
      )
    : activeSectionId === 'subscribers'
      ? (
        <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-900">Subscribers</h2>
            <p className="text-sm text-stone-500">Track active premium and studio customers, coupon activations, and receipt delivery status.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {sectionErrors.subscribers && (
              <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
                {sectionErrors.subscribers}
              </div>
            )}
            {subscribersLoading && (
              <div className="px-5 py-10 text-sm text-stone-500">Loading subscribers...</div>
            )}
            {!subscribersLoading && !sectionErrors.subscribers && subscribers.length === 0 && (
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
      )
      : activeSectionId === 'applications'
        ? (
          <section className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-lg font-semibold text-stone-900">Career applications</h2>
              <p className="text-sm text-stone-500">Resumes are stored securely and linked here for staff review. Editors can save a rejection draft, email it, and remove the stored PDF in one action.</p>
            </div>
            <div className="divide-y divide-stone-100">
              {sectionErrors.applications && (
                <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
                  {sectionErrors.applications}
                </div>
              )}
              {applicationsLoading && (
                <div className="px-5 py-10 text-sm text-stone-500">Loading applications...</div>
              )}
              {!applicationsLoading && !sectionErrors.applications && applications.length === 0 && (
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
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        application.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : application.status === 'reviewed'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}>
                        {application.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">{application.email}{application.phone ? ` | ${application.phone}` : ''}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
                      <span>Applied: {formatDate(application.createdAt)}</span>
                      {application.location && <span>Location: {application.location}</span>}
                      <span>Resume: {formatFileSize(application.resumeSize)}</span>
                      {application.rejectedAt && <span>Rejected: {formatDate(application.rejectedAt)}</span>}
                    </div>
                    {application.coverLetter && (
                      <p className="mt-3 text-sm text-stone-700 whitespace-pre-line">{application.coverLetter}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {application.linkedInUrl && <a href={application.linkedInUrl} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">LinkedIn</a>}
                      {application.portfolioUrl && <a href={application.portfolioUrl} target="_blank" rel="noreferrer" className="text-rose-600 hover:underline">Portfolio</a>}
                      {application.resumeFileId && (
                        <button
                          type="button"
                          className="text-rose-600 hover:underline disabled:text-stone-400"
                          onClick={() => handleResumeAccess(application, 'preview')}
                          disabled={openingResumeActionId === `${application.id}:preview` || openingResumeActionId === `${application.id}:download`}
                        >
                          {openingResumeActionId === `${application.id}:preview` ? 'Opening PDF...' : 'Open PDF'}
                        </button>
                      )}
                      {application.resumeFileId && (
                        <button
                          type="button"
                          className="text-rose-600 hover:underline disabled:text-stone-400"
                          onClick={() => handleResumeAccess(application, 'download')}
                          disabled={openingResumeActionId === `${application.id}:preview` || openingResumeActionId === `${application.id}:download`}
                        >
                          {openingResumeActionId === `${application.id}:download` ? 'Preparing download...' : 'Download PDF'}
                        </button>
                      )}
                      {!application.resumeFileId && application.resumeDeletedAt && (
                        <span className="text-stone-500">Resume deleted after rejection on {formatDate(application.resumeDeletedAt)}</span>
                      )}
                    </div>
                    {application.rejectionEmailSubject && (
                      <p className="mt-3 text-xs text-stone-500">
                        Rejection email: <span className="font-medium text-stone-700">{application.rejectionEmailSubject}</span>
                        {application.rejectionEmailSentAt ? ` on ${formatDate(application.rejectionEmailSentAt)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-stone-400 lg:max-w-xs lg:text-right">
                    <p>Resume file</p>
                    <p className="mt-1 break-all">{application.resumeFileName || application.resumeOriginalFileName || (application.resumeDeletedAt ? 'Removed after rejection' : 'Resume PDF')}</p>
                    {application.rejectedBy && (
                      <p className="mt-2">Rejected by {application.rejectedBy}</p>
                    )}
                    {application.status !== 'rejected' && (
                      <button
                        type="button"
                        className="login-secondary-btn mt-3"
                        onClick={() => handleRejectApplication(application)}
                        disabled={!canManageApplications || rejectingApplicationId === application.id || savingRejectionTemplate}
                      >
                        {rejectingApplicationId === application.id ? 'Rejecting...' : 'Reject Application'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-5 border-t border-stone-100 bg-stone-50/60 space-y-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Rejection email draft</h3>
                  <p className="mt-1 text-sm text-stone-500">
                    Use <span className="font-mono text-xs text-stone-700">{'{{firstName}}'}</span>, <span className="font-mono text-xs text-stone-700">{'{{fullName}}'}</span>, <span className="font-mono text-xs text-stone-700">{'{{jobTitle}}'}</span>, or <span className="font-mono text-xs text-stone-700">{'{{email}}'}</span>.
                  </p>
                </div>
                {!canManageApplications && (
                  <span className="inline-flex items-center rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
                    Viewer access
                  </span>
                )}
              </div>

              {applicationsActionError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {applicationsActionError}
                </div>
              )}
              {applicationsActionMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {applicationsActionMessage}
                </div>
              )}

              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Subject</span>
                  <input
                    type="text"
                    value={rejectionEmailTemplate.subject}
                    onChange={event => handleRejectionTemplateChange('subject', event.target.value)}
                    disabled={!canManageApplications || savingRejectionTemplate || Boolean(rejectingApplicationId)}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300 disabled:bg-stone-100 disabled:text-stone-500"
                    placeholder="Update on your VivahGo application for {{jobTitle}}"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Body</span>
                  <textarea
                    value={rejectionEmailTemplate.body}
                    onChange={event => handleRejectionTemplateChange('body', event.target.value)}
                    rows={8}
                    disabled={!canManageApplications || savingRejectionTemplate || Boolean(rejectingApplicationId)}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none focus:border-rose-300 disabled:bg-stone-100 disabled:text-stone-500"
                    placeholder="Hi {{firstName}},"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="login-secondary-btn"
                  onClick={handleSaveRejectionTemplate}
                  disabled={!canManageApplications || savingRejectionTemplate || Boolean(rejectingApplicationId)}
                >
                  {savingRejectionTemplate ? 'Saving draft...' : 'Save draft'}
                </button>
                <p className="text-xs text-stone-500">The current draft is also used immediately when you reject an application.</p>
              </div>
            </div>
          </section>
        )
        : (
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
              {sectionErrors.staff && (
                <div className="px-5 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
                  {sectionErrors.staff}
                </div>
              )}
              {staffLoading && <div className="px-5 py-8 text-sm text-stone-500">Loading staff...</div>}
              {!staffLoading && !sectionErrors.staff && staff.length === 0 && <div className="px-5 py-8 text-sm text-stone-500">No staff members found.</div>}
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
        );

  if (!session?.token) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-header">
            <div className="login-logo">
              <img src="/Thumbnail.png" alt="VivahGo" className="login-logo-image" style={{ maxWidth: 140, margin: '0 auto' }} />
            </div>
            <h1 className="login-title">VivahGo Staff Admin</h1>
            <p className="login-subtitle">
              Sign in with an approved staff account to review vendors and manage staff permissions.
            </p>
          </div>

          <div className="login-content">
            <div className="login-actions">
              <div className="google-login-wrap">
                <GoogleLoginButton onLoginSuccess={handleLoginSuccess} onLoginError={() => setError('Google login failed.')} />
              </div>
            </div>
          </div>

          {isSigningIn && (
            <div className="login-status">
              <div>Signing you in with Google...</div>
              <LoadingBar label="Signing you in with Google..." compact />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <div className="login-home-section">
            <a href={MARKETING_HOME_URL} className="login-home-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Back to Home</a>
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

  if (isAdminAccessLoadFailure) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-header">
            <h1 className="login-title">Could not load admin access</h1>
            <p className="login-subtitle">
              {error || 'The admin console could not verify this session right now.'}
            </p>
          </div>

          <div className="login-actions">
            <button type="button" className="login-secondary-btn" onClick={handleLogout}>Logout</button>
            <a href={MARKETING_HOME_URL} className="login-home-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  if (!access?.canViewAdmin) {
    return (
      <div className="login-screen">
        <div className="login-container">
          <div className="login-header">
            <h1 className="login-title">Access denied</h1>
            <p className="login-subtitle">
            {adminUser?.email || session.user?.email || 'This account'} is not approved for VivahGo staff admin.
            </p>
          </div>

          <div className="login-actions">
            <button type="button" className="login-secondary-btn" onClick={handleLogout}>Logout</button>
            <a href={MARKETING_HOME_URL} className="login-home-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Back to Home</a>
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
            <a href={MARKETING_HOME_URL} className="text-sm text-rose-600 hover:underline">Home</a>
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

        <div className="vendor-portal-shell">
          <aside className="vendor-portal-sidebar">
            <div className="vendor-portal-sidebar-title">Admin Menu</div>
            <div className="vendor-portal-sidebar-nav">
              {adminSections.map(section => (
                <button
                  key={section.id}
                  type="button"
                  className={`vendor-portal-sidebar-item${activeSectionId === section.id ? ' active' : ''}`}
                  onClick={() => handleSectionSelect(section.id)}
                >
                  <span className="vendor-portal-sidebar-icon">
                    <NavIcon name={section.icon} size={20} />
                  </span>
                  <span className="vendor-portal-sidebar-label">{section.label}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="vendor-portal-content space-y-6">
            <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 text-rose-700 border border-rose-100">
                    <NavIcon name={currentSection.icon} size={22} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Admin Section</p>
                    <h2 className="mt-2 text-xl font-semibold text-stone-900">{currentSection.label}</h2>
                    <p className="mt-2 text-sm text-stone-500 max-w-2xl">{currentSection.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${rolePillClass(access.role)}`}>
                    {access.role}
                  </span>
                  {currentSection.requiresOwner && (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                      Owner only
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                    {adminUser?.email || session.user?.email}
                  </span>
                </div>
              </div>
            </section>

            {sectionStatCards.length > 0 && (
              <section className="grid gap-4 md:grid-cols-3">
                {sectionStatCards.map(card => (
                  <div key={card.key} className={`bg-white rounded-3xl border p-5 shadow-sm ${card.cardClass}`}>
                    <p className={`text-sm ${card.labelClass}`}>{card.label}</p>
                    <p className={`mt-2 ${card.valueClass}`}>{card.value}</p>
                  </div>
                ))}
              </section>
            )}

            {currentSectionPanel}
          </div>
        </div>
      </main>

      <div className="bottom-nav vendor-portal-mobile-nav">
        {adminSections.map(section => (
          <div
            key={section.id}
            className={`nav-item${activeSectionId === section.id ? ' active' : ''}`}
            onClick={() => handleSectionSelect(section.id)}
          >
            <div className="nav-icon"><NavIcon name={section.icon} /></div>
            <div className="nav-label">{section.mobileLabel}</div>
            {activeSectionId === section.id && <div className="nav-active-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
