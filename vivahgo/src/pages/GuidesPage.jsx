import { useEffect, useState } from "react";
import "../styles.css";
import "../marketing-home.css";
import FeedbackModal from "../components/FeedbackModal";
import LegalFooter from "../components/LegalFooter";
import TermsConditionsModal from "../components/TermsConditionsModal";
import MarketingSiteHeader from "../components/MarketingSiteHeader.jsx";
import { DEFAULT_SITE_URL, usePageSeo } from "../seo.js";
import seoKeywordLibrary from "../generated/seo-keywords.json";
import guides from "../content/guides.json";

const guideFaqs = [
  {
    question: "Why split guides into separate pages?",
    answer: "Separate guide URLs make each topic easier to rank, easier to share, and easier to expand with richer content, images, and internal links over time.",
  },
  {
    question: "Can images be added later?",
    answer: "Yes. Each guide card and article now has a dedicated image slot so cover images can be added without redesigning the layout.",
  },
  {
    question: "Will VivahGo add more guide pages?",
    answer: "Yes. This hub is designed to expand into more city, culture, budgeting, RSVP, vendor, and destination planning topics.",
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
        text: item.answer,
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

export default function GuidesPage() {
  const [session, setSession] = useState(() => readStoredSession());
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const topicChips = seoKeywordLibrary.clusters.primary.slice(0, 8);

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
            <p className="marketing-kicker">Guides for real Indian wedding planning work</p>
            <h1>Browse neat, focused wedding guides instead of one overloaded resources page.</h1>
            <p className="marketing-summary">
              Each guide now has its own dedicated URL, making the hub cleaner for readers and stronger for search.
            </p>

            <div className="marketing-hero-actions">
              <a className="marketing-primary-action" href="/">
                Start Your Wedding Plan Free
              </a>
              <a className="marketing-secondary-action marketing-secondary-action-gold" href="/pricing">
                View Pricing
              </a>
            </div>

            <div className="marketing-keyword-chip-cloud marketing-keyword-chip-cloud-wide" aria-label="Guide topics">
              {topicChips.map((topic) => (
                <span className="marketing-keyword-chip" key={topic}>{formatDisplayLabel(topic)}</span>
              ))}
            </div>
          </div>

          <div className="marketing-hero-panel" aria-label="Guide hub overview">
            <div className="marketing-panel-card marketing-panel-primary">
              <span className="marketing-panel-label">What changed</span>
              <h2>The guide hub is now a proper index page.</h2>
              <ul>
                <li><span>Dedicated guide URLs</span></li>
                <li><span>Neat cards with summaries</span></li>
                <li><span>Image slots ready to fill</span></li>
              </ul>
            </div>
            <div className="marketing-panel-stack">
              <article className="marketing-panel-card">
                <span className="marketing-panel-metric">{guides.length} guide pages</span>
                <p>Each one can grow independently with richer copy, visuals, and internal links.</p>
              </article>
              <article className="marketing-panel-card">
                <span className="marketing-panel-metric">{seoKeywordLibrary.summary.keywordCount.toLocaleString("en-IN")} keywords mapped</span>
                <p>The guide system still sits on top of the source-backed SEO library generated from the product itself.</p>
              </article>
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
              <article className="marketing-guide-card" key={guide.slug}>
                <div className="marketing-guide-card-media">
                  {guide.coverImage ? (
                    <img src={guide.coverImage} alt={guide.coverAlt || guide.title} className="marketing-guide-card-image" />
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
                  <div className="marketing-guide-card-actions">
                    <a className="marketing-secondary-action" href={`/guides/${guide.slug}`}>
                      Open Guide
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section" id="guide-faqs">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Guide FAQs</p>
            <h2>Questions about the guide hub</h2>
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
