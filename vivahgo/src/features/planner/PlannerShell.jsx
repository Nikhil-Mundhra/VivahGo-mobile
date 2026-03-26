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
import TermsConditionsModal from "../../components/TermsConditionsModal";
import FeedbackModal from "../../components/FeedbackModal";
import LegalFooter from "../../components/LegalFooter";
import NavIcon from "../../components/NavIcon";
import MarriagePlanSelector from "./components/MarriagePlanSelector";
import NewMarriagePlanModal from "./components/NewMarriagePlanModal";
import PlanShareModal from "./components/PlanShareModal";
import { NAV_ITEMS } from "../../constants";
import {
  addPlanCollaborator,
  deleteAccount,
  fetchAccessiblePlanners,
  fetchPlanCollaborators,
  fetchPlanner,
  getSubscriptionStatus,
  loginWithGoogle,
  removePlanCollaborator,
  savePlanner,
  updatePlanCollaboratorRole,
} from "../../api";
import { DEFAULT_WEBSITE_SETTINGS, EMPTY_WEDDING, buildWeddingWebsitePath, createBlankPlanner, createDemoPlanner, hasWeddingProfile, normalizePlanner, generatePlanId, createTemplatePlanCollections } from "../../plannerDefaults";
import { useSwipeDown } from "../../hooks/useSwipeDown";

const SESSION_STORAGE_KEY = "vivahgo.session";
const DEMO_PLANNER_STORAGE_KEY = "vivahgo.demoPlanner";

