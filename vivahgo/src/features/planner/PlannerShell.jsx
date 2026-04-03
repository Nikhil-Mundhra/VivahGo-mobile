import { useCallback, useEffect, useRef, useState } from "react";
import "../../styles.css";
import SplashScreen from "./components/SplashScreen";
import OnboardingScreen from "./components/OnboardingScreen";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./screens/Dashboard";
import EventsScreen from "./screens/EventsScreen";
import BudgetScreen from "./screens/BudgetScreen";
import GuestsScreen from "./screens/GuestsScreen";
import VendorsScreen from "./screens/VendorsScreen";
import TasksScreen from "./screens/TasksScreen";
import AccountScreen from "./components/AccountScreen";
import FeedbackModal from "../../components/FeedbackModal";
import LegalFooter from "../../components/LegalFooter";
import LoadingBar from "../../components/LoadingBar";
import NavIcon from "../../components/NavIcon";
import MarriagePlanSelector from "./components/MarriagePlanSelector";
import NewMarriagePlanModal from "./components/NewMarriagePlanModal";
import PlanShareModal from "./components/PlanShareModal";
import { clearAuthStorage, persistAuthSession, readAuthSession, revokeClerkSession, revokeGoogleIdTokenConsent } from "../../authStorage";
import { NAV_ITEMS } from "../../constants";
import { formatCoverageLocation, getLocationCities, getLocationCountries, getLocationStates } from "../../locationOptions";
import {
  addPlanCollaborator,
  fetchAccessiblePlanners,
  fetchPlannerNotificationSettings,
  fetchPlanCollaborators,
  fetchPlanner,
  registerPlannerNotificationToken,
  removePlanCollaborator,
  removePlannerNotificationToken,
  savePlannerNotificationSettings,
  savePlanner,
  updatePlanCollaboratorRole,
} from "./api.js";
import { deleteAccount, loginWithClerk, loginWithGoogle, logoutSession } from "../auth/api.js";
import { getSubscriptionStatus } from "../marketing/api.js";
import { DEFAULT_REMINDER_SETTINGS, DEFAULT_WEBSITE_SETTINGS, EMPTY_WEDDING, EXPECTED_GUEST_OPTIONS, buildWeddingWebsitePath, createBlankPlanner, createDemoPlanner, hasWeddingProfile, normalizePlanner, generatePlanId, createTemplatePlanCollections, normalizeCustomTemplates } from "../../plannerDefaults";
import { useSwipeDown } from "../../shared/hooks/useSwipeDown.js";
import { buildLoginAuthOptions } from "../../loginAuthOptions.js";
import { getMarketingUrl } from "../../siteUrls.js";
import { getBrowserNotificationSupport, removeBrowserPushToken, requestBrowserPushToken, subscribeToForegroundMessages } from "../../firebaseMessaging.js";

const DEMO_PLANNER_STORAGE_KEY = "vivahgo.demoPlanner";
const PRICING_URL = getMarketingUrl("/pricing");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = Array.from({ length: 8 }, (_, i) => 2025 + i);
const DEFAULT_NOTIFICATION_PREFERENCES = {
  browserPushEnabled: false,
  eventReminders: true,
  paymentReminders: true,
};

function parseDateStr(str) {
  const [day = "", month = "", year = ""] = (str || "").split(" ");
  return { day, month, year };
}

function formatDateStr({ day, month, year }) {
  if (!day || !month || !year) {
    return [day, month, year].filter(Boolean).join(" ");
  }
  return `${day} ${month} ${year}`;
}

function parseWeddingLocation(value) {
  const parts = String(value || "")
    .split(",")
    .map((item) => item.trim());
  if (parts.length === 2) {
    const [state = "", country = ""] = parts;
    return { country, state, city: "" };
  }
  const [city = "", state = "", country = ""] = parts;
  return { country, state, city };
}

