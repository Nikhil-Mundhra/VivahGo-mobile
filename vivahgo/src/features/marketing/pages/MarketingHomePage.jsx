import { useEffect, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import GoogleLoginButton from "../../../components/GoogleLoginButton";
import LoadingBar from "../../../components/LoadingBar";
import SubscriptionCheckoutSheet from "../../../components/SubscriptionCheckoutSheet";
import SubscriptionCheckoutPage from "../../../components/SubscriptionCheckoutPage";
import Dashboard from "../../planner/screens/Dashboard";
import EventsScreen from "../../planner/screens/EventsScreen";
import BudgetScreen from "../../planner/screens/BudgetScreen";
import GuestsScreen from "../../planner/screens/GuestsScreen";
import { persistAuthSession, readAuthSession } from "../../../authStorage";
import { confirmCheckoutPayment, createCheckoutSession, getCheckoutQuote, getSubscriptionStatus } from "../api.js";
import { loginWithGoogle } from "../../auth/api.js";
import { createDemoPlanner } from "../../../plannerDefaults";
import { DEFAULT_SITE_URL, usePageSeo } from "../../../seo.js";
import { getMarketingUrl, getPlannerUrl } from "../../../siteUrls.js";
import { resolvePublicAssetUrl } from "../../../publicAssetUrls.js";
import seoKeywordLibrary from "../../../generated/seo-keywords.json";

const DEMO_PLANNER = createDemoPlanner();

const trustSignals = [
  "Used by early couples and planners across India",
  "Built for multi-event Indian weddings",
  "Guests, budgets, vendors, and timelines together",
];

const painPoints = [
  "Decisions get lost in chats",
  "No single source of truth",
  "Constant follow-ups waste time",
];

const benefitCards = [
  {
    title: "Everyone sees the same plan",
    description: "Couples, parents, and planners see the same plan without repeated updates.",
  },
  {
    title: "Nothing important slips through",
    description: "Track tasks, payments, guest details, and event timelines together.",
  },
  {
    title: "Budget stress shows up earlier",
    description: "Spot pending payments and overspending before they snowball.",
  },
  {
    title: "Planning feels calmer",
    description: "Fewer surprises. More headspace for the wedding itself.",
  },
];

const outcomes = [
  "Everyone stays aligned",
  "No missed payments or tasks",
  "Full visibility across events",
  "Less stress during planning",
];

const plannerAppCapabilityBuckets = [
  {
    label: "Plan",
    intro: "Structure the wedding early so every ceremony starts from the same playbook.",
    items: [
      {
        title: "Stay on top of every ceremony",
        description: "Use the wedding checklist app to track tasks, owners, and deadlines across every function.",
      },
      {
        title: "Keep the full timeline usable",
        description: "Map roka, mehndi, sangeet, haldi, wedding day, and reception in one connected timeline.",
      },
      {
        title: "Start faster with Indian wedding templates",
        description: "Use templates built for cultural ceremonies, stakeholders, and multi-event weddings.",
      },
    ],
  },
  {
    label: "Track",
    intro: "See the whole wedding in one dashboard, then go deeper where decisions are moving.",
    items: [
      {
        title: "Stay in control of your budget",
        description: "Use the wedding budget planner to compare planned vs actual spend before it becomes stress.",
      },
      {
        title: "Keep guest decisions current",
        description: "Track guests, RSVPs, family sides, and headcounts without juggling multiple sheets.",
      },
      {
        title: "See payments before they turn urgent",
        description: "Monitor vendor advances, due dates, and pending balances from one dashboard.",
      },
    ],
  },
  {
    label: "Coordinate",
    intro: "Keep people, vendors, and approvals aligned without repeated follow-ups.",
    items: [
      {
        title: "Run vendor work with less follow-up",
        description: "Use the wedding vendor manager to track bookings, deliverables, and event-day dependencies.",
      },
      {
        title: "Keep everyone on the same page",
        description: "Give couples, families, and planners one shared workspace instead of parallel versions.",
      },
    ],
  },
];

const differentiators = [
  "WhatsApp is for talking. It is terrible at keeping a wedding on track.",
  "Excel can store a plan. It cannot keep a family coordinated.",
  "VivahGo keeps the latest plan live, shared, and visible to the people who matter.",
];

const plans = [
  {
    name: "Starter",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Best for getting your wedding out of chats and into one clear workspace.",
    features: ["1 Unified Wedding Workspace", "Track and manage events, guest lists, budgets, and vendors", "Checklist & Progress Tracking", "WhatsApp Guest Reminders", "Culture-Specific Wedding Templates", "Invite Collaborators"],
  },
  {
    name: "Premium",
    monthlyPrice: 2000,
    yearlyPrice: 1600,
    description: "Best for active planning with more family involvement and tighter coordination.",
    features: ["Everything in Starter", "Unlimited Wedding Workspaces", "Personalized Wedding Website", "Real Scheduled Reminders", "Advanced workspace management"],
    featured: true,
  },
  {
    name: "Studio",
    monthlyPrice: 5000,
    yearlyPrice: 4000,
    description: "Best for planners and studios running multiple client weddings.",
    features: ["Everything in Premium", "Client-ready workspaces", "Create Custom Templates", "Request for upto 2 Custom Features"],
  },
];

const faqs = [
  {
    question: "Is VivahGo for couples or planners?",
    answer: "Both. Couples and families can run their own wedding here, and planners can use it to manage client coordination with more visibility.",
  },
  {
    question: "Can family members be involved without creating more confusion?",
    answer: "Yes. VivahGo is built for shared visibility, so people can stay involved without relying on scattered chats and repeated updates.",
  },
  {
    question: "When should we start using it?",
    answer: "As early as possible. It helps most before details spread across WhatsApp, notes, and spreadsheets.",
  },
  {
    question: "Does it replace WhatsApp completely?",
    answer: "Not necessarily. People may still message, but VivahGo becomes the place where the actual plan stays updated and trackable.",
  },
  {
    question: "Can it handle weddings with multiple ceremonies?",
    answer: "Yes. It is designed for Indian weddings with several events, many stakeholders, and lots of moving parts.",
  },
];

const socialLinks = [
  { name: "Instagram", href: "https://www.instagram.com/vivah.go/", label: "Follow VivahGo on Instagram" },
  { name: "YouTube", href: "https://www.youtube.com/", label: "Watch VivahGo on YouTube" },
  { name: "LinkedIn", href: "https://www.linkedin.com/company/vivahgo/", label: "Connect with VivahGo on LinkedIn" },
];

const structuredDataKeywords = seoKeywordLibrary.clusters.primary.slice(0, 24);
const coverageTopics = [
  ...seoKeywordLibrary.clusters.primary.slice(0, 8),
  ...seoKeywordLibrary.clusters.cultural.slice(0, 4),
];
const MARKETING_HOME_URL = getMarketingUrl("/");
const PLANNER_HOME_URL = getPlannerUrl("/");

function formatDisplayLabel(value = "") {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join("-")
    )
    .join(" ");
}

