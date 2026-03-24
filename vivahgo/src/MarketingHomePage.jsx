import { useEffect, useState } from "react";
import "./marketing-home.css";
import TermsConditionsModal from "./components/TermsConditionsModal";
import FeedbackModal from "./components/FeedbackModal";
import LegalFooter from "./components/LegalFooter";
import GoogleLoginButton from "./components/GoogleLoginButton";
import SubscriptionCheckoutSheet from "./components/SubscriptionCheckoutSheet";
import SubscriptionCheckoutPage from "./components/SubscriptionCheckoutPage";
import { confirmCheckoutPayment, createCheckoutSession, getCheckoutQuote, loginWithGoogle } from "./api";

const SESSION_STORAGE_KEY = "vivahgo.session";

const featureGroups = [
  {
    eyebrow: "Plan Together",
    title: "Shared timelines for every ceremony and task",
    description: "Keep families, partners, and planners aligned with one view of events, responsibilities, and key deadlines.",
  },
  {
    eyebrow: "Budget Control",
    title: "See spending before it becomes stressful",
    description: "Track categories, compare actuals against budget, and catch overspending early instead of after vendor payments pile up.",
  },
  {
    eyebrow: "Guest Flow",
    title: "Manage lists, groups, and RSVPs with context",
    description: "Organize guest details by event, family, or priority so invitations and headcounts stay accurate across functions.",
  },
  {
    eyebrow: "Vendor Hub",
    title: "Store contacts, notes, and decisions in one place",
    description: "Keep decorators, caterers, photographers, and venue discussions attached to your plan instead of buried across chats.",
  },
  {
    eyebrow: "Collaborator Access",
    title: "Let the right people edit the right plan",
    description: "Share a wedding workspace with owners, editors, or viewers so coordination stays secure and intentional.",
  },
  {
    eyebrow: "Live Persistence",
    title: "Return to your planner exactly where you left off",
    description: "Use demo mode for quick exploration or Google sign-in for saved planner data that follows you across sessions.",
  },
];

const plans = [
  {
    name: "Starter",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "For couples exploring the workflow before locking in their planning stack.",
    features: ["1 wedding workspace", "Core budget, tasks, guest, and vendor tracking", "Demo planner access", "Google sign-in"],
  },
  {
    name: "Premium",
    monthlyPrice: 2000,
    yearlyPrice: 1600,
    description: "For active planning with shared ownership, faster coordination, and a cleaner handoff to families.",
    features: ["Everything in Starter, plus:", "Multiple wedding workspaces", "Collaborator permissions", "Priority planner sync"],
    featured: true,
  },
  {
    name: "Studio",
    monthlyPrice: 5000,
    yearlyPrice: 4000,
    description: "For professional agencies and power planners.",
    features: ["Everything in Premium, plus:", "Client-ready workspaces", "Team collaboration", "Admin visibility across plans"],
  },
];

const faqs = [
  {
    question: "Can I try VivahGo before signing in?",
    answer: "Yes. The planner supports a demo mode with seeded wedding data so you can inspect the workflow before connecting a Google account.",
  },
  {
    question: "What happens after I sign in with Google?",
    answer: "VivahGo creates or restores your account, loads your planner, and keeps future changes synced to your saved workspace.",
  },
  {
    question: "Can multiple people manage the same wedding plan?",
    answer: "Yes. Shared plans support collaborator access so owners can grant editor or viewer permissions to family members or planning partners.",
  },
  {
    question: "Does VivahGo work for weddings with multiple ceremonies?",
    answer: "Yes. You can structure events, tasks, guests, and vendor details across the full wedding timeline instead of forcing everything into one day.",
  },
  {
    question: "Is the Premium plan required to keep my planner saved?",
    answer: "No. Saved planning with Google sign-in works on the free tier. Premium is positioned for heavier collaboration and multi-workspace usage.",
  },
];

