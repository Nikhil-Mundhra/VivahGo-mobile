import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import '../../../vendor.css';
import '../../../styles.css';
import AuthOptionList from '../../../components/AuthOptionList';
import LoadingBar from '../../../components/LoadingBar';
import VendorRegistrationForm from '../components/VendorRegistrationForm';
import VendorPortfolioManager from '../components/VendorPortfolioManager';
import VendorDirectoryPreview from '../components/VendorDirectoryPreview';
import VendorBusinessProfileEditor from '../components/VendorBusinessProfileEditor';
import VendorPortalDashboard from '../components/VendorPortalDashboard';
import VendorAvailabilityManager from '../components/VendorAvailabilityManager';
import VendorSupportModal from '../components/VendorSupportModal';
import NavIcon from '../../../components/NavIcon';
import LegalFooter from '../../../components/LegalFooter';
import { clearAuthStorage, persistAuthSession, readAuthSession, revokeClerkSession, revokeGoogleIdTokenConsent } from '../../../authStorage';
import { deleteAccount, logoutSession, loginWithGoogle, loginWithClerk } from '../../auth/api.js';
import {
  fetchVendorProfile,
  registerVendor,
  updateVendorProfile,
  saveVendorMedia,
  updateVendorMedia,
  removeVendorMedia,
  saveVendorVerificationDocument,
  removeVendorVerificationDocument,
  vendorDirectoryQueryKey,
  vendorProfileQueryKey,
} from '../api.js';
import { buildLoginAuthOptions } from '../../../loginAuthOptions.js';
import { getMarketingUrl, getPlannerUrl } from '../../../siteUrls.js';
import {
  ackMutation,
  createVendorMutationJournal,
  enqueueMutation,
  failMutation,
  maybeRollback,
} from '../lib/vendorMutationManager.js';

const MARKETING_HOME_URL = getMarketingUrl('/');
const PLANNER_HOME_URL = getPlannerUrl('/');
const VENDOR_CONFLICT_CODE = 'VENDOR_CONFLICT';

const VENDOR_PORTAL_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'preview', label: 'Live Preview', icon: 'vendors' },
  { id: 'portfolio', label: 'Media Manager', icon: 'tasks' },
  { id: 'availability', label: 'Availability', icon: 'events' },
  { id: 'details', label: 'Business Details', icon: 'budget' },
];

