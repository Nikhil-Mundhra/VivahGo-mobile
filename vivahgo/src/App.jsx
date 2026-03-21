import { useEffect, useRef, useState } from "react";
import "./styles.css";
import SplashScreen from "./components/SplashScreen";
import OnboardingScreen from "./components/OnboardingScreen";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import EventsScreen from "./components/EventsScreen";
import BudgetScreen from "./components/BudgetScreen";
import GuestsScreen from "./components/GuestsScreen";
import VendorsScreen from "./components/VendorsScreen";
import TasksScreen from "./components/TasksScreen";
import { NAV_ITEMS } from "./constants";
import { fetchPlanner, loginWithGoogle, savePlanner } from "./api";
import { createBlankPlanner, createDemoPlanner, hasWeddingProfile, normalizePlanner } from "./plannerDefaults";

const SESSION_STORAGE_KEY = "vivahgo.session";
const DEMO_PLANNER_STORAGE_KEY = "vivahgo.demoPlanner";

export default function VivahGoApp() {
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

  const saveTimerRef = useRef(null);

  function applyPlanner(nextPlanner) {
    const planner = normalizePlanner(nextPlanner);
    setWedding(planner.wedding);
    setEvents(planner.events);
    setExpenses(planner.expenses);
    setGuests(planner.guests);
    setVendors(planner.vendors);
    setTasks(planner.tasks);
  }

  function persistSession(session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  function clearStoredSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(DEMO_PLANNER_STORAGE_KEY);
  }

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
          const { planner } = await fetchPlanner(session.token);
          if (!cancelled) {
            setAuthMode("google");
            setAuthToken(session.token);
            setUser(session.user || null);
            applyPlanner(planner);
            setScreen("splash");
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
  }, []);

  useEffect(() => {
    if (isBootstrapping) {
      return undefined;
    }

    const planner = normalizePlanner({ wedding, events, expenses, guests, vendors, tasks });

    if (authMode === "demo") {
      localStorage.setItem(DEMO_PLANNER_STORAGE_KEY, JSON.stringify(planner));
      return undefined;
    }

    if (authMode !== "google" || !authToken) {
      return undefined;
    }

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaveState("saving");
        await savePlanner(authToken, planner);
        setSaveState("saved");
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveState("error");
      }
    }, 500);

    return () => {
      clearTimeout(saveTimerRef.current);
    };
  }, [authMode, authToken, expenses, events, guests, isBootstrapping, tasks, vendors, wedding]);

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
    persistSession({ mode: "demo", user: demoUser });
    localStorage.setItem(DEMO_PLANNER_STORAGE_KEY, JSON.stringify(demoPlanner));
    setLoginError("");
    setTab("home");
    setScreen("splash");
  }

  async function handleGoogleLoginSuccess(credentialResponse) {
    try {
      setIsLoggingIn(true);
      setLoginError("");
      const { token, user: authenticatedUser, planner } = await loginWithGoogle(credentialResponse.credential);

      setAuthMode("google");
      setAuthToken(token);
      setUser(authenticatedUser);
      applyPlanner(planner);
      persistSession({ mode: "google", token, user: authenticatedUser });
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

  function handleLogout() {
    clearStoredSession();
    setUser(null);
    setAuthMode(null);
    setAuthToken("");
    applyPlanner(createBlankPlanner());
    setTab("home");
    setSaveState("idle");
    setScreen("login");
  }

  function handleOnboardComplete(answers) {
    setWedding(answers);
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

  function saveWeddingDetails() {
    setWedding(current => ({
      ...current,
      date: weddingDetailsForm.date,
      venue: weddingDetailsForm.venue,
    }));
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

  return (
    <div className="app-shell">
      {screen === "login" && (
        <LoginScreen
          onGoogleLogin={handleGoogleLoginSuccess}
          onDemoLogin={handleDemoLogin}
          onLoginError={handleLoginError}
          isLoggingIn={isLoggingIn}
          errorMessage={loginError}
        />
      )}
      {screen === "splash" && <SplashScreen onStart={() => setScreen(hasWeddingProfile(wedding) ? "app" : "onboard")} />}
      {screen === "onboard" && <OnboardingScreen onComplete={handleOnboardComplete} />}
      {screen === "app" && (
        <div className="main-app">
          {/* Top Bar */}
          <div className="top-bar">
            <div className="top-bar-pattern">🪔</div>
            <div className="top-bar-greeting">Your Wedding</div>
            <div className="top-bar-names">
              {wedding.bride || "Bride"} & {wedding.groom || "Groom"}
            </div>
            <div className="top-bar-meta">
              {wedding.date && <button type="button" className="top-bar-chip top-bar-chip-button" onClick={openWeddingDetailsEditor}>📅 {wedding.date}</button>}
              {wedding.venue && <button type="button" className="top-bar-chip top-bar-chip-button" onClick={openWeddingDetailsEditor}>📍 {wedding.venue}</button>}
              {authMode === "google" && saveLabel && <div className="top-bar-chip">☁️ {saveLabel}</div>}
            </div>
            <div className="top-bar-user">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user?.name}
                  className="user-avatar"
                  onClick={handleLogout}
                  title="Click to logout"
                />
              ) : (
                <button className="user-avatar user-avatar-fallback" onClick={handleLogout} title="Click to logout">
                  {(user?.name || "V").slice(0, 1).toUpperCase()}
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="content-area">
            {tab==="home" && <Dashboard wedding={wedding} events={events} expenses={expenses} guests={guests} budget={wedding.budget} onTabChange={setTab} onEditEvent={openEventEditorFromCalendar}/>}
            {tab==="events" && <EventsScreen events={events} setEvents={setEvents} expenses={expenses} onOpenBudget={() => setTab("budget")} initialEditingEventId={eventToEditId}/>}
            {tab==="budget" && <BudgetScreen expenses={expenses} setExpenses={setExpenses} wedding={wedding} events={events}/>} 
            {tab==="guests" && <GuestsScreen guests={guests} setGuests={setGuests}/>}
            {tab==="vendors" && <VendorsScreen vendors={vendors} setVendors={setVendors}/>}
            {tab==="tasks" && <TasksScreen tasks={tasks} setTasks={setTasks} events={events}/>}
          </div>

          {/* Bottom Nav */}
          <div className="bottom-nav">
            {NAV_ITEMS.map(n=>(
              <div key={n.id} className={`nav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id)}>
                <div className="nav-icon">{n.icon}</div>
                <div className="nav-label">{n.label}</div>
                {tab===n.id && <div className="nav-active-dot"/>}
              </div>
            ))}
          </div>

          {showWeddingDetailsEditor && (
            <div className="modal-overlay" onClick={closeWeddingDetailsEditor}>
              <div className="modal" onClick={(event) => event.stopPropagation()}>
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