export default function PlannerShell() {
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
  const [weddingDetailsForm, setWeddingDetailsForm] = useState({ date: "", venue: "" });
  const [eventToEditId, setEventToEditId] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
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
  // Subscription
  const [subscription, setSubscription] = useState({ tier: "starter", status: "active", currentPeriodEnd: null });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptMessage, setUpgradePromptMessage] = useState("");
  const weddingSwipe = useSwipeDown(() => closeWeddingDetailsEditor());

  const saveTimerRef = useRef(null);
  const contentAreaRef = useRef(null);
  const previousScrollTopRef = useRef(0);

  function applyWeddingToActivePlan(nextWedding) {
    setWedding(nextWedding);
    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? {
          ...plan,
          bride: nextWedding.bride || "",
          groom: nextWedding.groom || "",
          date: nextWedding.date || "",
          venue: nextWedding.venue || "",
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

  const applyPlanner = useCallback((nextPlanner, nextAccess) => {
    const planner = normalizePlanner(nextPlanner);
    setMarriages(planner.marriages || []);
    setActivePlanId(planner.activePlanId);
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

  function syncWebsiteSlugsFromPlanner(nextPlanner) {
    const normalized = normalizePlanner(nextPlanner);

    setMarriages(current => {
      let didChange = false;
      const updated = current.map(plan => {
        const serverPlan = normalized.marriages.find(item => item.id === plan.id);
        if (!serverPlan) {
          return plan;
        }

        if ((serverPlan.websiteSlug || "") !== (plan.websiteSlug || "")) {
          didChange = true;
          return { ...plan, websiteSlug: serverPlan.websiteSlug || "" };
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

  function persistSession(session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  function clearStoredSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(DEMO_PLANNER_STORAGE_KEY);
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
    if (authMode === "google" && subscription.tier === "starter" && marriages.length >= 1) {
      setUpgradePromptMessage("Starter plan supports 1 wedding. Upgrade to Premium for unlimited wedding workspaces.");
      setShowUpgradePrompt(true);
      setShowNewPlanModal(false);
      return;
    }

    const newPlanId = generatePlanId();
    const seededCollections = createTemplatePlanCollections(formData.template, newPlanId);
    const newMarriage = {
      id: newPlanId,
      bride: formData.bride,
      groom: formData.groom,
      date: formData.date,
      venue: formData.venue,
      guests: formData.guests,
      budget: formData.budget,
      template: formData.template,
      websiteSettings: { ...DEFAULT_WEBSITE_SETTINGS },
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

    if (authMode === "google" && authToken) {
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

    if (authMode === "google" && authToken) {
      try {
        const response = await addPlanCollaborator(authToken, { planId: targetPlanId, email, role, plannerOwnerId });
        const next = Array.isArray(response.collaborators) ? response.collaborators : [];
        syncPlanCollaborators(targetPlanId, next);
        await refreshAccessibleWorkspaces(authToken);
      } catch (err) {
        if (err.message && err.message.includes("Premium")) {
          setUpgradePromptMessage("Collaborators require a Premium or Studio subscription.");
          setShowUpgradePrompt(true);
        } else {
          throw err;
        }
      }
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

    if (authMode === "google" && authToken) {
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

    if (authMode === "google" && authToken) {
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
      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);

      if (!rawSession) {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const session = JSON.parse(rawSession);

        if (session.mode === "demo") {
          const savedPlanner = JSON.parse(localStorage.getItem(DEMO_PLANNER_STORAGE_KEY) || "null");
          if (!cancelled) {
            setAuthMode("demo");
            setUser(session.user || null);
            applyPlanner(savedPlanner || createDemoPlanner());
            setScreen("splash");
          }
          return;
        }

        if (session.mode === "google" && session.token) {
          const { planner, access, plannerOwnerId: resolvedOwnerId } = await fetchPlanner(session.token, session.plannerOwnerId);
          if (!cancelled) {
            setAuthMode("google");
            setAuthToken(session.token);
            setUser(session.user || null);
            applyPlanner(planner, access);
            setPlannerOwnerId(resolvedOwnerId || session.plannerOwnerId || session.user?.id || "");
            await refreshAccessibleWorkspaces(session.token);
            await fetchAndApplySubscription(session.token);
            setScreen("app");
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
  }, [applyPlanner]);

  useEffect(() => {
    if (isBootstrapping || !authToken) {
      return undefined;
    }

    const planner = {
      marriages,
      activePlanId,
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

    if (authMode !== "google" || !authToken) {
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
          syncWebsiteSlugsFromPlanner(response.planner);
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
  }, [authMode, authToken, expenses, events, guests, isBootstrapping, tasks, vendors, wedding, marriages, activePlanId, planAccess.canEdit, plannerOwnerId]);

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
    setTab("home");
    setScreen("splash");
  }

  function handleGoToHome() {
    window.location.assign("/home");
  }

  async function handleGoogleLoginSuccess(credentialResponse) {
    try {
      setIsLoggingIn(true);
      setLoginError("");
      const { token, user: authenticatedUser, planner, access, plannerOwnerId: resolvedOwnerId } = await loginWithGoogle(credentialResponse.credential);

      setAuthMode("google");
      setAuthToken(token);
      setUser(authenticatedUser);
      applyPlanner(planner, access);
      setPlannerOwnerId(resolvedOwnerId || authenticatedUser.id || "");
      persistSession({ mode: "google", token, user: authenticatedUser, plannerOwnerId: resolvedOwnerId || authenticatedUser.id || "" });
      await refreshAccessibleWorkspaces(token);
      await fetchAndApplySubscription(token);
      setTab("home");
      setSaveState("idle");
      setScreen("app");
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

  function handleLogout() {
    clearStoredSession();
    setUser(null);
    setAuthMode(null);
    setAuthToken("");
    setPlannerOwnerId("");
    setAccessibleWorkspaces([]);
    applyPlanner(createBlankPlanner());
    setTab("home");
    setSaveState("idle");
    setScreen("login");
  }

  async function handleDeleteAccount() {
    await deleteAccount(authToken);
    clearStoredSession();
    setUser(null);
    setAuthMode(null);
    setAuthToken("");
    setPlannerOwnerId("");
    setAccessibleWorkspaces([]);
    applyPlanner(createBlankPlanner());
    setTab("home");
    setSaveState("idle");
    setScreen("login");
  }

  function handleOnboardComplete(answers) {
    const selectedTemplate = answers?.template || "blank";
    const seededCollections = createTemplatePlanCollections(selectedTemplate, activePlanId);
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
    setScreen("app");
  }

  function handleSkipOnboarding() {
    applyWeddingToActivePlan({ ...EMPTY_WEDDING });
    setScreen("app");
  }

  function openWeddingDetailsEditor() {
    setWeddingDetailsForm({
      date: wedding.date || "",
      venue: wedding.venue || "",
    });
    setShowWeddingDetailsEditor(true);
  }

  function closeWeddingDetailsEditor() {
    setShowWeddingDetailsEditor(false);
  }

  function openAccountSettings() {
    setShowAccountSettings(true);
  }

  function closeAccountSettings() {
    setShowAccountSettings(false);
  }

  function openTermsModal() {
    setShowTermsModal(true);
  }

  function closeTermsModal() {
    setShowTermsModal(false);
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
      date: weddingDetailsForm.date,
      venue: weddingDetailsForm.venue,
    };

    setWedding(current => ({
      ...current,
      date: weddingDetailsForm.date,
      venue: weddingDetailsForm.venue,
    }));
    setMarriages(current => current.map(plan => (
      plan.id === activePlanId
        ? { ...plan, date: nextWedding.date, venue: nextWedding.venue }
        : plan
    )));
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
            <div className="login-logo">🪔</div>
            <h1 className="login-title">Loading your planner</h1>
            <p className="login-subtitle">Checking your saved session and wedding data.</p>
          </div>
        </div>
      </div>
    );
  }

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "";
  const accountName = (user?.name || "Account").trim() || "Account";
  const accountFirstName = accountName.split(/\s+/)[0] || accountName;
  const showOauthHelp = /invalid_client|no registered origin|origin.*not.*allowed|idpiframe/i.test(loginError);

  return (
    <div className="app-shell">
      {screen === "login" && (
        <>
          <LoginScreen
            onGoogleLogin={handleGoogleLoginSuccess}
            onDemoLogin={handleDemoLogin}
            onGoToHome={handleGoToHome}
            onLoginError={handleLoginError}
            isLoggingIn={isLoggingIn}
            errorMessage={loginError}
            showOauthHelp={showOauthHelp}
          />
          <LegalFooter
            hasBottomNav={false}
            onOpenTerms={openTermsModal}
            onOpenFeedback={openFeedbackModal}
          />
        </>
      )}
      {screen === "splash" && (
        <SplashScreen
          onStart={() => setScreen(hasWeddingProfile(wedding) ? "app" : "onboard")}
          onSkip={handleSkipOnboarding}
          showSkip={!hasWeddingProfile(wedding)}
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
            <div className="top-bar-meta">
              {wedding.date && <button type="button" className="top-bar-chip top-bar-chip-button" onClick={openWeddingDetailsEditor}>📅 {wedding.date}</button>}
              {wedding.venue && <button type="button" className="top-bar-chip top-bar-chip-button" onClick={openWeddingDetailsEditor}>📍 {wedding.venue}</button>}
              {authMode === "google" && saveLabel && <div className="top-bar-chip">☁️ {saveLabel}</div>}
              {authMode === "google" && !planAccess.canEdit && <div className="top-bar-chip">View only</div>}
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
            {tab==="events" && <EventsScreen events={activeEvents} setEvents={setActiveEvents} expenses={activeExpenses} setExpenses={setActiveExpenses} planId={activePlanId} websitePath={activeWeddingWebsitePath} websiteSettings={activeMarriage?.websiteSettings || DEFAULT_WEBSITE_SETTINGS} onSaveWebsiteSettings={updateActiveMarriageWebsiteSettings} onOpenBudget={() => setTab("budget")} initialEditingEventId={eventToEditId}/>}
            {tab==="budget" && <BudgetScreen expenses={activeExpenses} setExpenses={setActiveExpenses} wedding={wedding} events={activeEvents} planId={activePlanId}/>} 
            {tab==="guests" && <GuestsScreen guests={activeGuests} setGuests={setActiveGuests} planId={activePlanId}/>} 
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
            onOpenTerms={openTermsModal}
            onOpenFeedback={openFeedbackModal}
          />

          {showAccountSettings && (
            <AccountScreen
              user={user}
              authMode={authMode}
              wedding={wedding}
              setWedding={setWedding}
              subscription={subscription}
              authToken={authToken}
              onClose={closeAccountSettings}
              onLogout={() => { closeAccountSettings(); handleLogout(); }}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
          {showTermsModal && <TermsConditionsModal onClose={closeTermsModal} />}
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
                  href="/home#pricing"
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
                <div className="modal-title">Edit Wedding Details</div>
                <div className="input-group">
                  <div className="input-label">Main Wedding Day</div>
                  <input
                    className="input-field"
                    value={weddingDetailsForm.date}
                    onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, date: event.target.value })}
                    placeholder="e.g. 25 November 2027 (for countdown)"
                  />
                </div>
                <div className="input-group">
                  <div className="input-label">Venue / Location</div>
                  <input
                    className="input-field"
                    value={weddingDetailsForm.venue}
                    onChange={(event) => setWeddingDetailsForm({ ...weddingDetailsForm, venue: event.target.value })}
                    placeholder="e.g. Jaipur Palace Grounds"
                  />
                </div>
                <button className="btn-primary" onClick={saveWeddingDetails}>Save Details</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