export default function PlannerShell() {
  const marketingHomeUrl = getMarketingUrl("/");
  const [screen, setScreen] = useState("login");
  const [tab, setTab] = useState("home");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [wedding, setWedding] = useState(createBlankPlanner().wedding);
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [guests, setGuests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [showWeddingDetailsEditor, setShowWeddingDetailsEditor] = useState(false);
  const [weddingDetailsForm, setWeddingDetailsForm] = useState({ bride: "", groom: "", date: "", country: "", state: "", city: "", budget: "", guests: "" });
  const [extraLocationDraft, setExtraLocationDraft] = useState({ country: "", state: "", city: "" });
  const [showExtraLocationForm, setShowExtraLocationForm] = useState(false);
  const [eventToEditId, setEventToEditId] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showDesktopFooter, setShowDesktopFooter] = useState(true);
  const [isDesktopView, setIsDesktopView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  // Multi-marriage management
  const [marriages, setMarriages] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [showMarriagePlanSelector, setShowMarriagePlanSelector] = useState(false);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [configuringPlanId, setConfiguringPlanId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [planAccess, setPlanAccess] = useState({ role: "owner", canEdit: true, canManageSharing: true });
  const [plannerOwnerId, setPlannerOwnerId] = useState("");
  const [accessibleWorkspaces, setAccessibleWorkspaces] = useState([]);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  // Subscription
  const [subscription, setSubscription] = useState({ tier: "starter", status: "active", currentPeriodEnd: null });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptMessage, setUpgradePromptMessage] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationSupport, setNotificationSupport] = useState({ supported: false, configured: false, permission: "default" });
  const [notificationError, setNotificationError] = useState("");
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const weddingSwipe = useSwipeDown(() => closeWeddingDetailsEditor());
  const weddingLocationCountries = getLocationCountries();
  const weddingLocationStates = getLocationStates(weddingDetailsForm.country);
  const weddingLocationCities = getLocationCities(weddingDetailsForm.country, weddingDetailsForm.state);
  const extraLocationStates = getLocationStates(extraLocationDraft.country);
  const extraLocationCities = getLocationCities(extraLocationDraft.country, extraLocationDraft.state);

  const saveTimerRef = useRef(null);
  const contentAreaRef = useRef(null);
  const previousScrollTopRef = useRef(0);
  const activePlan = marriages.find(m => m.id === activePlanId) || null;
  const extraVenueOptions = Array.isArray(activePlan?.extraLocations) ? activePlan.extraLocations : [];
  const presetVenues = Array.from(new Set([
    wedding.venue,
    ...extraVenueOptions,
  ].filter(Boolean)));

  function applyWeddingToActivePlan(nextWedding, nextPlanOverrides = {}) {
    setWedding(nextWedding);
    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? {
          ...plan,
          bride: nextWedding.bride || "",
          groom: nextWedding.groom || "",
          date: nextWedding.date || "",
          venue: nextWedding.venue || "",
          extraLocations: Array.isArray(nextPlanOverrides.extraLocations)
            ? nextPlanOverrides.extraLocations
            : (Array.isArray(plan.extraLocations) ? plan.extraLocations : []),
          guests: nextWedding.guests || "",
      budget: nextWedding.budget || "",
      websiteSettings: plan.websiteSettings || { ...DEFAULT_WEBSITE_SETTINGS },
    }
        : plan
    )));
  }

  function mergeActivePlanCollection(currentItems, nextPlanItems, planId) {
    const nextItems = Array.isArray(nextPlanItems) ? nextPlanItems : [];
    const preserved = (Array.isArray(currentItems) ? currentItems : []).filter(item => item?.planId !== planId);
    const normalizedPlanItems = nextItems
      .filter(item => item && typeof item === "object")
      .map(item => ({ ...item, planId }));
    return [...preserved, ...normalizedPlanItems];
  }

  function normalizeEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function getRoleForPlan(planId, fallbackRole = "owner") {
    const plan = marriages.find(item => item.id === planId);
    const email = normalizeEmail(user?.email);

    if (!plan || !email || !Array.isArray(plan.collaborators)) {
      return fallbackRole;
    }

    return plan.collaborators.find(item => normalizeEmail(item.email) === email)?.role || fallbackRole;
  }

  function roleToAccess(role) {
    return {
      role,
      canEdit: role === "owner" || role === "editor",
      canManageSharing: role === "owner",
    };
  }

  function createPlanScopedSetter(setCollection, planId) {
    return (updater) => {
      if (!planId) {
        return;
      }
      if (!planAccess.canEdit) {
        return;
      }
      setCollection(previous => {
        const currentPlanItems = (Array.isArray(previous) ? previous : []).filter(item => item?.planId === planId);
        const nextPlanItems = typeof updater === "function" ? updater(currentPlanItems) : updater;
        return mergeActivePlanCollection(previous, nextPlanItems, planId);
      });
    };
  }

  const activeEvents = (events || []).filter(item => item?.planId === activePlanId);
  const activeExpenses = (expenses || []).filter(item => item?.planId === activePlanId);
  const activeGuests = (guests || []).filter(item => item?.planId === activePlanId);
  const activeVendors = (vendors || []).filter(item => item?.planId === activePlanId);
  const activeTasks = (tasks || []).filter(item => item?.planId === activePlanId);
  const activeMarriage = marriages.find(item => item?.id === activePlanId) || null;
  const activeWeddingWebsitePath = buildWeddingWebsitePath(activeMarriage, wedding);

  const setActiveEvents = createPlanScopedSetter(setEvents, activePlanId);
  const setActiveExpenses = createPlanScopedSetter(setExpenses, activePlanId);
  const setActiveGuests = createPlanScopedSetter(setGuests, activePlanId);
  const setActiveTasks = createPlanScopedSetter(setTasks, activePlanId);

  function shouldShowOnboarding(nextPlanner) {
    return !hasWeddingProfile(normalizePlanner(nextPlanner).wedding);
  }

  const applyPlanner = useCallback((nextPlanner, nextAccess) => {
    const planner = normalizePlanner(nextPlanner);
    setMarriages(planner.marriages || []);
    setActivePlanId(planner.activePlanId);
    setCustomTemplates(planner.customTemplates || []);
    setWedding(planner.wedding);
    setEvents(planner.events);
    setExpenses(planner.expenses);
    setGuests(planner.guests);
    setVendors(planner.vendors);
    setTasks(planner.tasks);

    const activePlan = (planner.marriages || []).find(item => item.id === planner.activePlanId);
    setCollaborators(Array.isArray(activePlan?.collaborators) ? activePlan.collaborators : []);

    if (nextAccess && typeof nextAccess === "object") {
      setPlanAccess({
        role: nextAccess.role || "owner",
        canEdit: Boolean(nextAccess.canEdit ?? true),
        canManageSharing: Boolean(nextAccess.canManageSharing ?? true),
      });
      return;
    }

    const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const derivedRole = activePlan?.collaborators?.find(item => (
      typeof item?.email === "string" ? item.email.trim().toLowerCase() : ""
    ) === email)?.role || "owner";
    setPlanAccess({
      role: derivedRole,
      canEdit: derivedRole === "owner" || derivedRole === "editor",
      canManageSharing: derivedRole === "owner",
    });
  }, [user?.email]);

  function syncPlanMetadataFromPlanner(nextPlanner) {
    const normalized = normalizePlanner(nextPlanner);

    setMarriages(current => {
      let didChange = false;
      const updated = current.map(plan => {
        const serverPlan = normalized.marriages.find(item => item.id === plan.id);
        if (!serverPlan) {
          return plan;
        }

        const nextReminderSettings = serverPlan.reminderSettings || { ...DEFAULT_REMINDER_SETTINGS };
        const websiteChanged = (serverPlan.websiteSlug || "") !== (plan.websiteSlug || "");
        const reminderChanged = JSON.stringify(plan.reminderSettings || DEFAULT_REMINDER_SETTINGS) !== JSON.stringify(nextReminderSettings);

        if (websiteChanged || reminderChanged) {
          didChange = true;
          return {
            ...plan,
            websiteSlug: serverPlan.websiteSlug || "",
            reminderSettings: nextReminderSettings,
          };
        }

        return plan;
      });

      return didChange ? updated : current;
    });
  }

  async function fetchAndApplySubscription(token) {
    if (!token) return;
    try {
      const status = await getSubscriptionStatus(token);
      setSubscription({
        tier: status.tier || "starter",
        status: status.status || "active",
        currentPeriodEnd: status.currentPeriodEnd || null,
      });
    } catch {
      // Non-fatal: default to starter if status fetch fails
    }
  }

  async function refreshBrowserNotificationState() {
    try {
      const support = await getBrowserNotificationSupport();
      setNotificationSupport(support);
    } catch {
      setNotificationSupport({ supported: false, configured: false, permission: "default" });
    }
  }

  const fetchAndApplyNotificationSettings = useCallback(async (token) => {
    if (!token) {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    try {
      const response = await fetchPlannerNotificationSettings(token);
      setNotificationPreferences({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(response?.notificationPreferences || {}),
      });
    } catch {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    } finally {
      try {
        const support = await getBrowserNotificationSupport();
        setNotificationSupport(support);
      } catch {
        setNotificationSupport({ supported: false, configured: false, permission: "default" });
      }
    }
  }, []);

  function persistSession(session) {
    return persistAuthSession(session);
  }

  function clearStoredSession() {
    clearAuthStorage("planner");
  }

  async function refreshAccessibleWorkspaces(token) {
    if (!token) {
      setAccessibleWorkspaces([]);
      return;
    }

    try {
      const response = await fetchAccessiblePlanners(token);
      const next = Array.isArray(response.planners) ? response.planners : [];
      setAccessibleWorkspaces(next);
    } catch (error) {
      console.error("Failed to load accessible workspaces:", error);
      setAccessibleWorkspaces([]);
    }
  }

  async function handleWorkspaceSwitch(nextOwnerId) {
    if (!nextOwnerId || !authToken || nextOwnerId === plannerOwnerId) {
      return;
    }

    try {
      setIsSwitchingWorkspace(true);
      const { planner, access, plannerOwnerId: resolvedOwnerId } = await fetchPlanner(authToken, nextOwnerId);
      applyPlanner(planner, access);
      setPlannerOwnerId(resolvedOwnerId || nextOwnerId);
      setConfiguringPlanId(null);
      persistSession({ mode: "google", token: authToken, user, plannerOwnerId: resolvedOwnerId || nextOwnerId });
    } catch (error) {
      console.error("Workspace switch failed:", error);
      setLoginError(error.message || "Could not switch workspace.");
    } finally {
      setIsSwitchingWorkspace(false);
    }
  }

  // Multi-marriage management functions
  function switchToMarriage(planId) {
    if (!planId || planId === activePlanId) {
      return;
    }

    const targetPlan = marriages.find(m => m.id === planId);
    if (!targetPlan) return;

    setActivePlanId(planId);

    // Update wedding metadata from the selected plan.
    setWedding({
      bride: targetPlan.bride || "",
      groom: targetPlan.groom || "",
      date: targetPlan.date || "",
      venue: targetPlan.venue || "",
      guests: targetPlan.guests || "",
      budget: targetPlan.budget || "",
    });
    setCollaborators(Array.isArray(targetPlan.collaborators) ? targetPlan.collaborators : []);
    setPlanAccess(roleToAccess(getRoleForPlan(planId, "owner")));
  }

  function createNewMarriage(formData) {
    if (!planAccess.canEdit) {
      return;
    }

    // Subscription gate: Starter plan is limited to 1 wedding workspace
    if ((authMode === "google" || authMode === "clerk") && subscription.tier === "starter" && marriages.length >= 1) {
      setUpgradePromptMessage("Starter plan supports 1 wedding. Upgrade to Premium for unlimited wedding workspaces.");
      setShowUpgradePrompt(true);
      setShowNewPlanModal(false);
      return;
    }

    const newPlanId = generatePlanId();
    const seededCollections = createTemplatePlanCollections(formData.template, newPlanId, customTemplates);
    const newMarriage = {
      id: newPlanId,
      bride: formData.bride,
      groom: formData.groom,
      date: formData.date,
      venue: formData.venue,
      extraLocations: [],
      guests: formData.guests,
      budget: formData.budget,
      template: formData.template,
      websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
      reminderSettings: { ...DEFAULT_REMINDER_SETTINGS },
      collaborators: user?.email
        ? [{ email: normalizeEmail(user.email), role: "owner", addedBy: user.id || "", addedAt: new Date() }]
        : [],
      createdAt: new Date(),
    };

    setMarriages(current => [...current, newMarriage]);
    setEvents(current => [...current, ...seededCollections.events]);
    setExpenses(current => [...current, ...seededCollections.expenses]);
    setGuests(current => [...current, ...seededCollections.guests]);
    setVendors(current => [...current, ...seededCollections.vendors]);
    setTasks(current => [...current, ...seededCollections.tasks]);
    setActivePlanId(newPlanId);
    setWedding({
      bride: newMarriage.bride || "",
      groom: newMarriage.groom || "",
      date: newMarriage.date || "",
      venue: newMarriage.venue || "",
      guests: newMarriage.guests || "",
      budget: newMarriage.budget || "",
    });
    setCollaborators(newMarriage.collaborators || []);
    setPlanAccess({ role: "owner", canEdit: true, canManageSharing: true });
    setShowNewPlanModal(false);
  }

  function createCustomTemplate(templateData) {
    if (subscription.tier !== "studio") {
      setUpgradePromptMessage("Custom templates are available on the Studio plan.");
      setShowUpgradePrompt(true);
      return null;
    }

    const nextTemplate = {
      id: `custom_template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: templateData.name,
      description: templateData.description,
      culture: templateData.culture,
      emoji: templateData.emoji,
      events: templateData.events,
      createdAt: new Date(),
      isCustom: true,
    };

    const normalizedTemplate = normalizeCustomTemplates([nextTemplate])[0];
    setCustomTemplates(current => [...current, normalizedTemplate]);
    return normalizedTemplate;
  }

  function deleteMarriage(planId) {
    if (!planAccess.canEdit) {
      return;
    }

    if (marriages.length <= 1) {
      alert("You must have at least one marriage plan");
      return;
    }

    const updatedMarriages = marriages.filter(m => m.id !== planId);
    const deletedPlanWasActive = activePlanId === planId;
    const fallbackPlan = updatedMarriages[0] || null;

    setMarriages(updatedMarriages);

    if (deletedPlanWasActive && fallbackPlan) {
      setActivePlanId(fallbackPlan.id);
      setWedding({
        bride: fallbackPlan.bride || "",
        groom: fallbackPlan.groom || "",
        date: fallbackPlan.date || "",
        venue: fallbackPlan.venue || "",
        guests: fallbackPlan.guests || "",
        budget: fallbackPlan.budget || "",
      });
      setCollaborators(Array.isArray(fallbackPlan.collaborators) ? fallbackPlan.collaborators : []);
      setPlanAccess(roleToAccess(getRoleForPlan(fallbackPlan.id, "owner")));
    }

    // Remove all data for this plan
    setEvents(current => current.filter(e => e.planId !== planId));
    setExpenses(current => current.filter(e => e.planId !== planId));
    setGuests(current => current.filter(g => g.planId !== planId));
    setVendors(current => current.filter(v => v.planId !== planId));
    setTasks(current => current.filter(t => t.planId !== planId));
  }

  function openConfigurePlan(planId) {
    setConfiguringPlanId(planId);
  }

  function closeConfigurePlan() {
    setConfiguringPlanId(null);
  }

  async function openShareModal(planId) {
    const targetPlanId = planId || activePlanId;
    if (!targetPlanId) {
      return;
    }

    setConfiguringPlanId(targetPlanId);
    const currentPlan = marriages.find(item => item.id === targetPlanId);
    setCollaborators(Array.isArray(currentPlan?.collaborators) ? currentPlan.collaborators : []);

    if ((authMode === "google" || authMode === "clerk") && authToken) {
      try {
        const response = await fetchPlanCollaborators(authToken, targetPlanId, plannerOwnerId);
        setCollaborators(Array.isArray(response.collaborators) ? response.collaborators : []);
      } catch (error) {
        console.error("Failed to fetch collaborators:", error);
      }
    }

    setShowShareModal(true);
  }

  function closeShareModal() {
    setShowShareModal(false);
  }

  function syncPlanCollaborators(planId, nextCollaborators) {
    setMarriages(current => current.map(plan => (
      plan.id === planId
        ? { ...plan, collaborators: nextCollaborators }
        : plan
    )));
    if (planId === activePlanId) {
      setCollaborators(nextCollaborators);
      const nextRole = nextCollaborators.find(item => normalizeEmail(item.email) === normalizeEmail(user?.email))?.role || "viewer";
      setPlanAccess(roleToAccess(nextRole));
    }
  }

  async function handleAddCollaborator({ email, role }) {
    const targetPlanId = configuringPlanId || activePlanId;
    if (!targetPlanId) {
      return;
    }

    if ((authMode === "google" || authMode === "clerk") && authToken) {
      const response = await addPlanCollaborator(authToken, { planId: targetPlanId, email, role, plannerOwnerId });
      const next = Array.isArray(response.collaborators) ? response.collaborators : [];
      syncPlanCollaborators(targetPlanId, next);
      await refreshAccessibleWorkspaces(authToken);
      return;
    }

    const next = [...collaborators, { email, role, addedBy: user?.id || "", addedAt: new Date() }];
    syncPlanCollaborators(targetPlanId, next);
  }

  async function handleUpdateCollaboratorRole({ email, role }) {
    const targetPlanId = configuringPlanId || activePlanId;
    if (!targetPlanId) {
      return;
    }

    if ((authMode === "google" || authMode === "clerk") && authToken) {
      const response = await updatePlanCollaboratorRole(authToken, { planId: targetPlanId, email, role, plannerOwnerId });
      const next = Array.isArray(response.collaborators) ? response.collaborators : [];
      syncPlanCollaborators(targetPlanId, next);
      await refreshAccessibleWorkspaces(authToken);
      return;
    }

    const next = collaborators.map(item => (
      normalizeEmail(item.email) === normalizeEmail(email)
        ? { ...item, role }
        : item
    ));
    syncPlanCollaborators(targetPlanId, next);
  }

  async function handleRemoveCollaborator({ email }) {
    const targetPlanId = configuringPlanId || activePlanId;
    if (!targetPlanId) {
      return;
    }

    if ((authMode === "google" || authMode === "clerk") && authToken) {
      const response = await removePlanCollaborator(authToken, { planId: targetPlanId, email, plannerOwnerId });
      const next = Array.isArray(response.collaborators) ? response.collaborators : [];
      syncPlanCollaborators(targetPlanId, next);
      await refreshAccessibleWorkspaces(authToken);
      return;
    }

    const next = collaborators.filter(item => normalizeEmail(item.email) !== normalizeEmail(email));
    syncPlanCollaborators(targetPlanId, next);
  }

  function updateActiveMarriageWebsiteSettings(nextSettings) {
    if (!activePlanId || !planAccess.canEdit) {
      return;
    }

    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? {
          ...plan,
          websiteSettings: {
            ...DEFAULT_WEBSITE_SETTINGS,
            ...(plan.websiteSettings || {}),
            ...nextSettings,
          },
        }
        : plan
    )));
  }

  function updateActiveMarriageReminderSettings(nextSettings) {
    if (!activePlanId || !planAccess.canEdit) {
      return;
    }

    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? {
          ...plan,
          reminderSettings: {
            ...DEFAULT_REMINDER_SETTINGS,
            ...(plan.reminderSettings || {}),
            ...nextSettings,
          },
        }
        : plan
    )));
  }

  async function handleSaveNotificationPreferences(nextPartial) {
    if (!authToken) {
      return;
    }

    const nextPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...notificationPreferences,
      ...nextPartial,
    };

    try {
      setIsUpdatingNotifications(true);
      setNotificationError("");
      setNotificationPreferences(nextPreferences);
      const response = await savePlannerNotificationSettings(authToken, nextPreferences);
      setNotificationPreferences({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(response?.notificationPreferences || nextPreferences),
      });
    } catch (error) {
      setNotificationError(error.message || "Could not save notification preferences.");
    } finally {
      setIsUpdatingNotifications(false);
    }
  }

  async function handleEnableBrowserNotifications() {
    if (!authToken) {
      return;
    }

    try {
      setIsUpdatingNotifications(true);
      setNotificationError("");
      const token = await requestBrowserPushToken();
      const response = await registerPlannerNotificationToken(authToken, {
        token,
        platform: "web",
        deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : "web-browser",
      });
      setNotificationPreferences({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(response?.notificationPreferences || notificationPreferences),
      });
      await refreshBrowserNotificationState();
    } catch (error) {
      setNotificationError(error.message || "Could not enable browser notifications.");
      await refreshBrowserNotificationState();
    } finally {
      setIsUpdatingNotifications(false);
    }
  }

  async function handleDisableBrowserNotifications() {
    if (!authToken) {
      return;
    }

    try {
      setIsUpdatingNotifications(true);
      setNotificationError("");
      let token = "";
      try {
        token = await requestBrowserPushToken();
      } catch {
        token = "";
      }
      await removeBrowserPushToken().catch(() => false);
      const response = token
        ? await removePlannerNotificationToken(authToken, { token })
        : await savePlannerNotificationSettings(authToken, {
          ...notificationPreferences,
          browserPushEnabled: false,
        });
      setNotificationPreferences({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(response?.notificationPreferences || notificationPreferences),
        browserPushEnabled: false,
      });
      await refreshBrowserNotificationState();
    } catch (error) {
      setNotificationError(error.message || "Could not disconnect browser notifications.");
    } finally {
      setIsUpdatingNotifications(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleViewportChange = (event) => {
      setIsDesktopView(event.matches);
      if (!event.matches) {
        setShowDesktopFooter(true);
      }
    };

    setIsDesktopView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [user?.picture]);

  useEffect(() => {
    getBrowserNotificationSupport()
      .then((support) => setNotificationSupport(support))
      .catch(() => setNotificationSupport({ supported: false, configured: false, permission: "default" }));

    if (typeof window === "undefined") {
      return;
    }

    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab && NAV_ITEMS.some((item) => item.id === requestedTab)) {
      setTab(requestedTab);
    }
  }, []);

  useEffect(() => {
    const scrollHost = contentAreaRef.current;

    if (!scrollHost || screen !== "app" || !isDesktopView) {
      return undefined;
    }

    previousScrollTopRef.current = scrollHost.scrollTop;

    const handleContentScroll = () => {
      const currentScrollTop = scrollHost.scrollTop;
      const delta = currentScrollTop - previousScrollTopRef.current;

      if (Math.abs(delta) < 2) {
        return;
      }

      if (delta > 0) {
        setShowDesktopFooter(true);
      } else {
        setShowDesktopFooter(false);
      }

      previousScrollTopRef.current = currentScrollTop;
    };

    scrollHost.addEventListener("scroll", handleContentScroll, { passive: true });

    return () => {
      scrollHost.removeEventListener("scroll", handleContentScroll);
    };
  }, [isDesktopView, screen]);

  useEffect(() => {
    if (screen !== "app") {
      setShowDesktopFooter(true);
    }
  }, [screen]);

  useEffect(() => {
    if (!activePlanId) {
      return;
    }

    setMarriages(current => {
      let didChange = false;
      const updated = current.map(plan => {
        if (plan.id !== activePlanId) {
          return plan;
        }

        const nextPlan = {
          ...plan,
          bride: wedding.bride || "",
          groom: wedding.groom || "",
          date: wedding.date || "",
          venue: wedding.venue || "",
          guests: wedding.guests || "",
          budget: wedding.budget || "",
        };

        if (
          nextPlan.bride !== plan.bride ||
          nextPlan.groom !== plan.groom ||
          nextPlan.date !== plan.date ||
          nextPlan.venue !== plan.venue ||
          nextPlan.guests !== plan.guests ||
          nextPlan.budget !== plan.budget
        ) {
          didChange = true;
          return nextPlan;
        }

        return plan;
      });

      return didChange ? updated : current;
    });
  }, [activePlanId, wedding]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const session = readAuthSession();

      if (!session) {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        if (session.mode === "demo") {
          const savedPlanner = JSON.parse(localStorage.getItem(DEMO_PLANNER_STORAGE_KEY) || "null");
          if (!cancelled) {
            setAuthMode("demo");
            setUser(session.user || null);
            applyPlanner(savedPlanner || createDemoPlanner());
            setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
            setRequiresOnboarding(false);
            setScreen("splash");
          }
          return;
        }

        if ((session.mode === "google" || session.mode === "clerk") && session.token) {
          const { planner, access, plannerOwnerId: resolvedOwnerId } = await fetchPlanner(session.token, session.plannerOwnerId);
          const nextRequiresOnboarding = shouldShowOnboarding(planner);
          if (!cancelled) {
            setAuthMode(session.mode);
            setAuthToken(session.token);
            setUser(session.user || null);
            applyPlanner(planner, access);
            setRequiresOnboarding(nextRequiresOnboarding);
            setPlannerOwnerId(resolvedOwnerId || session.plannerOwnerId || session.user?.id || "");
            await refreshAccessibleWorkspaces(session.token);
            await fetchAndApplySubscription(session.token);
            await fetchAndApplyNotificationSettings(session.token);
            setScreen(nextRequiresOnboarding ? "splash" : "app");
          }
          return;
        }
      } catch (error) {
        console.error("Failed to restore session:", error);
        clearStoredSession();
        if (!cancelled) {
          setLoginError("Your previous session could not be restored. Please sign in again.");
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [applyPlanner, fetchAndApplyNotificationSettings]);

  useEffect(() => {
    let unsubscribe = () => {};
    let isActive = true;

    subscribeToForegroundMessages((payload) => {
      if (!isActive || typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }

      const title = payload?.notification?.title || "VivahGo reminder";
      const body = payload?.notification?.body || "You have an upcoming planner reminder.";
      new Notification(title, { body });
    }).then((nextUnsubscribe) => {
      unsubscribe = typeof nextUnsubscribe === "function" ? nextUnsubscribe : () => {};
    }).catch(() => {});

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [authToken]);

  useEffect(() => {
    if (isBootstrapping || !authToken) {
      return undefined;
    }

    const planner = {
      marriages,
      activePlanId,
      customTemplates,
      wedding,
      events,
      expenses,
      guests,
      vendors,
      tasks,
    };

    if (authMode === "demo") {
      localStorage.setItem(DEMO_PLANNER_STORAGE_KEY, JSON.stringify(planner));
      return undefined;
    }

    if ((authMode !== "google" && authMode !== "clerk") || !authToken) {
      return undefined;
    }

    if (!planAccess.canEdit) {
      return undefined;
    }

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaveState("saving");
        const response = await savePlanner(authToken, planner, plannerOwnerId);
        if (response?.planner) {
          syncPlanMetadataFromPlanner(response.planner);
        }
        setSaveState("saved");
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveState("error");
      }
    }, 500);

    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, [authMode, authToken, customTemplates, expenses, events, guests, isBootstrapping, tasks, vendors, wedding, marriages, activePlanId, planAccess.canEdit, plannerOwnerId]);

  function handleDemoLogin() {
    const demoUser = {
      id: "demo-user",
      name: "VivahGo Demo",
      email: "demo@vivahgo.local",
      picture: "",
    };
    const demoPlanner = createDemoPlanner();

    setAuthMode("demo");
    setAuthToken("");
    setUser(demoUser);
    applyPlanner(demoPlanner);
    setPlannerOwnerId(demoUser.id);
    setAccessibleWorkspaces([]);
    setPlanAccess({ role: "owner", canEdit: true, canManageSharing: true });
    persistSession({ mode: "demo", user: demoUser });
    localStorage.setItem(DEMO_PLANNER_STORAGE_KEY, JSON.stringify(demoPlanner));
    setLoginError("");
    setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    setRequiresOnboarding(false);
    setTab("home");
    setScreen("splash");
  }

  function handleGoToHome() {
    window.location.assign(marketingHomeUrl);
  }

  async function handleClerkLoginSuccess(clerkUser, clerkBackendToken) {
    try {
      setIsLoggingIn(true);
      setLoginError("");
      const { user: authenticatedUser, planner, access, plannerOwnerId: resolvedOwnerId } = await loginWithClerk(
        clerkBackendToken || clerkUser?.id || '',
        clerkUser || {}
      );
      const nextRequiresOnboarding = shouldShowOnboarding(planner);
      const nextSession = persistSession({ mode: "clerk", user: authenticatedUser, plannerOwnerId: resolvedOwnerId || authenticatedUser.id || "" });

      setAuthMode("clerk");
      setAuthToken(nextSession?.token || "");
      setUser(authenticatedUser);
      applyPlanner(planner, access);
      setRequiresOnboarding(nextRequiresOnboarding);
      setPlannerOwnerId(resolvedOwnerId || authenticatedUser.id || "");
      await refreshAccessibleWorkspaces(nextSession?.token);
      await fetchAndApplySubscription(nextSession?.token);
      await fetchAndApplyNotificationSettings(nextSession?.token);
      setTab("home");
      setSaveState("idle");
      setScreen("splash");
    } catch (error) {
      console.error("Clerk login failed:", error);
      setLoginError(error.message || "Clerk login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleGoogleLoginSuccess(credentialResponse) {
    try {
      setIsLoggingIn(true);
      setLoginError("");
      const { user: authenticatedUser, planner, access, plannerOwnerId: resolvedOwnerId } = await loginWithGoogle(credentialResponse.credential);
      const nextRequiresOnboarding = shouldShowOnboarding(planner);
      const nextSession = persistSession({ mode: "google", user: authenticatedUser, plannerOwnerId: resolvedOwnerId || authenticatedUser.id || "" });

      setAuthMode("google");
      setAuthToken(nextSession?.token || "");
      setUser(authenticatedUser);
      applyPlanner(planner, access);
      setRequiresOnboarding(nextRequiresOnboarding);
      setPlannerOwnerId(resolvedOwnerId || authenticatedUser.id || "");
      await refreshAccessibleWorkspaces(nextSession?.token);
      await fetchAndApplySubscription(nextSession?.token);
      await fetchAndApplyNotificationSettings(nextSession?.token);
      setTab("home");
      setSaveState("idle");
      setScreen("splash");
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError(error.message || "Google login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLoginError(error) {
    console.error('Login failed:', error);
    setLoginError(error?.message || 'Google login failed.');
  }

  async function handleLogout() {
    try {
      await logoutSession(authToken);
    } catch {
      // Best effort only.
    }
    if (authMode === "clerk") {
      await revokeClerkSession();
    }
    clearStoredSession();
    setUser(null);
    setAuthMode(null);
    setAuthToken("");
    setPlannerOwnerId("");
    setAccessibleWorkspaces([]);
    setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    applyPlanner(createBlankPlanner());
    setRequiresOnboarding(false);
    setTab("home");
    setSaveState("idle");
    setScreen("login");
  }

  async function handleDeleteAccount() {
    await deleteAccount(authToken);
    if (authMode === "clerk") {
      await revokeClerkSession();
    }
    await revokeGoogleIdTokenConsent(user?.email);
    clearStoredSession();
    setUser(null);
    setAuthMode(null);
    setAuthToken("");
    setPlannerOwnerId("");
    setAccessibleWorkspaces([]);
    setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    applyPlanner(createBlankPlanner());
    setRequiresOnboarding(false);
    setTab("home");
    setSaveState("idle");
    setScreen("login");
  }

  function handleOnboardComplete(answers) {
    const selectedTemplate = answers?.template || "blank";
    const seededCollections = createTemplatePlanCollections(selectedTemplate, activePlanId, customTemplates);
    const { template: _template, ...answerFields } = answers || {};
    const nextWedding = {
      ...EMPTY_WEDDING,
      ...answerFields,
    };

    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? { ...plan, template: selectedTemplate }
        : plan
    )));
    setEvents(current => mergeActivePlanCollection(current, seededCollections.events, activePlanId));
    setExpenses(current => mergeActivePlanCollection(current, seededCollections.expenses, activePlanId));
    setGuests(current => mergeActivePlanCollection(current, seededCollections.guests, activePlanId));
    setVendors(current => mergeActivePlanCollection(current, seededCollections.vendors, activePlanId));
    setTasks(current => mergeActivePlanCollection(current, seededCollections.tasks, activePlanId));

    applyWeddingToActivePlan(nextWedding);
    setRequiresOnboarding(false);
    setScreen("app");
  }

  function handleSkipOnboarding() {
    applyWeddingToActivePlan({ ...EMPTY_WEDDING });
    setRequiresOnboarding(false);
    setScreen("app");
  }

  function openWeddingDetailsEditor() {
    const location = parseWeddingLocation(wedding.venue);
    setWeddingDetailsForm({
      bride: wedding.bride || "",
      groom: wedding.groom || "",
      date: wedding.date || "",
      country: location.country,
      state: location.state,
      city: location.city,
      budget: wedding.budget || "",
      guests: wedding.guests || "",
    });
    setExtraLocationDraft({ country: "", state: "", city: "" });
    setShowExtraLocationForm(extraVenueOptions.length > 0);
    setShowWeddingDetailsEditor(true);
  }

  function closeWeddingDetailsEditor() {
    setShowWeddingDetailsEditor(false);
    setShowExtraLocationForm(false);
  }

  function addExtraWeddingLocation() {
    const location = formatCoverageLocation(extraLocationDraft);
    if (!location || location === wedding.venue) {
      return;
    }

    setMarriages(current => current.map(plan => {
      if (plan.id !== activePlanId) {
        return plan;
      }

      const existingLocations = Array.isArray(plan.extraLocations) ? plan.extraLocations : [];
      if (existingLocations.includes(location)) {
        return plan;
      }

      return {
        ...plan,
        extraLocations: [...existingLocations, location],
      };
    }));
    setExtraLocationDraft({ country: "", state: "", city: "" });
  }

  function removeExtraWeddingLocation(locationToRemove) {
    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? {
          ...plan,
          extraLocations: (Array.isArray(plan.extraLocations) ? plan.extraLocations : []).filter(location => location !== locationToRemove),
        }
        : plan
    )));
  }

  function openAccountSettings() {
    setShowAccountSettings(true);
  }

  function closeAccountSettings() {
    setShowAccountSettings(false);
  }

  function handleStartOnboardingFromDemo() {
    closeAccountSettings();
    setScreen("onboard");
  }

  function openFeedbackModal() {
    setShowFeedbackModal(true);
  }

  function closeFeedbackModal() {
    setShowFeedbackModal(false);
  }

  function saveWeddingDetails() {
    if (!planAccess.canEdit) {
      return;
    }

    const nextWedding = {
      ...wedding,
      bride: weddingDetailsForm.bride,
      groom: weddingDetailsForm.groom,
      date: weddingDetailsForm.date,
      venue: formatCoverageLocation({
        country: weddingDetailsForm.country,
        state: weddingDetailsForm.state,
        city: weddingDetailsForm.city,
      }),
      budget: weddingDetailsForm.budget,
      guests: weddingDetailsForm.guests,
    };

    const nextExtraLocations = (Array.isArray(activePlan?.extraLocations) ? activePlan.extraLocations : []).filter(location => location !== nextWedding.venue);
    applyWeddingToActivePlan(nextWedding, { extraLocations: nextExtraLocations });
    closeWeddingDetailsEditor();
  }

  function openEventEditorFromCalendar(eventId) {
    setEventToEditId(eventId);
    setTab("events");
    setTimeout(() => {
      setEventToEditId(null);
    }, 0);
  }

  if (isBootstrapping) {
    return (
      <div className="app-shell">
        <div className="login-screen">
          <div className="login-container" style={{ textAlign: "center" }}>
            <div className="login-logo">
              <img
                className="login-logo-image"
                src="/Thumbnail.png"
                alt="Vivah Go"
                style={{ maxWidth: 140, margin: "0 auto" }}
              />
            </div>
            <h1 className="login-title">Loading your planner</h1>
            <p className="login-subtitle">Checking your saved session and wedding data.</p>
            <LoadingBar className="login-hero-loading-bar" />
          </div>
        </div>
      </div>
    );
  }

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "";
  const accountName = (user?.name || "Account").trim() || "Account";
  const accountFirstName = accountName.split(/\s+/)[0] || accountName;
  const showOauthHelp = /invalid_client|no registered origin|origin.*not.*allowed|idpiframe/i.test(loginError);
  const authOptions = buildLoginAuthOptions(
    {
      onGoogleLogin: handleGoogleLoginSuccess,
      onClerkLogin: handleClerkLoginSuccess,
      onLoginError: handleLoginError,
      isLoggingIn,
    },
    {
      isClerkEnabled: Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY),
      hiddenOptionIds: ['facebook'], // Do this to enable facebook: remove this line.
    }
  );

  return (
    <div className="app-shell">
      {screen === "login" && (
        <>
          <LoginScreen
            authOptions={authOptions}
            onDemoLogin={handleDemoLogin}
            onGoToHome={handleGoToHome}
            isLoggingIn={isLoggingIn}
            errorMessage={loginError}
            showOauthHelp={showOauthHelp}
          />
          <LegalFooter
            hasBottomNav={false}
            onOpenFeedback={openFeedbackModal}
            aboutHref={marketingHomeUrl}
            aboutLabel="Home"
          />
        </>
      )}
      {screen === "splash" && (
        <SplashScreen
          onStart={() => setScreen(requiresOnboarding ? "onboard" : "app")}
          onSkip={handleSkipOnboarding}
          showSkip={requiresOnboarding}
        />
      )}
      {screen === "onboard" && <OnboardingScreen onComplete={handleOnboardComplete} />}
      {screen === "app" && (
        <div className="main-app">
          {/* Top Bar */}
          <div className="top-bar">
            <div className="top-bar-pattern">🪔</div>
            <div className="top-bar-greeting">Your Wedding</div>
            <div className="top-bar-names" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowMarriagePlanSelector(true)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--color-gold)",
                  }}
                  title="Manage marriage plans"
                >
                  <span>
                    {marriages.find(m => m.id === activePlanId)?.bride || "Bride"} & {marriages.find(m => m.id === activePlanId)?.groom || "Groom"}
                  </span>
                  <span style={{
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-gold)",
                    fontWeight: 700,
                  }}></span>
                </button>
              </div>
            </div>
            <div className="top-bar-meta">
              <button
                type="button"
                className="top-bar-chip top-bar-chip-button"
                onClick={openWeddingDetailsEditor}
                disabled={!planAccess.canEdit}
                style={{
                  cursor: planAccess.canEdit ? "pointer" : "not-allowed",
                  opacity: planAccess.canEdit ? 1 : 0.6,
                }}
              >
                Edit Wedding Plan
              </button>
              {wedding.date && <button type="button" className="top-bar-chip top-bar-chip-button" onClick={openWeddingDetailsEditor}>📅 {wedding.date}</button>}
              {wedding.venue && <button type="button" className="top-bar-chip top-bar-chip-button" onClick={openWeddingDetailsEditor}>📍 {wedding.venue}</button>}
              {(authMode === "google" || authMode === "clerk") && saveLabel && <div className="top-bar-chip">☁️ {saveLabel}</div>}
              {(authMode === "google" || authMode === "clerk") && !planAccess.canEdit && <div className="top-bar-chip">View only</div>}
            </div>
            <div className="top-bar-user">
              <button
                type="button"
                className="account-settings-trigger"
                onClick={openAccountSettings}
                title="Account settings"
                aria-label="Open account settings"
              >
                {user?.picture && !avatarLoadError ? (
                  <img
                    src={user.picture}
                    alt={user?.name || "Profile"}
                    className="user-avatar"
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <span className="user-avatar user-avatar-fallback" aria-hidden="true">
                    {(user?.name || "V").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="account-settings-name account-settings-name-full">{accountName}</span>
                <span className="account-settings-name account-settings-name-first">{accountFirstName}</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={`content-area ${!planAccess.canEdit ? "content-area-readonly" : ""}`} ref={contentAreaRef}>
            {tab==="home" && <Dashboard wedding={wedding} events={activeEvents} expenses={activeExpenses} guests={activeGuests} budget={wedding.budget} onTabChange={setTab} onEditEvent={openEventEditorFromCalendar}/>}
            {tab==="events" && <EventsScreen events={activeEvents} setEvents={setActiveEvents} expenses={activeExpenses} setExpenses={setActiveExpenses} planId={activePlanId} websitePath={activeWeddingWebsitePath} websiteSettings={activeMarriage?.websiteSettings || DEFAULT_WEBSITE_SETTINGS} subscriptionTier={subscription.tier} onSaveWebsiteSettings={updateActiveMarriageWebsiteSettings} onOpenBudget={() => setTab("budget")} initialEditingEventId={eventToEditId} defaultVenue={wedding.venue || ""} presetVenues={presetVenues}/>}
            {tab==="budget" && <BudgetScreen expenses={activeExpenses} setExpenses={setActiveExpenses} wedding={wedding} events={activeEvents} planId={activePlanId}/>} 
            {tab==="guests" && <GuestsScreen guests={activeGuests} setGuests={setActiveGuests} planId={activePlanId} authToken={authToken} plannerOwnerId={plannerOwnerId} />} 
            {tab==="vendors" && <VendorsScreen vendors={activeVendors}/>} 
            {tab==="tasks" && <TasksScreen tasks={activeTasks} setTasks={setActiveTasks} events={activeEvents} planId={activePlanId}/>} 
          </div>

          {/* Bottom Nav */}
          <div className="bottom-nav">
            {NAV_ITEMS.map(n=>(
              <div key={n.id} className={`nav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
                <div className="nav-icon"><NavIcon name={n.icon} /></div>
                <div className="nav-label">{n.label}</div>
                {tab===n.id && <div className="nav-active-dot"/>}
              </div>
            ))}
          </div>

          <LegalFooter
            hasBottomNav={true}
            isVisible={showDesktopFooter}
            onOpenFeedback={openFeedbackModal}
            aboutHref={marketingHomeUrl}
            aboutLabel="Home"
          />

          {showAccountSettings && (
            <AccountScreen
              user={user}
              authMode={authMode}
              subscription={subscription}
              activePlan={activeMarriage}
              planAccess={planAccess}
              notificationPreferences={notificationPreferences}
              notificationSupport={notificationSupport}
              notificationError={notificationError}
              isUpdatingNotifications={isUpdatingNotifications}
              onClose={closeAccountSettings}
              onStartOnboarding={handleStartOnboardingFromDemo}
              onEnableBrowserNotifications={handleEnableBrowserNotifications}
              onDisableBrowserNotifications={handleDisableBrowserNotifications}
              onSaveNotificationPreferences={handleSaveNotificationPreferences}
              onUpdateReminderSettings={updateActiveMarriageReminderSettings}
              onLogout={() => { closeAccountSettings(); handleLogout(); }}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
          {showFeedbackModal && <FeedbackModal onClose={closeFeedbackModal} />}

          {showUpgradePrompt && (
            <div className="modal-overlay" onClick={() => setShowUpgradePrompt(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-handle" />
                <div className="modal-title">Upgrade Required ✨</div>
                <p style={{ color: "var(--color-light-text)", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                  {upgradePromptMessage}
                </p>
                <a
                  className="btn-primary"
                  href={PRICING_URL}
                  style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                  onClick={() => setShowUpgradePrompt(false)}
                >
                  View Premium Plans
                </a>
                <button className="btn-secondary" onClick={() => setShowUpgradePrompt(false)}>
                  Maybe Later
                </button>
              </div>
            </div>
          )}
          {showMarriagePlanSelector && (
            <MarriagePlanSelector
              marriages={marriages}
              activePlanId={activePlanId}
              onSwitchPlan={switchToMarriage}
              onCreatePlan={() => setShowNewPlanModal(true)}
              onDeletePlan={deleteMarriage}
              onConfigurePlan={openConfigurePlan}
              onClose={() => setShowMarriagePlanSelector(false)}
            />
          )}
          {showNewPlanModal && (
            <NewMarriagePlanModal
              onClose={() => setShowNewPlanModal(false)}
              subscriptionTier={subscription.tier}
              customTemplates={customTemplates}
              onCreateCustomTemplate={createCustomTemplate}
              onCreate={createNewMarriage}
            />
          )}
          {configuringPlanId && (
            <div className="modal-overlay" onClick={closeConfigurePlan}>
              <div className="modal" {...weddingSwipe.modalProps} onClick={(event) => event.stopPropagation()}>
                <div className="modal-handle" />
                <div className="modal-title">Configure Plan</div>
                <div style={{ color: "var(--color-light-text)", fontSize: 13, marginBottom: 12 }}>
                  {(marriages.find(item => item.id === configuringPlanId)?.bride || "Bride")} &amp; {(marriages.find(item => item.id === configuringPlanId)?.groom || "Groom")}
                </div>
                {authMode === "google" && accessibleWorkspaces.length > 1 && (
                  <div className="input-group">
                    <div className="input-label">Workspace</div>
                    <select
                      className="input-field"
                      value={plannerOwnerId}
                      onChange={(event) => handleWorkspaceSwitch(event.target.value)}
                      disabled={isSwitchingWorkspace}
                    >
                      {accessibleWorkspaces.map(workspace => (
                        <option key={workspace.plannerOwnerId} value={workspace.plannerOwnerId}>
                          {workspace.plannerOwnerId === user?.id ? "My Plans" : "Shared"} - {workspace.activePlanName} ({workspace.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button className="btn-primary" onClick={() => openShareModal(configuringPlanId)}>
                  Share
                </button>
                <button className="btn-secondary" onClick={closeConfigurePlan}>Close</button>
              </div>
            </div>
          )}
          {showShareModal && (
            <PlanShareModal
              plan={marriages.find(item => item.id === (configuringPlanId || activePlanId))}
              collaborators={collaborators}
              canManageSharing={planAccess.canManageSharing}
              currentUserEmail={user?.email}
              onAdd={handleAddCollaborator}
              onUpdateRole={handleUpdateCollaboratorRole}
              onRemove={handleRemoveCollaborator}
              onClose={closeShareModal}
            />
          )}
          {showWeddingDetailsEditor && (
            <div className="modal-overlay" onClick={closeWeddingDetailsEditor}>
              <div className="modal" {...weddingSwipe.modalProps} onClick={(event) => event.stopPropagation()}>
                <div className="modal-handle"/>
                <div className="modal-title">Edit Wedding Plan</div>
                <div style={{ color: "var(--color-light-text)", fontSize: 13, marginBottom: 12 }}>
                  {(marriages.find(item => item.id === activePlanId)?.bride || "Bride")} &amp; {(marriages.find(item => item.id === activePlanId)?.groom || "Groom")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="input-group">
                    <div className="input-label">Bride&apos;s Name</div>
                    <input
                      className="input-field"
                      value={weddingDetailsForm.bride}
                      onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, bride: event.target.value })}
                      placeholder="e.g. Aarohi"
                    />
                  </div>
                  <div className="input-group">
                    <div className="input-label">Groom&apos;s Name</div>
                    <input
                      className="input-field"
                      value={weddingDetailsForm.groom}
                      onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, groom: event.target.value })}
                      placeholder="e.g. Kabir"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <div className="input-label">Main Wedding Day</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(() => {
                      const parsedDate = parseDateStr(weddingDetailsForm.date);
                      return (
                        <>
                          <select
                            className="select-field"
                            style={{ flex: 1 }}
                            value={parsedDate.day}
                            onChange={(event) => setWeddingDetailsForm({
                              ...weddingDetailsForm,
                              date: formatDateStr({ ...parsedDate, day: event.target.value }),
                            })}
                          >
                            <option value="">Day</option>
                            {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                          <select
                            className="select-field"
                            style={{ flex: 2 }}
                            value={parsedDate.month}
                            onChange={(event) => setWeddingDetailsForm({
                              ...weddingDetailsForm,
                              date: formatDateStr({ ...parsedDate, month: event.target.value }),
                            })}
                          >
                            <option value="">Month</option>
                            {MONTHS.map((month) => (
                              <option key={month} value={month}>{month}</option>
                            ))}
                          </select>
                          <select
                            className="select-field"
                            style={{ flex: 2 }}
                            value={parsedDate.year}
                            onChange={(event) => setWeddingDetailsForm({
                              ...weddingDetailsForm,
                              date: formatDateStr({ ...parsedDate, year: event.target.value }),
                            })}
                          >
                            <option value="">Year</option>
                            {YEARS.map((year) => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="input-group">
                    <div className="input-label">Total Budget (₹)</div>
                    <input
                      className="input-field"
                      type="number"
                      value={weddingDetailsForm.budget}
                      onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, budget: event.target.value })}
                      placeholder="e.g. 5000000"
                    />
                  </div>
                  <div className="input-group">
                    <div className="input-label">Expected Guests</div>
                    <select
                      className="select-field"
                      value={weddingDetailsForm.guests}
                      onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, guests: event.target.value })}
                    >
                      <option value="">Select guests</option>
                      {EXPECTED_GUEST_OPTIONS.map((guestCount) => (
                        <option key={guestCount} value={guestCount}>{guestCount}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <div className="input-label">Venue Location</div>
                  <div className="vendor-registration-grid vendor-registration-grid-3">
                    <select
                      className="select-field"
                      value={weddingDetailsForm.country}
                      onChange={(event) => setWeddingDetailsForm({
                        ...weddingDetailsForm,
                        country: event.target.value,
                        state: "",
                        city: "",
                      })}
                    >
                      <option value="">Select country</option>
                      {weddingLocationCountries.map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                    <select
                      className="select-field"
                      value={weddingDetailsForm.state}
                      onChange={(event) => setWeddingDetailsForm({
                        ...weddingDetailsForm,
                        state: event.target.value,
                        city: "",
                      })}
                      disabled={!weddingLocationStates.length}
                    >
                      <option value="">Select state</option>
                      {weddingLocationStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <select
                      className="select-field"
                      value={weddingDetailsForm.city}
                      onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, city: event.target.value })}
                      disabled={!weddingLocationCities.length}
                    >
                      <option value="">Select city</option>
                      {weddingLocationCities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowExtraLocationForm((current) => !current)}
                    aria-expanded={showExtraLocationForm}
                    style={{
                      marginTop: 0,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "var(--color-light-text)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>{showExtraLocationForm ? "▾" : "▸"}</span>
                    <span>{showExtraLocationForm ? "Hide Additional Event Locations" : "Add Additional Event Locations"}</span>
                  </button>
                  {showExtraLocationForm && (
                    <>
                      <div className="vendor-registration-grid vendor-registration-grid-3" style={{ marginTop: 10 }}>
                        <select
                          className="select-field"
                          value={extraLocationDraft.country}
                          onChange={(event) => setExtraLocationDraft({ country: event.target.value, state: "", city: "" })}
                        >
                          <option value="">Select country</option>
                          {weddingLocationCountries.map((country) => (
                            <option key={country} value={country}>{country}</option>
                          ))}
                        </select>
                        <select
                          className="select-field"
                          value={extraLocationDraft.state}
                          onChange={(event) => setExtraLocationDraft({ ...extraLocationDraft, state: event.target.value, city: "" })}
                          disabled={!extraLocationStates.length}
                        >
                          <option value="">Select state</option>
                          {extraLocationStates.map((state) => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                        <select
                          className="select-field"
                          value={extraLocationDraft.city}
                          onChange={(event) => setExtraLocationDraft({ ...extraLocationDraft, city: event.target.value })}
                          disabled={!extraLocationCities.length}
                        >
                          <option value="">Select city</option>
                          {extraLocationCities.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      </div>
                      <button type="button" className="vendor-registration-add-btn" onClick={addExtraWeddingLocation}>
                        Add Location
                      </button>
                    </>
                  )}
                  {extraVenueOptions.length > 0 && (
                    <div className="vendor-registration-chip-list">
                      {extraVenueOptions.map((location) => (
                        <button
                          key={location}
                          type="button"
                          className="vendor-registration-chip"
                          onClick={() => removeExtraWeddingLocation(location)}
                        >
                          {location} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn-primary" onClick={saveWeddingDetails}>Save Changes</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
