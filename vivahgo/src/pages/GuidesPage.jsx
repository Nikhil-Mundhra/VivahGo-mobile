import { useEffect, useState } from "react";
import "../styles.css";
import "../marketing-home.css";
import FeedbackModal from "../components/FeedbackModal";
import LegalFooter from "../components/LegalFooter";
import TermsConditionsModal from "../components/TermsConditionsModal";
import MarketingSiteHeader from "../components/MarketingSiteHeader.jsx";
import { DEFAULT_SITE_URL, usePageSeo } from "../seo.js";
import guides from "../content/guides.json";

const guideFaqs = [
  {
    question: "Which guide should I start with if I am planning from scratch?",
    answer: (
      <>
        Start with the{" "}
        <a className="marketing-faq-inline-link" href="/guides/indian-wedding-checklist">
          Indian Wedding Planning Checklist
        </a>
        . It gives you the broad structure first, then you can move into the budget, guest list, vendor, or
        ceremony-specific guides based on the decision you need to make next.
      </>
    ),
    structuredAnswer:
      "Start with the Indian Wedding Planning Checklist. It gives you the broad structure first, then you can move into the budget, guest list, vendor, or ceremony-specific guides based on the decision you need to make next.",
  },
  {
    question: "Do I need to read every guide, or can I jump to the topic I need right now?",
    answer: "You can jump straight to the guide that matches your current problem. Each page is written to stand on its own, whether you are fixing your budget, organizing RSVPs, coordinating vendors, or planning a specific wedding timeline.",
    structuredAnswer:
      "You can jump straight to the guide that matches your current problem. Each page is written to stand on its own, whether you are fixing your budget, organizing RSVPs, coordinating vendors, or planning a specific wedding timeline.",
  },
  {
    question: "Are these guides actually useful for Indian weddings with multiple ceremonies and family involvement?",
    answer: "Yes. The guides are built around real Indian wedding planning work, including multiple functions, shared family decision-making, guest coordination, vendor follow-ups, and ceremony-level timelines instead of generic wedding advice.",
    structuredAnswer:
      "Yes. The guides are built around real Indian wedding planning work, including multiple functions, shared family decision-making, guest coordination, vendor follow-ups, and ceremony-level timelines instead of generic wedding advice.",
  },
];

const guideStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "VivahGo Guides",
    url: `${DEFAULT_SITE_URL}/guides`,
    description: "Guides for Indian wedding planning, budgeting, guest lists, vendor coordination, cultural ceremonies, and destination wedding organization.",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${DEFAULT_SITE_URL}/home`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Guides",
        item: `${DEFAULT_SITE_URL}/guides`,
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Wedding planning guides",
    itemListElement: guides.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.title,
      url: `${DEFAULT_SITE_URL}/guides/${guide.slug}`,
    })),
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guideFaqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.structuredAnswer,
      },
    })),
  },
];

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem("vivahgo.session");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function GuidesPage() {
  const [session, setSession] = useState(() => readStoredSession());
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  usePageSeo({
    title: "VivahGo Guides | Indian Wedding Planning Resources",
    description: "Browse Indian wedding planning guides for checklists, budgets, guest lists, vendor coordination, cultural wedding timelines, and destination weddings.",
    path: "/guides",
    structuredData: guideStructuredData,
  });

  useEffect(() => {
    const syncSession = () => {
      setSession(readStoredSession());
    };

    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

  return (
    <div className="marketing-home-shell">
      <MarketingSiteHeader activePage="guides" session={session} onContactUs={() => setShowFeedbackModal(true)} />

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">Wedding planning help for every stage of your celebration</p>
            <h1>Find the guide you need.</h1>
            <p className="marketing-summary">
              Whether you are just getting started or already deep into decisions, these guides help you plan your
              Indian wedding with more clarity and less stress.
            </p>

            <div className="marketing-hero-actions">
              <a className="marketing-primary-action" href="/">
                Start Planning Free
              </a>
              <a className="marketing-secondary-action marketing-secondary-action-gold" href="/pricing">
                See Pricing
              </a>
            </div>
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="guides-grid-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Guide Library</p>
            <h2 id="guides-grid-title">Choose a topic to open its dedicated guide page.</h2>
            <p>The hub stays clean here. The detailed content now lives where it belongs, on the individual guide URLs.</p>
          </div>

          <div className="marketing-guides-grid">
            {guides.map((guide) => (
              <a className="marketing-guide-card marketing-guide-card-link" href={`/guides/${guide.slug}`} key={guide.slug}>
                <div className="marketing-guide-card-media">
                  {guide.coverImage ? (
                    <img
                      src={guide.coverImage}
                      alt={guide.coverAlt || guide.title}
                      className="marketing-guide-card-image"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="marketing-guide-card-image-placeholder" aria-label={`${guide.title} image placeholder`}>
                      <span>Guide Cover Slot</span>
                      <small>{guide.imageHint}</small>
                    </div>
                  )}
                </div>

                <div className="marketing-guide-card-body">
                  <div className="marketing-guide-card-meta">
                    <span>{guide.readTime}</span>
                  </div>
                  <h3>{guide.title}</h3>
                  <p>{guide.summary}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="marketing-section" id="guide-faqs">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Guide FAQs</p>
            <h2>Common questions before you start reading</h2>
          </div>

          <div className="marketing-faq-list">
            {guideFaqs.map((item) => (
              <details className="marketing-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <LegalFooter
        className="marketing-legal-footer"
        hasBottomNav={false}
        onOpenTerms={() => setShowTermsModal(true)}
        onOpenFeedback={() => setShowFeedbackModal(true)}
      />

      {showTermsModal && <TermsConditionsModal onClose={() => setShowTermsModal(false)} />}
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