const socialLinks = [
  { name: "Instagram", href: "https://www.instagram.com/", label: "Follow VivahGo on Instagram" },
  { name: "YouTube", href: "https://www.youtube.com/", label: "Watch VivahGo on YouTube" },
  { name: "LinkedIn", href: "https://www.linkedin.com/", label: "Connect with VivahGo on LinkedIn" },
];

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readCheckoutRouteFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") !== "1") {
    return null;
  }

  const plan = params.get("plan") === "studio" ? "studio" : "premium";
  const billingCycle = params.get("cycle") === "yearly" ? "yearly" : "monthly";
  const couponCode = (params.get("coupon") || "").trim().toUpperCase();

  return {
    plan,
    billingCycle,
    couponCode,
  };
}

function SocialIcon({ name }) {
  if (name === "Instagram") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76c-.198.509-.333 1.09-.371 1.943C.01 5.556 0 5.829 0 8c0 2.172.01 2.444.048 3.297.038.853.173 1.434.37 1.943.205.526.478.972.924 1.417.445.446.891.719 1.417.923.509.198 1.09.333 1.943.371C5.556 15.99 5.829 16 8 16s2.444-.01 3.297-.048c.852-.038 1.433-.173 1.943-.371a3.9 3.9 0 0 0 1.417-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.37-1.943C15.99 10.444 16 10.171 16 8s-.01-2.444-.048-3.297c-.038-.852-.173-1.433-.37-1.943a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.091-.333-1.943-.371C10.444.01 10.171 0 8 0Zm0 1.442c2.136 0 2.389.008 3.232.046.78.035 1.204.166 1.486.275.373.145.639.318.919.598.279.279.453.545.598.919.109.282.24.706.275 1.486.038.843.046 1.096.046 3.232 0 2.136-.008 2.389-.046 3.232-.035.78-.166 1.204-.275 1.486a2.47 2.47 0 0 1-.598.919 2.47 2.47 0 0 1-.919.598c-.282.109-.706.24-1.486.275-.843.038-1.096.046-3.232.046-2.136 0-2.389-.008-3.232-.046-.78-.035-1.204-.166-1.486-.275a2.47 2.47 0 0 1-.919-.598 2.47 2.47 0 0 1-.598-.919c-.109-.282-.24-.706-.275-1.486C1.45 10.389 1.442 10.136 1.442 8c0-2.136.008-2.389.046-3.232.035-.78.166-1.204.275-1.486.145-.373.318-.639.598-.919.279-.28.545-.453.919-.598.282-.109.706-.24 1.486-.275.843-.038 1.096-.046 3.232-.046Z" />
        <path d="M8 3.892A4.108 4.108 0 1 0 8 12.108 4.108 4.108 0 0 0 8 3.892Zm0 6.774A2.666 2.666 0 1 1 8 5.334a2.666 2.666 0 0 1 0 5.332Z" />
        <circle cx="12.305" cy="3.695" r="0.96" />
      </svg>
    );
  }

  if (name === "YouTube") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8.051 1.999h-.089C4.926 1.999 3 2.156 3 2.156s-1.968.197-2.48 2.03C0 5.147 0 8 0 8s0 2.853.52 3.814c.512 1.833 2.48 2.03 2.48 2.03S4.926 14 7.962 14h.089c3.036 0 4.962-.156 4.962-.156s1.968-.197 2.48-2.03C16 10.853 16 8 16 8s0-2.853-.52-3.814c-.512-1.833-2.48-2.03-2.48-2.03S11.074 2 8.038 2h.013Z" />
        <path d="m6.545 5.636 4.364 2.364-4.364 2.364V5.636Z" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175A1.146 1.146 0 0 1 0 14.854V1.146Zm4.943 12.248V6.169H2.542v7.225h2.401Zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.539-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016Zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4Z" />
    </svg>
  );
}