const howItWorksSteps = [
  "Create your wedding workspace",
  "Add family, guests, and vendors",
  "Track everything together",
];

const testimonials = [
  {
    quote: "“We had 12 WhatsApp groups for our wedding. Every decision got lost. With VivahGo, both families and our planner worked from one place. No confusion, no repeated calls.”",
    rating: 5,
    attribution: "— Riya & Arjun, Delhi (1200 guests, 5 events)",
  },
  {
    quote: "“Earlier, every update meant 5 phone calls with relatives. Now everyone just checks VivahGo. It saved us hours every week.”",
    rating: 4.5,
    attribution: "— Sneha's mother, Mumbai",
  },
  {
    quote: "“We didn't realize how much we were overspending until we tracked everything in VivahGo. It helped us avoid last-minute surprises.”",
    rating: 5,
    attribution: "— Kunal, Bangalore",
  },
  {
    quote: "“Managing multiple weddings used to mean constant follow-ups. VivahGo gave my team full visibility across clients.”",
    rating: 5,
    attribution: "— Wedding Planner, Jaipur",
  },
  {
    quote: "“We stopped repeating the same updates across chats. Everything just lived in one place. Planning felt way less stressful.”",
    rating: 4.5,
    attribution: "— Aditi & Rahul, Gurgaon",
  },
];

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "VivahGo",
    url: MARKETING_HOME_URL,
    logo: `${DEFAULT_SITE_URL}/logo.svg`,
    description: "Wedding planning software for Indian weddings with shared checklists, budgets, guest management, vendor coordination, RSVPs, timelines, and wedding websites.",
    keywords: structuredDataKeywords.join(", "),
    areaServed: ["India", "UAE", "USA", "UK", "Canada", "Australia", "Singapore"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "VivahGo",
    url: MARKETING_HOME_URL,
    description: "Wedding planner app for Indian weddings with shared checklists, budgets, guests, vendors, timelines, and event management.",
    inLanguage: "en-IN",
    keywords: structuredDataKeywords.join(", "),
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "VivahGo",
    url: MARKETING_HOME_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "Wedding planner app for Indian weddings with checklists, budgets, guest list management, vendor coordination, RSVP tracking, timelines, and wedding websites.",
    keywords: structuredDataKeywords.join(", "),
    featureList: [
      "Wedding checklist management",
      "Budget tracking",
      "Guest list and RSVP tracking",
      "Vendor coordination",
      "Multi-event wedding timelines",
      "Wedding website creation",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Indian wedding planning coverage",
    itemListElement: coverageTopics.map((topic, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: formatDisplayLabel(topic),
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  },
];

const pricingStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "VivahGo Pricing",
    url: `${DEFAULT_SITE_URL}/pricing`,
    description: "VivahGo pricing for couples, families, and wedding planners.",
    keywords: structuredDataKeywords.join(", "),
  },
  {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "VivahGo Plans",
    keywords: structuredDataKeywords.join(", "),
    itemListElement: plans.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      description: plan.description,
      priceCurrency: "INR",
      price: String(plan.monthlyPrice),
      availability: "https://schema.org/InStock",
    })),
  },
];

