import { useEffect, useMemo, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import { readAuthSession } from "../../../authStorage";
import { DEFAULT_SITE_URL, usePageSeo } from "../../../seo.js";
import { getMarketingUrl, getPlannerUrl } from "../../../siteUrls.js";
import guides from "../../../shared/content/guides.json";
import { resolvePublicAssetUrl } from "../../../publicAssetUrls.js";

const MARKETING_HOME_URL = getMarketingUrl("/");
const PLANNER_HOME_URL = getPlannerUrl("/");

function findGuideBySlug(slug = "") {
  return guides.find((guide) => guide.slug === slug) || null;
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

export default function GuideArticlePage({ guideSlug = "" }) {
  const [session, setSession] = useState(() => readAuthSession());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const guide = useMemo(() => findGuideBySlug(guideSlug), [guideSlug]);
  const relatedGuides = useMemo(
    () => guides.filter((item) => item.slug !== guideSlug).slice(0, 3),
    [guideSlug]
  );

  usePageSeo(
    guide
      ? {
        title: `${guide.title} | VivahGo Guides`,
        description: guide.seoDescription,
        canonicalUrl: getMarketingUrl(`/guides/${guide.slug}`),
        structuredData: [
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.title,
            description: guide.seoDescription,
            url: `${DEFAULT_SITE_URL}/guides/${guide.slug}`,
            author: {
              "@type": "Organization",
              name: "VivahGo",
            },
            publisher: {
              "@type": "Organization",
              name: "VivahGo",
              logo: {
                "@type": "ImageObject",
                url: `${DEFAULT_SITE_URL}/logo.svg`,
              },
            },
            keywords: guide.keywords.join(", "),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: MARKETING_HOME_URL,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Guides",
                item: `${DEFAULT_SITE_URL}/guides`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: guide.title,
                item: `${DEFAULT_SITE_URL}/guides/${guide.slug}`,
              },
            ],
          },
        ],
      }
      : {
        title: "Guide Not Found | VivahGo",
        description: "The requested guide could not be found.",
        path: `/guides/${guideSlug}`,
        noindex: true,
      }
  );

  useEffect(() => {
    const syncSession = () => {
      setSession(readAuthSession());
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

  if (!guide) {
    return (
      <div className="marketing-home-shell">
        <MarketingSiteHeader activePage="guides" session={session} onContactUs={() => setShowFeedbackModal(true)} />
        <main className="marketing-main">
          <section className="marketing-section marketing-pricing-page-intro">
            <div className="marketing-section-heading">
              <p className="marketing-section-kicker">Guide Not Found</p>
              <h1>This guide is not available yet.</h1>
              <p>Return to the guides hub to browse the published guide pages.</p>
            </div>
            <div className="marketing-hero-actions marketing-final-actions">
              <a className="marketing-primary-action" href="/guides">Back to Guides</a>
            </div>
          </section>
        </main>
        <LegalFooter
          className="marketing-legal-footer"
          hasBottomNav={false}
          onOpenFeedback={() => setShowFeedbackModal(true)}
        />
        {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
      </div>
    );
  }

  return (
    <div className="marketing-home-shell">
      <MarketingSiteHeader activePage="guides" session={session} onContactUs={() => setShowFeedbackModal(true)} />

      <main className="marketing-main">
        <section className="marketing-section marketing-guide-article-hero">
          <div className="marketing-guide-article-breadcrumbs">
            <a href="/guides">Guides</a>
            <span>/</span>
            <span>{guide.title}</span>
          </div>

          <div className="marketing-guide-article-grid">
            <div className="marketing-guide-article-copy">
              <p className="marketing-section-kicker">Guide</p>
              <h1>{guide.title}</h1>
              <p className="marketing-summary">{guide.summary}</p>

              <div className="marketing-guide-article-meta">
                <span>{guide.readTime}</span>
              </div>

              <div className="marketing-keyword-chip-cloud" aria-label={`${guide.title} keywords`}>
                {guide.keywords.map((keyword) => (
                  <span className="marketing-keyword-chip" key={keyword}>{formatDisplayLabel(keyword)}</span>
                ))}
              </div>
            </div>

            <div className="marketing-guide-article-media">
              {guide.coverImage ? (
                <img
                  src={resolvePublicAssetUrl(guide.coverImage)}
                  alt={guide.coverAlt || guide.title}
                  className="marketing-guide-card-image"
                  decoding="async"
                  fetchPriority="high"
                />
              ) : (
                <div className="marketing-guide-card-image-placeholder marketing-guide-card-image-placeholder-large" aria-label={`${guide.title} image placeholder`}>
                  <span>Guide Hero Image Slot</span>
                  <small>{guide.imageHint}</small>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-guide-section">
          <div className="marketing-guide-body">
            {guide.sections.map((section) => (
              <div className="marketing-guide-subsection" key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {Array.isArray(section.bullets) && section.bullets.length ? (
                  <ul className="marketing-guide-list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section-contrast marketing-guide-conversion-section">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Use The Product</p>
            <h2>Turn the guide into an actual working plan.</h2>
            <p>Read the guide, then move the workflow into a shared planner once the wedding starts involving guests, budgets, vendors, and family approvals.</p>
          </div>

          <div className="marketing-hero-actions marketing-guide-cta">
            <a className="marketing-primary-action" href={PLANNER_HOME_URL}>
              Open VivahGo Planner
            </a>
            <a className="marketing-secondary-action" href="/pricing">
              See Plans
            </a>
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="related-guides-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Related Guides</p>
            <h2 id="related-guides-title">Keep reading from the guide library.</h2>
          </div>

          <div className="marketing-guides-grid">
            {relatedGuides.map((item) => (
              <article className="marketing-guide-card" key={item.slug}>
                <div className="marketing-guide-card-media">
                  {item.coverImage ? (
                    <img
                      src={resolvePublicAssetUrl(item.coverImage)}
                      alt={item.coverAlt || item.title}
                      className="marketing-guide-card-image"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="marketing-guide-card-image-placeholder" aria-label={`${item.title} image placeholder`}>
                      <span>Guide Cover Slot</span>
                      <small>{item.imageHint}</small>
                    </div>
                  )}
                </div>
                <div className="marketing-guide-card-body">
                  <div className="marketing-guide-card-meta">
                    <span>{item.readTime}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <div className="marketing-guide-card-actions">
                    <a className="marketing-secondary-action" href={`/guides/${item.slug}`}>
                      Open Guide
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <LegalFooter
        className="marketing-legal-footer"
        hasBottomNav={false}
        onOpenFeedback={() => setShowFeedbackModal(true)}
      />

      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