export default function MarketingHomePage() {
  const [session, setSession] = useState(() => readStoredSession());
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState(null);
  const [checkoutSheetPlan, setCheckoutSheetPlan] = useState(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState(null);
  const [showLoginBeforePlanModal, setShowLoginBeforePlanModal] = useState(false);
  const [planLoginLoading, setPlanLoginLoading] = useState(false);
  const [planLoginError, setPlanLoginError] = useState("");
  const [subscriptionBanner, setSubscriptionBanner] = useState(null);
  const [checkoutRoute, setCheckoutRoute] = useState(() => readCheckoutRouteFromUrl());

  useEffect(() => {
    const syncSession = () => {
      setSession(readStoredSession());
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncSession();
      }
    };

    document.title = "VivahGo | Home";
    syncSession();

    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCheckoutRoute(readCheckoutRouteFromUrl());
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const isSignedIn = Boolean(session?.mode && (session?.user || session?.token));
  const isYearlyBilling = billingCycle === "yearly";
  const firstName = session?.user?.given_name || session?.user?.name?.split(" ")[0] || "there";
  const primaryCtaLabel = isSignedIn ? "Open Your Planner" : "Login / Signup";

  function handleChoosePlan(planName) {
    const planKey = planName.toLowerCase();
    if (!isSignedIn) {
      setPendingPlanSelection({ key: planKey, name: planName });
      setPlanLoginError("");
      setShowLoginBeforePlanModal(true);
      return;
    }

    const token = session?.token;
    if (!token) {
      setPendingPlanSelection({ key: planKey, name: planName });
      setPlanLoginError("");
      setShowLoginBeforePlanModal(true);
      return;
    }

    setCheckoutSheetPlan({
      key: planKey,
      name: planName,
      token,
    });
  }

  async function handlePlanLoginSuccess(credentialResponse) {
    try {
      setPlanLoginLoading(true);
      setPlanLoginError("");

      const { token, user, plannerOwnerId } = await loginWithGoogle(credentialResponse.credential);
      const nextSession = {
        mode: "google",
        token,
        user,
        plannerOwnerId: plannerOwnerId || user?.id || "",
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      }

      setSession(nextSession);
      setShowLoginBeforePlanModal(false);

      if (pendingPlanSelection) {
        setCheckoutSheetPlan({
          key: pendingPlanSelection.key,
          name: pendingPlanSelection.name,
          token,
        });
      }

      setPendingPlanSelection(null);
    } catch (error) {
      setPlanLoginError(error.message || "Google login failed. Please try again.");
    } finally {
      setPlanLoginLoading(false);
    }
  }

  function handlePlanLoginError(error) {
    setPlanLoginError(error?.message || "Google login failed. Please try again.");
  }

  function openCheckoutPage(nextCheckout) {
    const checkoutState = {
      plan: nextCheckout.plan,
      billingCycle: nextCheckout.billingCycle,
      couponCode: (nextCheckout.couponCode || "").trim().toUpperCase(),
    };
    const params = new URLSearchParams();
    params.set("checkout", "1");
    params.set("plan", checkoutState.plan);
    params.set("cycle", checkoutState.billingCycle);
    if (checkoutState.couponCode) {
      params.set("coupon", checkoutState.couponCode);
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", nextUrl);
    setCheckoutSheetPlan(null);
    setCheckoutLoadingPlan(null);
    setCheckoutRoute(checkoutState);
  }

  function closeCheckoutPage() {
    window.history.pushState({}, "", window.location.pathname);
    setCheckoutRoute(null);
  }

  if (checkoutRoute) {
    return (
      <SubscriptionCheckoutPage
        token={session?.token}
        initialPlan={checkoutRoute.plan}
        initialBillingCycle={checkoutRoute.billingCycle}
        initialCouponCode={checkoutRoute.couponCode}
        fetchQuote={getCheckoutQuote}
        createSession={createCheckoutSession}
        confirmPayment={confirmCheckoutPayment}
        onBack={closeCheckoutPage}
        onError={(message) => {
          setSubscriptionBanner({ type: "error", message });
        }}
        onSuccess={() => {
          setSubscriptionBanner({ type: "success", message: "Payment received. Your plan is now active." });
          closeCheckoutPage();
        }}
      />
    );
  }

  return (
    <div className="marketing-home-shell">
      {subscriptionBanner && (
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          padding: "12px 24px", textAlign: "center",
          fontSize: 14, fontWeight: 600,
          background: subscriptionBanner.type === "success"
            ? "rgba(46,125,50,0.92)"
            : subscriptionBanner.type === "error"
              ? "rgba(183,28,28,0.92)"
              : "rgba(30,60,114,0.92)",
          color: "#fff",
          backdropFilter: "blur(6px)",
        }}>
          {subscriptionBanner.message}
          <button
            type="button"
            onClick={() => setSubscriptionBanner(null)}
            style={{
              marginLeft: 16, background: "transparent", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1,
            }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}
      <header className="marketing-header">
        <a className="marketing-brand" href="/home" aria-label="VivahGo home page">
          <img src="/Thumbnail.png" alt="VivahGo" className="marketing-brand-mark" />
        </a>

        <nav className="marketing-nav" aria-label="Homepage sections">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faqs">FAQs</a>
          <a href="#social">Social</a>
        </nav>

        <div className="marketing-auth">
          {isSignedIn && <span className="marketing-auth-badge">Signed in as {firstName}</span>}
          <a className="marketing-auth-button" href="/">
            {primaryCtaLabel}
          </a>
        </div>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Wedding planning for modern families and busy calendars</p>
            <h1>One home base for events, guests, vendors, budgets, and shared decisions.</h1>
            <p className="marketing-summary">
              VivahGo gives couples and collaborators a clear planning system that stays organized from the first idea to the final celebration.
            </p>

            <div className="marketing-hero-actions">
              <a className="marketing-primary-action" href="/">
                {isSignedIn ? "Continue Planning" : "Start Planning"}
              </a>
              <a className="marketing-secondary-action" href="#pricing">
                View Premium Plans
              </a>
            </div>

            <div className="marketing-proof-strip" aria-label="VivahGo highlights">
              <div>
                <strong>Tasks and events</strong>
                <span>Coordinate every ceremony and milestone</span>
              </div>
              <div>
                <strong>Shared planning</strong>
                <span>Invite partners, families, and editors</span>
              </div>
              <div>
                <strong>Budget visibility</strong>
                <span>Track every rupee and every vendor decision</span>
              </div>
            </div>
          </div>

          <div className="marketing-hero-panel" aria-label="VivahGo overview">
            <div className="marketing-panel-card marketing-panel-primary">
              <span className="marketing-panel-label">Planner Overview</span>
              <h2>Built for the full wedding journey</h2>
              <ul>
                <li>Central dashboard with upcoming events and progress</li>
                <li>Budget tracking aligned with your wedding profile</li>
                <li>Guest, vendor, and task management in one workflow</li>
              </ul>
            </div>

            <div className="marketing-panel-stack">
              <article className="marketing-panel-card">
                <span className="marketing-panel-metric">Multi-plan support</span>
                <p>Manage more than one wedding workspace without duplicating setup work.</p>
              </article>
              <article className="marketing-panel-card">
                <span className="marketing-panel-metric">Google sign-in</span>
                <p>Restore your saved plan on return and keep collaboration tied to a real account.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="features">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Features</p>
            <h2>Everything your wedding operation needs in one place</h2>
            <p>
              The planner stays focused on execution: what is happening, who owns it, what it costs, and what still needs attention.
            </p>
          </div>

          <div className="marketing-feature-grid">
            {featureGroups.map((feature) => (
              <article className="marketing-feature-card" key={feature.title}>
                <p className="marketing-feature-eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section-band">
          <div className="marketing-band-copy">
            <p className="marketing-section-kicker">Why Couples Use It</p>
            <h2>Less context switching. Fewer missed details. Better handoffs.</h2>
            <p>
              Instead of juggling notes, chats, spreadsheets, and vendor messages across different places, VivahGo keeps the wedding plan structured and visible.
            </p>
          </div>

          <div className="marketing-band-points">
            <div>
              <strong>Faster coordination</strong>
              <span>Everyone sees the same plan instead of asking for status in separate threads.</span>
            </div>
            <div>
              <strong>Cleaner decision history</strong>
              <span>Budgets, vendor notes, and tasks stay attached to the wedding instead of disappearing in chat scrollback.</span>
            </div>
            <div>
              <strong>Safer collaboration</strong>
              <span>Role-based access makes it easier to share plans without giving every participant full control.</span>
            </div>
          </div>
        </section>

        <section className="marketing-section" id="pricing">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Premium Plans</p>
            <div className="marketing-billing-toggle" role="group" aria-label="Billing period">
              <button
                type="button"
                className={`marketing-billing-option${!isYearlyBilling ? " marketing-billing-option-active" : ""}`}
                onClick={() => setBillingCycle("monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`marketing-billing-option${isYearlyBilling ? " marketing-billing-option-active" : ""}`}
                onClick={() => setBillingCycle("yearly")}
              >
                Yearly <span>Save 20%</span>
              </button>
            </div>
            <h2>Pricing that scales from one wedding to a planning studio</h2>
            <p>Start free, then move into premium collaboration when the wedding plan needs more structure and more people involved.</p>
          </div>

          <div className="marketing-pricing-grid">
            {plans.map((plan) => (
              <article className={`marketing-price-card${plan.featured ? " marketing-price-card-featured" : ""}`} key={plan.name}>
                {plan.featured && <span className="marketing-price-ribbon">Most Popular</span>}
                <h3>{plan.name}</h3>
                <p className="marketing-price-value">
                  <strong>
                    {(isYearlyBilling ? plan.yearlyPrice : plan.monthlyPrice) === 0 ? (
                      "Free"
                    ) : (
                      <>
                        <span className="marketing-price-currency">₹</span>
                        {(isYearlyBilling ? plan.yearlyPrice : plan.monthlyPrice).toLocaleString("en-IN")}
                      </>
                    )}
                  </strong>
                  <span>{(isYearlyBilling ? plan.yearlyPrice : plan.monthlyPrice) === 0 ? "forever" : "/month"}</span>
                </p>
                {isYearlyBilling && (isYearlyBilling ? plan.yearlyPrice : plan.monthlyPrice) !== 0 && (
                  <span className="marketing-price-billed-yearly">Billed Yearly</span>
                )}
                <p className="marketing-price-description">{plan.description}</p>
                <ul>
                  {plan.features.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {plan.name === "Starter" ? (
                  <a
                    className="marketing-price-action marketing-price-action-ghost"
                    href="/"
                  >
                    Try Starter
                  </a>
                ) : (
                  <button
                    type="button"
                    className={`marketing-price-action ${plan.featured ? "marketing-price-action-featured" : "marketing-price-action-ghost"}`}
                    onClick={() => handleChoosePlan(plan.name)}
                    disabled={checkoutLoadingPlan === plan.name.toLowerCase() || Boolean(checkoutSheetPlan) || Boolean(checkoutRoute)}
                    style={checkoutLoadingPlan === plan.name.toLowerCase() || checkoutSheetPlan || checkoutRoute ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
                  >
                    {checkoutLoadingPlan === plan.name.toLowerCase() ? "Loading checkout..." : `Get ${plan.name}`}
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section" id="faqs">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">FAQs</p>
            <h2>Common questions before you start planning</h2>
          </div>

          <div className="marketing-faq-list">
            {faqs.map((item) => (
              <details className="marketing-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="marketing-footer" id="social">
        <div className="marketing-footer-copy">
          <p className="marketing-section-kicker">Social Media</p>
          <h2>Keep up with VivahGo</h2>
          <p>Follow the product across social channels for updates, release notes, and planning inspiration.</p>
        </div>

        <div className="marketing-social-links">
          {socialLinks.map((link) => (
            <a key={link.name} href={link.href} target="_blank" rel="noreferrer" aria-label={link.label} className="marketing-social-link">
              <span className="marketing-social-icon">
                <SocialIcon name={link.name} />
              </span>
              <span>{link.name}</span>
            </a>
          ))}
        </div>
      </footer>

      <LegalFooter
        className="marketing-legal-footer"
        hasBottomNav={false}
        onOpenTerms={() => setShowTermsModal(true)}
        onOpenFeedback={() => setShowFeedbackModal(true)}
      />

      {showLoginBeforePlanModal && (
        <div className="marketing-login-overlay" onClick={() => {
          if (!planLoginLoading) {
            setShowLoginBeforePlanModal(false);
            setPendingPlanSelection(null);
            setPlanLoginError("");
          }
        }} role="presentation">
          <div className="marketing-login-dialog" role="dialog" aria-modal="true" aria-label="Sign in to choose a premium plan" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="marketing-login-close"
              onClick={() => {
                if (!planLoginLoading) {
                  setShowLoginBeforePlanModal(false);
                  setPendingPlanSelection(null);
                  setPlanLoginError("");
                }
              }}
              aria-label="Close login prompt"
              disabled={planLoginLoading}
            >
              x
            </button>

            <p className="marketing-login-kicker">Sign in required</p>
            <h3>Continue with Google before choosing a premium plan</h3>
            <p>
              {pendingPlanSelection ? `You selected ${pendingPlanSelection.name}.` : "Sign in to continue with checkout."}
            </p>

            <div className="marketing-login-google-wrap">
              <GoogleLoginButton
                onLoginSuccess={handlePlanLoginSuccess}
                onLoginError={handlePlanLoginError}
              />
            </div>

            {planLoginLoading && <p className="marketing-login-status">Signing you in...</p>}
            {planLoginError && <p className="marketing-login-error">{planLoginError}</p>}

            <button
              type="button"
              className="marketing-price-action marketing-price-action-ghost marketing-login-cancel"
              onClick={() => {
                if (!planLoginLoading) {
                  setShowLoginBeforePlanModal(false);
                  setPendingPlanSelection(null);
                  setPlanLoginError("");
                }
              }}
              disabled={planLoginLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {checkoutSheetPlan && (
        <SubscriptionCheckoutSheet
          token={checkoutSheetPlan.token}
          plan={checkoutSheetPlan.key}
          planName={checkoutSheetPlan.name}
          billingCycle={billingCycle}
          onPlanChange={(nextPlanKey, nextPlanName) => {
            setCheckoutSheetPlan((current) => {
              if (!current) {
                return current;
              }

              return {
                ...current,
                key: nextPlanKey,
                name: nextPlanName,
              };
            });
          }}
          onBillingCycleChange={setBillingCycle}
          onReady={() => setCheckoutLoadingPlan(null)}
          onLoadingStart={() => setCheckoutLoadingPlan(checkoutSheetPlan.key)}
          onClose={() => {
            setCheckoutLoadingPlan(null);
            setCheckoutSheetPlan(null);
          }}
          onError={(message) => {
            setCheckoutLoadingPlan(null);
            setSubscriptionBanner({ type: "error", message });
          }}
          onProceed={({ plan, billingCycle: nextBillingCycle, couponCode }) => {
            openCheckoutPage({
              plan,
              billingCycle: nextBillingCycle,
              couponCode,
            });
          }}
          fetchQuote={getCheckoutQuote}
        />
      )}

      {showTermsModal && <TermsConditionsModal onClose={() => setShowTermsModal(false)} />}
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}