function createCorrelationId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `vendor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createTempSubdocumentId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Math.random().toString(16).slice(2).padEnd(16, '0');
  return `${timestamp}${random}`.slice(0, 24);
}

function normalizeVendorRevision(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function sortVendorMediaItems(media) {
  return [...(Array.isArray(media) ? media : [])].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
}

export default function VendorPortalPage() {
  const queryClient = useQueryClient();
  const isClerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  const [session, setSession] = useState(() => readAuthSession());
  const [loginError, setLoginError] = useState('');
  const [vendor, setVendor] = useState(null);
  const [vendorRevision, setVendorRevision] = useState(0);
  const [vendorLoadError, setVendorLoadError] = useState('');
  const [previewVendor, setPreviewVendor] = useState(null);
  const [isPreviewDirty, setIsPreviewDirty] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const profileEditorRef = useRef(null);
  const currentVendorRef = useRef(null);
  const lastSyncedVendorRef = useRef(null);
  const lastDispatchedVendorRef = useRef(null);
  const vendorMutationJournalRef = useRef(createVendorMutationJournal(0));
  const accountFirstName = session?.user?.given_name || session?.user?.name?.split(' ')[0] || 'You';
  const profileInitial = accountFirstName.trim().charAt(0).toUpperCase() || 'Y';
  const mobileBenefitItems = [
    { icon: 'vendors', text: 'Register for free and publish your wedding services on VivahGo.' },
    { icon: 'tasks', text: 'Add portfolio photos, packages, and business details in one place.' },
    { icon: 'events', text: 'Keep your profile ready for upcoming wedding seasons and enquiries.' },
    { icon: 'guests', text: 'Build trust with a polished listing couples can review quickly.' },
  ];
  const desktopBenefitItems = [
    { icon: 'vendors', text: 'Register free and publish a professional vendor profile couples can discover on VivahGo.' },
    { icon: 'budget', text: 'Highlight services, coverage areas, and pricing so the right enquiries find you faster.' },
    { icon: 'tasks', text: 'Keep your portfolio fresh with photos that show your best work and style.' },
    { icon: 'events', text: 'Manage your listing anytime and stay ready for approval, discovery, and future bookings.' },
  ];
  const vendorQuery = useQuery({
    queryKey: vendorProfileQueryKey(),
    queryFn: async () => {
      try {
        return await fetchVendorProfile(session?.token || '');
      } catch (error) {
        if (error?.status === 404) {
          return { vendor: null, vendorRevision: 0 };
        }
        throw error;
      }
    },
    enabled: Boolean(session?.token),
    retry: false,
  });
  const loadingVendor = Boolean(session?.token) && vendorQuery.fetchStatus === 'fetching' && !vendor && !vendorLoadError;

  useEffect(() => {
    document.title = 'VivahGo | Vendor Portal';
  }, []);

  const syncVendorAuthority = useCallback((nextVendor, nextVendorRevision, options = {}) => {
    const normalizedVendor = nextVendor ? { ...nextVendor } : null;
    const normalizedRevision = normalizeVendorRevision(nextVendorRevision);

    lastSyncedVendorRef.current = normalizedVendor;
    setVendorRevision(normalizedRevision);

    if (options.resetJournal) {
      vendorMutationJournalRef.current = createVendorMutationJournal(normalizedRevision);
      lastDispatchedVendorRef.current = normalizedVendor;
    } else {
      vendorMutationJournalRef.current.latestAcknowledgedRevision = Math.max(
        vendorMutationJournalRef.current.latestAcknowledgedRevision,
        normalizedRevision
      );
      if (!vendorMutationJournalRef.current.pendingMutations.size) {
        lastDispatchedVendorRef.current = normalizedVendor;
      }
    }

    currentVendorRef.current = normalizedVendor;
    setVendor(normalizedVendor);
    if (options.syncPreview || (!isPreviewDirty && options.syncPreview !== false)) {
      setPreviewVendor(normalizedVendor);
      setIsPreviewDirty(false);
    }
    return normalizedVendor;
  }, [isPreviewDirty]);

  const applyOptimisticVendorState = useCallback((nextVendor, options = {}) => {
    const normalizedVendor = nextVendor ? { ...nextVendor } : null;
    currentVendorRef.current = normalizedVendor;
    setVendor(normalizedVendor);
    if (options.syncPreview) {
      setPreviewVendor(normalizedVendor);
      setIsPreviewDirty(false);
    }
    queryClient.setQueryData(vendorProfileQueryKey(), (current) => ({
      ...(current || {}),
      vendor: normalizedVendor,
      vendorRevision,
    }));
    return normalizedVendor;
  }, [queryClient, vendorRevision]);

  const vendorMutation = useMutation({
    mutationFn: async ({ buildOptimisticVendor, request, syncPreview = false }) => {
      const previousVendor = currentVendorRef.current;
      const optimisticVendor = buildOptimisticVendor(previousVendor);
      const mutation = enqueueMutation(vendorMutationJournalRef.current, {
        correlationId: createCorrelationId(),
        baseRevision: vendorMutationJournalRef.current.latestAcknowledgedRevision,
        nextVendor: optimisticVendor,
        previousVendor,
      });

      lastDispatchedVendorRef.current = optimisticVendor;
      applyOptimisticVendorState(optimisticVendor, { syncPreview });

      try {
        const response = await request(optimisticVendor, mutation);
        return { response, mutation, syncPreview };
      } catch (error) {
        error.vendorMutation = mutation;
        throw error;
      }
    },
    onSuccess: async ({ response, mutation, syncPreview }) => {
      ackMutation(vendorMutationJournalRef.current, {
        correlationId: mutation.correlationId,
        vendorRevision: response?.vendorRevision,
      });

      const normalizedVendor = syncVendorAuthority(response?.vendor, response?.vendorRevision, { syncPreview });
      queryClient.setQueryData(vendorProfileQueryKey(), {
        ...response,
        vendor: normalizedVendor,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: vendorProfileQueryKey() }),
        queryClient.invalidateQueries({ queryKey: vendorDirectoryQueryKey() }),
      ]);
    },
    onError: async (error) => {
      const failedMutation = failMutation(vendorMutationJournalRef.current, {
        correlationId: error?.vendorMutation?.correlationId,
      }) || error?.vendorMutation;

      if (error?.code === VENDOR_CONFLICT_CODE) {
        try {
          const latest = await queryClient.fetchQuery({
            queryKey: vendorProfileQueryKey(),
            queryFn: () => fetchVendorProfile(session?.token || ''),
          });
          syncVendorAuthority(latest?.vendor, latest?.vendorRevision, { resetJournal: true, syncPreview: true });
        } catch (refreshError) {
          console.error('Failed to refresh vendor after conflict:', refreshError);
        }
        return;
      }

      const rollbackDecision = maybeRollback(vendorMutationJournalRef.current, {
        mutation: failedMutation,
        currentVendor: currentVendorRef.current,
      });

      if (rollbackDecision.shouldRollback) {
        const rollbackVendor = syncVendorAuthority(
          rollbackDecision.rollbackVendor,
          vendorMutationJournalRef.current.latestAcknowledgedRevision,
          { syncPreview: true }
        );
        lastDispatchedVendorRef.current = rollbackVendor;
        currentVendorRef.current = rollbackVendor;
        queryClient.setQueryData(vendorProfileQueryKey(), (current) => ({
          ...(current || {}),
          vendor: rollbackVendor,
          vendorRevision: vendorMutationJournalRef.current.latestAcknowledgedRevision,
        }));
        return;
      }

      try {
        await queryClient.invalidateQueries({ queryKey: vendorProfileQueryKey() });
      } catch {}
    },
  });

  const runVendorMutation = useCallback(async (variables) => (
    vendorMutation.mutateAsync(variables)
  ), [vendorMutation]);

  useEffect(() => {
    if (!session?.token) {
      currentVendorRef.current = null;
      lastSyncedVendorRef.current = null;
      lastDispatchedVendorRef.current = null;
      vendorMutationJournalRef.current = createVendorMutationJournal(0);
      setVendor(null);
      setVendorRevision(0);
      setPreviewVendor(null);
      setIsPreviewDirty(false);
      setVendorLoadError('');
      return;
    }

    if (vendorQuery.data) {
      if (vendorMutationJournalRef.current.pendingMutations.size > 0) {
        return;
      }

      syncVendorAuthority(vendorQuery.data.vendor, vendorQuery.data.vendorRevision, {
        resetJournal: !lastSyncedVendorRef.current,
        syncPreview: !isPreviewDirty,
      });
      setVendorLoadError('');
    }
  }, [isPreviewDirty, session?.token, syncVendorAuthority, vendorQuery.data]);

  useEffect(() => {
    if (!vendorQuery.error) {
      return;
    }

    const error = vendorQuery.error;
    if (error?.message && /Authentication required|Session expired/i.test(error.message)) {
      clearAuthStorage('vendor');
      setSession(null);
      return;
    }

    if (error?.status === 404 || String(error?.message || '').includes('No vendor profile')) {
      setVendor(null);
      setVendorRevision(0);
      if (!isPreviewDirty) {
        setPreviewVendor(null);
      }
      setVendorLoadError('');
      return;
    }

    setVendorLoadError(error?.message || 'Could not load vendor profile.');
  }, [isPreviewDirty, vendorQuery.error]);

  async function handleLoginSuccess(credentialResponse) {
    setLoginError('');
    setIsSigningIn(true);
    try {
      const data = await loginWithGoogle(credentialResponse.credential);
      const newSession = persistAuthSession({
        mode: 'google',
        user: data.user,
        plannerOwnerId: data.plannerOwnerId || data.user?.id || '',
      });
      // Reset vendor state before the new session triggers a fresh fetch
      setVendor(null);
      setVendorRevision(0);
      setPreviewVendor(null);
      setIsPreviewDirty(false);
      setVendorLoadError('');
      setAvatarLoadError(false);
      setSession(newSession);
    } catch (error) {
      setLoginError(error?.message || 'Google login failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleClerkLoginSuccess(user, clerkToken) {
    setLoginError('');
    setIsSigningIn(true);
    try {
      const data = await loginWithClerk(clerkToken, user || {});
      const newSession = persistAuthSession({
        mode: 'clerk',
        user: data.user,
        plannerOwnerId: data.plannerOwnerId || data.user?.id || '',
      });
      // Reset vendor state before the new session triggers a fresh fetch
      setVendor(null);
      setVendorRevision(0);
      setPreviewVendor(null);
      setIsPreviewDirty(false);
      setVendorLoadError('');
      setAvatarLoadError(false);
      setSession(newSession);
    } catch (error) {
      setLoginError(error?.message || 'Sign in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  }

  const authOptions = buildLoginAuthOptions(
    {
      onGoogleLogin: handleLoginSuccess,
      onClerkLogin: handleClerkLoginSuccess,
      onLoginError: (error) => {
        setLoginError(error?.message || 'Sign in failed. Please try again.');
      },
      isLoggingIn: isSigningIn,
    },
    {
      isClerkEnabled,
      hiddenOptionIds: ['facebook'], // Do this to enable facebook: remove this line.
    }
  );

  async function handleLogout() {
    try {
      await logoutSession(session?.token);
    } catch {
      // Best effort only.
    }
    if (session?.mode === 'clerk') {
      await revokeClerkSession();
    }
    clearAuthStorage('vendor');
    setSession(null);
    setVendor(null);
    setVendorRevision(0);
    setPreviewVendor(null);
    setIsPreviewDirty(false);
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
      await revokeGoogleIdTokenConsent(session.user?.email);
      await handleLogout();
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

  function openSupportModal() {
    setShowSettingsMenu(false);
    setShowSupportModal(true);
  }

  const handlePreviewChange = useCallback((nextPreviewVendor) => {
    setPreviewVendor(nextPreviewVendor);
    setIsPreviewDirty(true);
  }, []);

  const handleRegisterVendor = useCallback(async (form) => {
    const result = await runVendorMutation({
      syncPreview: true,
      buildOptimisticVendor: () => ({
        businessName: form.businessName,
        type: form.type,
        subType: form.subType,
        bundledServices: [...(form.bundledServices || [])],
        description: form.description || '',
        country: form.country || '',
        state: form.state || '',
        city: form.city || '',
        googleMapsLink: form.googleMapsLink || '',
        coverageAreas: [...(form.coverageAreas || [])],
        phone: form.phone || '',
        website: form.website || '',
        budgetRange: form.budgetRange || null,
        availabilitySettings: {
          hasDefaultCapacity: true,
          defaultMaxCapacity: 1,
          dateOverrides: [],
        },
        media: [],
        verificationDocuments: [],
        verificationStatus: 'not_submitted',
        verificationNotes: '',
        verificationReviewedAt: null,
        verificationReviewedBy: '',
        isApproved: false,
        tier: 'Free',
      }),
      request: (_optimisticVendor, mutation) => registerVendor(session?.token || '', form, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleSaveVendorProfile = useCallback(async (payload) => {
    const result = await runVendorMutation({
      syncPreview: true,
      buildOptimisticVendor: (currentVendor) => ({
        ...(currentVendor || {}),
        ...payload,
        bundledServices: Array.isArray(payload?.bundledServices)
          ? [...payload.bundledServices]
          : [...(currentVendor?.bundledServices || [])],
        coverageAreas: Array.isArray(payload?.coverageAreas)
          ? [...payload.coverageAreas]
          : [...(currentVendor?.coverageAreas || [])],
        budgetRange: payload?.budgetRange || currentVendor?.budgetRange || null,
        availabilitySettings: payload?.availabilitySettings || currentVendor?.availabilitySettings || {
          hasDefaultCapacity: true,
          defaultMaxCapacity: 1,
          dateOverrides: [],
        },
      }),
      request: (_optimisticVendor, mutation) => updateVendorProfile(session?.token || '', payload, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleSaveVendorAvailability = useCallback(async (nextAvailability) => {
    const result = await runVendorMutation({
      buildOptimisticVendor: (currentVendor) => ({
        ...(currentVendor || {}),
        availabilitySettings: nextAvailability,
      }),
      request: (_optimisticVendor, mutation) => updateVendorProfile(
        session?.token || '',
        { availabilitySettings: nextAvailability },
        mutation
      ),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleSaveVendorMediaRecord = useCallback(async (payload) => {
    const tempMediaId = createTempSubdocumentId();
    const result = await runVendorMutation({
      buildOptimisticVendor: (currentVendor) => {
        const currentMedia = sortVendorMediaItems(currentVendor?.media);
        const nextSortOrder = typeof payload?.sortOrder === 'number'
          ? payload.sortOrder
          : currentMedia.reduce((highest, item, index) => Math.max(highest, item?.sortOrder ?? index), -1) + 1;
        const nextMedia = sortVendorMediaItems([
          ...currentMedia,
          {
            _id: tempMediaId,
            key: payload.key,
            url: payload.url || '',
            type: payload.type,
            sortOrder: nextSortOrder,
            filename: payload.filename || '',
            size: typeof payload.size === 'number' ? payload.size : 0,
            caption: payload.caption || '',
            altText: payload.altText || '',
            isVisible: payload.isVisible !== false,
            isCover: currentMedia.length === 0,
          },
        ]).map((item, index) => ({
          ...item,
          sortOrder: index,
          isCover: currentMedia.length === 0 ? index === 0 : Boolean(item.isCover),
        }));

        return {
          ...(currentVendor || {}),
          media: nextMedia,
        };
      },
      request: (_optimisticVendor, mutation) => saveVendorMedia(session?.token || '', payload, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleUpdateVendorMediaRecord = useCallback(async (payload) => {
    const result = await runVendorMutation({
      buildOptimisticVendor: (currentVendor) => {
        const currentMedia = sortVendorMediaItems(currentVendor?.media);

        if (Array.isArray(payload?.mediaIds)) {
          const mediaById = new Map(currentMedia.map((item) => [String(item?._id || ''), item]));
          return {
            ...(currentVendor || {}),
            media: payload.mediaIds
              .map((id, index) => {
                const item = mediaById.get(String(id || ''));
                return item ? { ...item, sortOrder: index } : null;
              })
              .filter(Boolean),
          };
        }

        return {
          ...(currentVendor || {}),
          media: currentMedia.map((item) => {
            if (String(item?._id || '') !== String(payload?.mediaId || '')) {
              return payload?.makeCover === true ? { ...item, isCover: false } : item;
            }

            return {
              ...item,
              caption: typeof payload?.caption === 'string' ? payload.caption : item.caption,
              altText: typeof payload?.altText === 'string' ? payload.altText : item.altText,
              isVisible: typeof payload?.isVisible === 'boolean' ? payload.isVisible : item.isVisible,
              isCover: payload?.makeCover === true ? true : item.isCover,
            };
          }),
        };
      },
      request: (_optimisticVendor, mutation) => updateVendorMedia(session?.token || '', payload, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleRemoveVendorMediaRecord = useCallback(async (mediaId) => {
    const result = await runVendorMutation({
      buildOptimisticVendor: (currentVendor) => {
        const remainingMedia = sortVendorMediaItems(currentVendor?.media)
          .filter((item) => String(item?._id || '') !== String(mediaId || ''))
          .map((item, index) => ({ ...item, sortOrder: index }));
        const hadCover = sortVendorMediaItems(currentVendor?.media).find((item) => String(item?._id || '') === String(mediaId || ''))?.isCover;

        if (hadCover && remainingMedia.length > 0) {
          remainingMedia[0] = { ...remainingMedia[0], isCover: true };
        }

        return {
          ...(currentVendor || {}),
          media: remainingMedia.map((item, index) => ({
            ...item,
            sortOrder: index,
            isCover: index === 0 ? Boolean(item.isCover) : Boolean(item.isCover),
          })),
        };
      },
      request: (_optimisticVendor, mutation) => removeVendorMedia(session?.token || '', mediaId, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleSaveVendorVerificationDocument = useCallback(async (payload) => {
    const tempDocumentId = createTempSubdocumentId();
    const result = await runVendorMutation({
      buildOptimisticVendor: (currentVendor) => ({
        ...(currentVendor || {}),
        verificationStatus: 'submitted',
        verificationReviewedAt: null,
        verificationReviewedBy: '',
        verificationDocuments: [
          ...(Array.isArray(currentVendor?.verificationDocuments) ? currentVendor.verificationDocuments : []),
          {
            _id: tempDocumentId,
            key: payload.key,
            filename: payload.filename || '',
            size: typeof payload.size === 'number' ? payload.size : 0,
            contentType: payload.contentType || '',
            documentType: payload.documentType || 'OTHER',
            uploadedAt: new Date().toISOString(),
            accessUrl: '',
          },
        ],
      }),
      request: (_optimisticVendor, mutation) => saveVendorVerificationDocument(session?.token || '', payload, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  const handleRemoveVendorVerificationDocument = useCallback(async (documentId) => {
    const result = await runVendorMutation({
      buildOptimisticVendor: (currentVendor) => {
        const nextDocuments = (Array.isArray(currentVendor?.verificationDocuments) ? currentVendor.verificationDocuments : [])
          .filter((item) => String(item?._id || '') !== String(documentId || ''));

        return {
          ...(currentVendor || {}),
          verificationDocuments: nextDocuments,
          verificationStatus: nextDocuments.length === 0 ? 'not_submitted' : (currentVendor?.verificationStatus === 'approved' ? 'submitted' : currentVendor?.verificationStatus),
          verificationNotes: nextDocuments.length === 0 ? '' : (currentVendor?.verificationNotes || ''),
          verificationReviewedAt: nextDocuments.length === 0 ? null : (currentVendor?.verificationReviewedAt || null),
          verificationReviewedBy: nextDocuments.length === 0 ? '' : (currentVendor?.verificationReviewedBy || ''),
        };
      },
      request: (_optimisticVendor, mutation) => removeVendorVerificationDocument(session?.token || '', documentId, mutation),
    });
    return result.response;
  }, [runVendorMutation, session?.token]);

  if (!session?.token) {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const showOauthHelp = /invalid_client|no registered origin|origin.*not.*allowed|idpiframe/i.test(loginError);

    return (
      <div className="login-screen planner-login-screen vendor-login-screen">
        <div className="login-container planner-login-container vendor-login-container">
          <div className="login-layout">
            <div className="login-hero">
              <div className="login-header">
                <div className="login-logo">
                  <a className="login-logo-mark" href={MARKETING_HOME_URL} aria-label="VivahGo home">
                    <img
                      className="login-logo-image login-logo-image-desktop"
                      src="/logo-no-background.png"
                      alt="VivahGo"
                      decoding="async"
                      fetchPriority="high"
                    />
                    <img
                      className="login-logo-image login-logo-image-mobile"
                      src="/logo-no-background.png"
                      alt="VivahGo"
                      decoding="async"
                      fetchPriority="high"
                    />
                  </a>
                </div>
                <p className="login-kicker">Vendor Workspace</p>
                <h1 className="login-title">Grow your wedding business with less friction.</h1>
              </div>
            </div>

            <div className="login-panel">
              <div className="login-panel-card">
                <div className="login-content">
                  <div className="login-panel-header">
                    <p className="login-panel-kicker">Sign in to VivahGo</p>
                    <h2 className="login-panel-title">Continue to your vendor portal</h2>
                    <p className="login-panel-subtitle">
                      Register free to publish your services, build a stronger vendor profile, and manage your portfolio from one place.
                    </p>
                  </div>

                  <div className="login-benefits-mobile">
                    {mobileBenefitItems.map((item) => (
                      <div className="benefit-item" key={`mobile-${item.icon}-${item.text}`}>
                        <span className="benefit-icon"><NavIcon name={item.icon} size={20} /></span>
                        <span className="benefit-text">{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <div className="login-divider login-home-divider login-divider-mobile">
                    <div className="divider-line"></div>
                    <span className="divider-text">Login</span>
                    <div className="divider-line"></div>
                  </div>

                  <div className="login-actions">
                    <AuthOptionList options={authOptions} />
                  </div>

                  <div className="login-home-section">
                    <div className="login-home-divider">
                      <div className="divider-line"></div>
                      <span className="divider-text">Other access</span>
                      <div className="divider-line"></div>
                    </div>
                    <button
                      className="login-home-btn"
                      type="button"
                      onClick={() => { window.location.href = MARKETING_HOME_URL; }}
                      disabled={isSigningIn}
                    >
                      Back to Home
                    </button>
                    <button
                      className="login-home-btn"
                      type="button"
                      onClick={() => { window.location.href = PLANNER_HOME_URL; }}
                      disabled={isSigningIn}
                      style={{ marginTop: 10 }}
                    >
                      Planner Login
                    </button>
                  </div>

                  {showOauthHelp && (
                    <div className="login-oauth-help">
                      Use a <strong>Web application</strong> OAuth client, then add <strong>{currentOrigin}</strong> to Authorized JavaScript origins. If you see <strong>invalid_client</strong> or <strong>no registered origin</strong>, the Google Cloud OAuth client is not configured for this frontend origin yet.
                    </div>
                  )}

                  {isSigningIn && (
                    <div className="login-status">
                      <div>Signing you in and loading your vendor portal...</div>
                      <LoadingBar compact className="login-status-loading-bar" />
                    </div>
                  )}
                  {loginError && <div className="login-error">{loginError}</div>}

                  <div className="login-footer login-footer-mobile">
                    <p className="login-footer-text">Free vendor registration on VivahGo. Sign in to publish, update, and grow your presence.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="login-support">
              <div className="login-benefits">
                {desktopBenefitItems.map((item) => (
                  <div className="benefit-item" key={`desktop-${item.icon}-${item.text}`}>
                    <span className="benefit-icon"><NavIcon name={item.icon} size={20} /></span>
                    <span className="benefit-text">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
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
          <a
            href={MARKETING_HOME_URL}
            className="text-sm font-medium text-gray-700 no-underline transition hover:text-rose-700"
          >
            Home
          </a>
          <div className="flex flex-col items-start gap-2 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between sm:justify-end">
            <div className="relative">
              <button
                type="button"
                className="vendor-planner-pill"
                onClick={() => setShowSettingsMenu(current => !current)}
              >
                <span className="vendor-planner-pill-text">Account & Settings</span>
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
              </button>
              {showSettingsMenu && (
                <div className="vendor-settings-menu">
                  <button type="button" className="vendor-settings-menu-item" onClick={focusUserPreferences}>
                    User Preferences
                  </button>
                  <button type="button" className="vendor-settings-menu-item" onClick={openSupportModal}>
                    Contact Support
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
          </div>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 sm:py-8">
        {!vendor ? (
          <VendorRegistrationForm
            token={session.token}
            onRegisterVendor={handleRegisterVendor}
            onRegistered={registeredVendor => {
              setVendor(registeredVendor);
              setPreviewVendor(registeredVendor);
              setIsPreviewDirty(false);
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
                      onSaveVendorMediaRecord={handleSaveVendorMediaRecord}
                      onUpdateVendorMediaRecord={handleUpdateVendorMediaRecord}
                      onRemoveVendorMediaRecord={handleRemoveVendorMediaRecord}
                      onSaveVendorVerificationDocument={handleSaveVendorVerificationDocument}
                      onRemoveVendorVerificationDocument={handleRemoveVendorVerificationDocument}
                      onVendorUpdated={updatedVendor => {
                        setVendor(updatedVendor);
                        if (!isPreviewDirty) {
                          setPreviewVendor(updatedVendor);
                        }
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
                      onSaveVendorProfile={handleSaveVendorProfile}
                      onVendorUpdated={updatedVendor => {
                        setVendor(updatedVendor);
                        setPreviewVendor(updatedVendor);
                        setIsPreviewDirty(false);
                      }}
                      onPreviewChange={handlePreviewChange}
                    />
                    {deleteError && (
                      <p className="mt-3 text-sm text-red-600">{deleteError}</p>
                    )}
                  </div>
                )}

                {activeSection === 'availability' && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Availability</h2>
                    <p className="text-sm text-gray-500 mb-4">Set your everyday booking capacity, then block specific dates or adjust how many bookings you can take on a day.</p>
                    <VendorAvailabilityManager
                      token={session.token}
                      vendor={vendor}
                      onSaveVendorAvailability={handleSaveVendorAvailability}
                      onVendorUpdated={(updatedVendor) => {
                        setVendor(updatedVendor);
                        if (!isPreviewDirty) {
                          setPreviewVendor(updatedVendor);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <LegalFooter hasBottomNav={Boolean(vendor)} className="vendor-portal-footer" />

      {showSupportModal && (
        <VendorSupportModal
          session={session}
          vendor={vendor}
          onClose={() => setShowSupportModal(false)}
        />
      )}

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