function getStarType(rating, starNumber) {
  if (rating >= starNumber) {
    return "full";
  }

  if (rating >= starNumber - 0.5) {
    return "half";
  }

  return "empty";
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

export default function MarketingHomePage({ page = "home" }) {
  const [session, setSession] = useState(() => readAuthSession());
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState(null);
  const [checkoutSheetPlan, setCheckoutSheetPlan] = useState(null);
  const [pendingPlanSelection, setPendingPlanSelection] = useState(null);
  const [showLoginBeforePlanModal, setShowLoginBeforePlanModal] = useState(false);
  const [planLoginLoading, setPlanLoginLoading] = useState(false);
  const [planLoginError, setPlanLoginError] = useState("");
  const [subscriptionBanner, setSubscriptionBanner] = useState(null);
  const [checkoutRoute, setCheckoutRoute] = useState(() => readCheckoutRouteFromUrl());
  const [subscription, setSubscription] = useState(null);
  const isPricingPage = page === "pricing";
  const seoConfig = isPricingPage
    ? {
      title: "VivahGo Pricing | Plans for Couples and Planners",
      description: "Compare wedding planner app pricing for couples, families, planners, and studios managing guests, budgets, vendors, RSVPs, and wedding websites.",
      canonicalUrl: getMarketingUrl("/pricing"),
      structuredData: pricingStructuredData,
    }
    : {
      title: "VivahGo | Wedding Planner App for Indian Weddings",
      description: "VivahGo is a wedding planner app for Indian weddings that helps couples, families, and planners manage checklists, budgets, guests, vendors, RSVPs, timelines, and wedding websites in one shared workspace.",
      canonicalUrl: MARKETING_HOME_URL,
      structuredData: homeStructuredData,
    };

  usePageSeo(seoConfig);

  useEffect(() => {
    const syncSession = () => {
      setSession(readAuthSession());
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncSession();
      }
    };

    syncSession();

    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isPricingPage]);

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
  const subscriptionTier = subscription?.tier || "starter";
  const hasActivePaidPlan = subscription?.status === "active" && (subscriptionTier === "premium" || subscriptionTier === "studio");

  useEffect(() => {
    let active = true;

    if (!session?.token) {
      setSubscription(null);
      return undefined;
    }

    getSubscriptionStatus(session.token)
      .then((result) => {
        if (active) {
          setSubscription(result);
        }
      })
      .catch(() => {
        if (active) {
          setSubscription(null);
        }
      });

    return () => {
      active = false;
    };
  }, [session?.token]);

  function handleChoosePlan(planName) {
    const planKey = planName.toLowerCase();
    if (planKey === "premium" && hasActivePaidPlan) {
      return;
    }

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

      const { user, plannerOwnerId } = await loginWithGoogle(credentialResponse.credential);
      const nextSession = persistAuthSession({
        mode: "google",
        user,
        plannerOwnerId: plannerOwnerId || user?.id || "",
      });

      setSession(nextSession);
      setShowLoginBeforePlanModal(false);

      if (pendingPlanSelection) {
        setCheckoutSheetPlan({
          key: pendingPlanSelection.key,
          name: pendingPlanSelection.name,
          token: nextSession?.token,
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

  function renderPricingSection() {
    return (
      <section className="marketing-section" id="pricing">
        <div className="marketing-section-heading">
          <p className="marketing-section-kicker">Pricing</p>
          <p>Costs less than 0.1% of a typical Indian wedding but prevents expensive mistakes.</p>
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
          <h2>Start simple. Upgrade when the wedding gets bigger.</h2>
          <p>Start free, set up your workspace, and move up only when planning gets more collaborative.</p>
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
                hasActivePaidPlan ? null : (
                  <a
                  className="marketing-price-action marketing-price-action-ghost"
                  href={PLANNER_HOME_URL}
                >
                  Start Your Wedding Plan Free
                </a>
                )
              ) : (
                (() => {
                  const planKey = plan.name.toLowerCase();
                  const isPremiumLocked = planKey === "premium" && hasActivePaidPlan;
                  const isBusy = checkoutLoadingPlan === planKey || Boolean(checkoutSheetPlan) || Boolean(checkoutRoute);
                  const isDisabled = isBusy || isPremiumLocked;
                  let buttonLabel = plan.name === "Studio" ? "Talk to Sales" : "Upgrade Your Workspace";

                  if (checkoutLoadingPlan === planKey) {
                    buttonLabel = "Loading checkout...";
                  } else if (isPremiumLocked) {
                    buttonLabel = subscriptionTier === "studio" ? "Included in Studio" : "Start Your Wedding Plan";
                  }

                  if (isPremiumLocked && subscriptionTier === "premium") {
                    return (
                      <a
                        className={`marketing-price-action ${plan.featured ? "marketing-price-action-featured" : "marketing-price-action-ghost"}`}
                        href={PLANNER_HOME_URL}
                      >
                        {buttonLabel}
                      </a>
                    );
                  }

                  return (
                    <button
                      type="button"
                      className={`marketing-price-action ${plan.featured ? "marketing-price-action-featured" : "marketing-price-action-ghost"}`}
                      onClick={() => handleChoosePlan(plan.name)}
                      disabled={isDisabled}
                      style={isDisabled ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
                    >
                      {buttonLabel}
                    </button>
                  );
                })()
              )}
            </article>
          ))}
        </div>
      </section>
    );
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
        onSuccess={(result) => {
          const isFreeBill = result?.checkoutMode === "internal_free";
          const receiptNumber = result?.receipt?.receiptNumber;
          const receiptPlan = result?.receipt?.plan;
          const receiptPeriodEnd = result?.receipt?.currentPeriodEnd || null;

          if (receiptPlan) {
            setSubscription({
              tier: receiptPlan,
              status: "active",
              currentPeriodEnd: receiptPeriodEnd,
            });
          }

          setSubscriptionBanner({
            type: "success",
            message: isFreeBill
              ? `Your bill${receiptNumber ? ` (${receiptNumber})` : ""} is ready below.`
              : "Payment received. Your plan is now active.",
          });
          if (!isFreeBill) {
            closeCheckoutPage();
          }
        }}
      />
    );
  }

  if (isPricingPage) {
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
        <MarketingSiteHeader
          activePage="pricing"
          session={session}
          onContactUs={() => setShowFeedbackModal(true)}
          primaryCtaLabel="Start Planning Now"
          mobileCtaLabel="Plan Now"
        />

        <main className="marketing-main">
          <section className="marketing-section marketing-pricing-page-intro">
            <div className="marketing-section-heading">
              <p className="marketing-section-kicker">Pricing</p>
              <h1>Choose the workspace that fits your wedding.</h1>
              <p>Start free, upgrade when you need more coordination, and keep billing simple as your Indian wedding planning grows.</p>
            </div>
          </section>

          {renderPricingSection()}

          <section className="marketing-section marketing-final-cta">
            <div className="marketing-section-heading">
              <h2 className="marketing-final-cta-title">Start planning early. Avoid chaos later.</h2>
              <p>Create your wedding workspace today.</p>
            </div>
            <div className="marketing-hero-actions marketing-final-actions">
              <a className="marketing-primary-action" href={PLANNER_HOME_URL}>
                Start for free
              </a>
            </div>
          </section>
        </main>

        <footer className="marketing-footer" id="social">
          <div className="marketing-footer-copy">
            <p className="marketing-section-kicker">Stay Connected</p>
            <h2>Follow VivahGo</h2>
            <p>Product updates, planning ideas, and early release news.</p>
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

              {planLoginLoading && (
                <div className="marketing-login-status">
                  <p>Signing you in...</p>
                  <LoadingBar compact className="marketing-login-loading-bar" />
                </div>
              )}
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

        {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
      </div>
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
      <MarketingSiteHeader
        activePage="home"
        session={session}
        onContactUs={() => setShowFeedbackModal(true)}
        primaryCtaLabel="Start Planning Now"
        mobileCtaLabel="Plan Now"
      />

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Wedding planner app for Indian weddings with too many chats, lists, and opinions</p>
            <figure className="marketing-hero-visual marketing-hero-visual-inline">
              <img
                src={resolvePublicAssetUrl("/MainHero.png")}
                alt="A stressed couple handling scattered wedding paperwork contrasted with a calmer couple reviewing everything together on VivahGo."
                className="marketing-hero-visual-image"
                decoding="async"
              />
              <div className="marketing-hero-visual-badge marketing-hero-visual-badge-left">Before: scattered planning</div>
              <div className="marketing-hero-visual-badge marketing-hero-visual-badge-right">After: one shared workspace</div>
            </figure>
            <h1>The wedding planner app that keeps your entire wedding in one place.</h1>
            <p className="marketing-summary">
              VivahGo helps couples, families, and planners manage guests, budgets, vendors, RSVPs, timelines, and family coordination together in a single shared workspace.
            </p>
            <p className="marketing-summary">
              Use it as your wedding checklist app, budget planner, guest list manager, RSVP tracker, and vendor coordination system across every ceremony.
            </p>

            <div className="marketing-hero-actions">
              <a className="marketing-primary-action" href={PLANNER_HOME_URL}>
                {isSignedIn ? "Start planning your wedding for free" : "Create Your Wedding Workspace"}
              </a>
            </div>
            <p className="marketing-hero-setup-note">Set up your wedding plan in under 2 minutes. No learning curve.</p>

            <div className="marketing-proof-strip" aria-label="VivahGo highlights">
              {trustSignals.map((item) => (
                <div key={item}>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-hero-panel" aria-label="VivahGo overview">
            <div className="marketing-panel-card marketing-panel-primary">
              <span className="marketing-panel-label">What it replaces</span>
              <h2>One shared wedding workspace instead of scattered updates</h2>
              <ul>
                <li><span>Replace WhatsApp chaos</span></li>
                <li><span>Replace messy spreadsheets</span></li>
                <li><span>Replace constant follow-ups</span></li>
              </ul>
            </div>
            <div className="marketing-panel-stack">
              <article className="marketing-panel-card">
                <span className="marketing-panel-metric">For couples and families</span>
                <p>Keep everyone in sync without repeating the same update ten times.</p>
              </article>
              <article className="marketing-panel-card">
                <span className="marketing-panel-metric">For planners and studios</span>
                <p>Run client weddings with clearer visibility and fewer follow-ups.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-how-it-works" aria-labelledby="how-it-works-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">How It Works</p>
            <h2 id="how-it-works-title">Three simple steps to get your wedding organized.</h2>
          </div>

          <div className="marketing-how-it-works-grid">
            {howItWorksSteps.map((step, index) => (
              <article className="marketing-how-it-works-card" key={step}>
                <span className="marketing-how-it-works-number">0{index + 1}</span>
                <h3>{step}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section" id="problem">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Why This Feels Hard</p>
            <h2>The wedding is not the problem. The scattered planning is.</h2>
          </div>

          <div className="marketing-feature-grid">
            {painPoints.map((item) => (
              <article className="marketing-feature-card marketing-feature-card-left" key={item}>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section-band" id="product">
          <div className="marketing-band-copy marketing-band-copy-centered">
            <p className="marketing-section-kicker">The Fix</p>
            <div className="marketing-band-mark-frame">
              <img
                src="/Thumbnail.png"
                alt="VivahGo"
                className="marketing-band-mark"
                decoding="async"
              />
            </div>
            <p>The operating system for Indian weddings</p>
            <div className="marketing-band-points marketing-band-points-inline">
              <div>
                <strong>Track every event</strong>
                <span>From roka to reception, keep dates, owners, and next steps visible.</span>
              </div>
              <div>
                <strong>Keep budgets and guest lists live</strong>
                <span>Know what changed, what is pending, and what needs action.</span>
              </div>
              <div>
                <strong>Plan together without the back-and-forth</strong>
                <span>Couples, parents, and planners can work from the same source of truth.</span>
              </div>
            </div>
            <a className="marketing-primary-action" href={PLANNER_HOME_URL}>
              {isSignedIn ? "Start planning your wedding for free" : "Start Your Wedding Plan Free"}
            </a>
          </div>

        </section>

        <section className="marketing-section marketing-product-views-section">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Real Product Views</p>
            <h2>See the workspace your wedding runs on.</h2>
          </div>

          <div className="marketing-screen-grid">
            <article className="marketing-product-shot">
              <div className="marketing-shot-header marketing-shot-header-centered">
                <strong>Dashboard</strong>
              </div>
              <p className="marketing-shot-caption">Events, timelines, budget, and guest status.<br />All in one place</p>
              <div className="marketing-app-preview marketing-app-preview-dashboard">
                <Dashboard
                  wedding={DEMO_PLANNER.wedding}
                  events={DEMO_PLANNER.events}
                  expenses={DEMO_PLANNER.expenses}
                  guests={DEMO_PLANNER.guests}
                  onTabChange={() => {}}
                  onEditEvent={() => {}}
                />
              </div>
            </article>

            <article className="marketing-product-shot">
              <div className="marketing-shot-header marketing-shot-header-centered">
                <strong>Events Plan</strong>
              </div>
              <p className="marketing-shot-caption">Track every ceremony, linked spend, venue status, and timeline from one screen.</p>
              <div className="marketing-app-preview marketing-app-preview-events">
                <EventsScreen
                  events={DEMO_PLANNER.events}
                  setEvents={() => {}}
                  expenses={DEMO_PLANNER.expenses}
                  setExpenses={() => {}}
                  onOpenBudget={() => {}}
                  initialEditingEventId={null}
                  planId={DEMO_PLANNER.activePlanId}
                />
              </div>
            </article>

            <article className="marketing-product-shot">
              <div className="marketing-shot-header marketing-shot-header-centered">
                <strong>Guest list and RSVPs</strong>
              </div>
              <p className="marketing-shot-caption">Track confirmations, follow-ups, and family sides easily</p>
              <div className="marketing-app-preview marketing-app-preview-guests">
                <GuestsScreen guests={DEMO_PLANNER.guests} setGuests={() => {}} planId={DEMO_PLANNER.activePlanId} />
              </div>
            </article>

            <article className="marketing-product-shot">
              <div className="marketing-shot-header marketing-shot-header-centered">
                <strong>Budget tracking</strong>
              </div>
              <p className="marketing-shot-caption">Planned spend, actual spend, pending costs, and ceremony-wise breakdowns.</p>
              <div className="marketing-app-preview marketing-app-preview-budget">
                <BudgetScreen
                  expenses={DEMO_PLANNER.expenses}
                  setExpenses={() => {}}
                  wedding={DEMO_PLANNER.wedding}
                  events={DEMO_PLANNER.events}
                  planId={DEMO_PLANNER.activePlanId}
                />
              </div>
            </article>
          </div>

          <div className="marketing-hero-actions marketing-product-cta">
            <a className="marketing-primary-action" href={PLANNER_HOME_URL}>
              Try it free in 2 minutes
            </a>
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="planner-app-capabilities-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Planner App Features</p>
            <h2 id="planner-app-capabilities-title">Everything a wedding planner app should actually help you manage.</h2>
            <p>VivahGo keeps the core planning workflows clear enough to scan and strong enough to run a real wedding from.</p>
          </div>

          <div className="marketing-feature-grid marketing-capability-bucket-grid">
            {plannerAppCapabilityBuckets.map((bucket) => (
              <article className="marketing-feature-card marketing-feature-card-left marketing-capability-bucket-card" key={bucket.label}>
                <div className="marketing-capability-bucket-head">
                  <p className="marketing-capability-bucket-label">{bucket.label}</p>
                  <p className="marketing-capability-bucket-intro">{bucket.intro}</p>
                </div>

                <div className="marketing-capability-list">
                  {bucket.items.map((item) => (
                    <div className="marketing-capability-item" key={item.title}>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="what-you-get-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">What you get</p>
            <h2 id="what-you-get-title">What you get</h2>
          </div>

          <div className="marketing-feature-grid">
            {outcomes.map((item) => (
              <article className="marketing-feature-card marketing-feature-card-left" key={item}>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Why Couples Stick With It</p>
            <h2>Less confusion. More control.</h2>
          </div>

          <div className="marketing-feature-grid">
            {benefitCards.map((item) => (
              <article className="marketing-feature-card marketing-feature-card-left" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section-contrast">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Why VivahGo Wins</p>
            <h2>Better than WhatsApp and Excel because it was <span className="marketing-inline-highlight">built for weddings</span>.</h2>
          </div>

          <div className="marketing-differentiator-list">
            {differentiators.map((item) => (
              <article className="marketing-differentiator-card" key={item}>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-social-proof" aria-labelledby="social-proof-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Testimonials</p>
            <h2 id="social-proof-title">Couples are already planning without the chaos</h2>
          </div>

          <div className="marketing-testimonial-slider" aria-label="Testimonials slider">
            {testimonials.map((testimonial, index) => (
              <blockquote className={`marketing-social-proof-quote${index === 0 ? " marketing-social-proof-quote-featured" : ""}`} key={testimonial.quote}>
                <p>{testimonial.quote}</p>
                <div className="marketing-testimonial-rating" aria-label={`Rated ${testimonial.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((starNumber) => (
                    <span
                      key={starNumber}
                      className={`marketing-testimonial-star marketing-testimonial-star-${getStarType(testimonial.rating, starNumber)}`}
                      aria-hidden="true"
                    >
                      ★
                    </span>
                  ))}
                </div>
                <footer>{testimonial.attribution}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="marketing-section" id="faqs">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">FAQs</p>
            <h2>Questions people ask before they start</h2>
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

        <section className="marketing-section marketing-final-cta">
          <div className="marketing-section-heading">
            <h2 className="marketing-final-cta-title">Start planning early. Avoid chaos later.</h2>
            <p>Create your wedding workspace today.</p>
          </div>
          <div className="marketing-hero-actions marketing-final-actions">
            <a className="marketing-primary-action" href={PLANNER_HOME_URL}>
              Start for free
            </a>
            <a className="marketing-secondary-action marketing-secondary-action-gold" href="/pricing">
              View Pricing
            </a>
          </div>
        </section>
      </main>

      <footer className="marketing-footer" id="social">
        <div className="marketing-footer-copy">
          <p className="marketing-section-kicker">Stay Connected</p>
          <h2>Follow VivahGo</h2>
          <p>Product updates, planning ideas, and early release news.</p>
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

            {planLoginLoading && (
              <div className="marketing-login-status">
                <p>Signing you in...</p>
                <LoadingBar compact className="marketing-login-loading-bar" />
              </div>
            )}
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

      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
