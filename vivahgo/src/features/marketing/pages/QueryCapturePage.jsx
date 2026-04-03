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
import queryPages from "../../../shared/content/query-pages.json";

const QUERY_PAGE_BY_SLUG = new Map(queryPages.map((page) => [page.slug, page]));
const GUIDE_BY_SLUG = new Map(guides.map((guide) => [guide.slug, guide]));
const MARKETING_HOME_URL = getMarketingUrl("/");
const PLANNER_HOME_URL = getPlannerUrl("/");
const DEFAULT_DONUT_COLORS = ["#bb4d28", "#d06d3d", "#f3bf73", "#7d2512", "#a95c2b", "#f0d6a2", "#6b3a2c", "#e18f5e"];
const BUDGET_TEMPLATE_PAGE_SLUG = "indian-wedding-budget-template";
const QUERY_PAGE_ALIASES = {
  "free-wedding-budget-template": BUDGET_TEMPLATE_PAGE_SLUG,
};

function getCanonicalQueryPageSlug(slug = "") {
  return QUERY_PAGE_ALIASES[slug] || slug;
}

function findQueryPageBySlug(slug = "") {
  return QUERY_PAGE_BY_SLUG.get(getCanonicalQueryPageSlug(slug)) || null;
}

function isRenderableQueryPage(page) {
  if (!page || typeof page !== "object") {
    return false;
  }

  const hasTitle = Boolean(String(page.title || "").trim());
  const hasSlug = Boolean(String(page.slug || "").trim());
  const hasHero = [page.heroTitle, page.heroSummary, page.heroBody].some((value) => Boolean(String(value || "").trim()));
  const hasHighlights = Array.isArray(page.highlights) && page.highlights.some((item) => (
    Boolean(String(item?.title || "").trim()) || Boolean(String(item?.description || "").trim())
  ));
  const hasSections = Array.isArray(page.sections) && page.sections.some((section) => (
    Boolean(String(section?.heading || "").trim())
    || (Array.isArray(section?.paragraphs) && section.paragraphs.some((paragraph) => Boolean(String(paragraph || "").trim())))
    || (Array.isArray(section?.bullets) && section.bullets.some((bullet) => Boolean(String(bullet || "").trim())))
  ));
  const hasFaqs = Array.isArray(page.faqs) && page.faqs.some((item) => (
    Boolean(String(item?.question || "").trim()) || Boolean(String(item?.answer || "").trim())
  ));

  return hasTitle && hasSlug && (hasHero || hasHighlights || hasSections || hasFaqs);
}

function buildStructuredData(page, relatedGuides, relatedPages) {
  const canonicalUrl = getMarketingUrl(`/${page.slug}`);
  const faqItems = Array.isArray(page.faqs) ? page.faqs.filter((item) => item?.question && item?.answer) : [];
  const highlightItems = Array.isArray(page.highlights) ? page.highlights.filter((item) => item?.title) : [];
  const resourceLinks = Array.isArray(page.resourceLinks) ? page.resourceLinks.filter((item) => item?.href && item?.label) : [];
  const relatedResources = [
    ...resourceLinks.map((item) => ({
      name: item.label,
      url: getMarketingUrl(item.href),
    })),
    ...relatedPages.map((item) => ({
      name: item.title,
      url: getMarketingUrl(`/${item.slug}`),
    })),
    ...relatedGuides.map((guide) => ({
      name: guide.title,
      url: `${DEFAULT_SITE_URL}/guides/${guide.slug}`,
    })),
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.seoTitle,
      url: canonicalUrl,
      description: page.seoDescription,
      keywords: Array.isArray(page.keywords) ? page.keywords.join(", ") : undefined,
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
          name: page.title,
          item: canonicalUrl,
        },
      ],
    },
  ];

  if (page.slug === BUDGET_TEMPLATE_PAGE_SLUG) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.seoTitle,
      description: page.seoDescription,
      url: canonicalUrl,
      mainEntityOfPage: canonicalUrl,
      dateModified: page.schemaDateModified,
      author: {
        "@type": "Organization",
        name: "VivahGo",
      },
      publisher: {
        "@type": "Organization",
        name: "VivahGo",
        logo: {
          "@type": "ImageObject",
          url: getMarketingUrl("/logo.svg"),
        },
      },
      keywords: Array.isArray(page.keywords) ? page.keywords.join(", ") : undefined,
    });
  }

  if (faqItems.length) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  if (highlightItems.length) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${page.title} capabilities`,
      itemListElement: highlightItems.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.title,
      })),
    });
  }

  if (relatedResources.length) {
    structuredData.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${page.title} related resources`,
      itemListElement: relatedResources.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    });
  }

  return structuredData;
}

function formatChartNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value || "");
  }

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1);
}

function formatChartValue(value, unit = "") {
  const normalizedUnit = String(unit || "").trim();
  if (normalizedUnit === "Rs. lakh") {
    return `Rs. ${formatChartNumber(value)} lakh`;
  }
  if (normalizedUnit === "%") {
    return `${formatChartNumber(value)}%`;
  }

  return normalizedUnit ? `${formatChartNumber(value)} ${normalizedUnit}` : formatChartNumber(value);
}

function buildDonutBackground(segments = []) {
  const safeSegments = Array.isArray(segments) ? segments : [];
  let offset = 0;

  const stops = safeSegments.map((segment, index) => {
    const value = Math.max(0, Number(segment?.value) || 0);
    const nextOffset = offset + value;
    const color = segment?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
    const stop = `${color} ${offset}% ${nextOffset}%`;
    offset = nextOffset;
    return stop;
  });

  return stops.length ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(#e9d4be 0% 100%)";
}

function QueryPageDataSection({ page }) {
  const dataInsights = Array.isArray(page?.dataInsights) ? page.dataInsights.filter((item) => item?.value && item?.label) : [];
  const dataCharts = Array.isArray(page?.dataCharts) ? page.dataCharts.filter((item) => item?.title) : [];

  if (!dataInsights.length && !dataCharts.length) {
    return null;
  }

  return (
    <section className="marketing-section" aria-labelledby="query-page-data-title">
      <div className="marketing-section-heading">
        <p className="marketing-section-kicker">{page.dataSectionKicker || "Budget Benchmarks"}</p>
        <h2 id="query-page-data-title">{page.dataSectionTitle || "Planning data that makes the budget easier to trust."}</h2>
        {page.dataSectionIntro ? <p>{page.dataSectionIntro}</p> : null}
      </div>

      {dataInsights.length ? (
        <div className="marketing-data-grid">
          {dataInsights.map((item) => (
            <article className="marketing-data-card" key={`${item.label}-${item.value}`}>
              <p className="marketing-data-value">{item.value}</p>
              <h3>{item.label}</h3>
              {item.detail ? <p className="marketing-data-caption">{item.detail}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      {dataCharts.length ? (
        <div className="marketing-data-chart-grid">
          {dataCharts.map((chart) => {
            if (chart.type === "donut") {
              const donutSegments = Array.isArray(chart.segments) ? chart.segments.filter((segment) => segment?.label) : [];
              if (!donutSegments.length) {
                return null;
              }
              const centerLabel = chart.centerLabel || "100%";
              return (
                <article className="marketing-data-card marketing-data-card-chart" key={chart.title}>
                  <div className="marketing-data-chart-header">
                    <h3>{chart.title}</h3>
                    {chart.description ? <p>{chart.description}</p> : null}
                  </div>
                  <div className="marketing-donut-layout">
                    <div className="marketing-donut-chart" style={{ background: buildDonutBackground(donutSegments) }}>
                      <div className="marketing-donut-chart-hole">
                        <strong>{centerLabel}</strong>
                        {chart.centerNote ? <span>{chart.centerNote}</span> : null}
                      </div>
                    </div>

                    <div className="marketing-chart-legend">
                      {donutSegments.map((segment, index) => {
                        const color = segment?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
                        return (
                          <div className="marketing-chart-legend-row" key={`${chart.title}-${segment.label}`}>
                            <span className="marketing-chart-dot" style={{ backgroundColor: color }} aria-hidden="true" />
                            <div>
                              <strong>{segment.label}</strong>
                              <p>{formatChartValue(segment.value, "%")}{segment.detail ? ` • ${segment.detail}` : ""}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {chart.note ? <p className="marketing-data-note">{chart.note}</p> : null}
                </article>
              );
            }

            if (chart.type === "range-bars") {
              const rangeItems = Array.isArray(chart.items) ? chart.items.filter((item) => item?.label) : [];
              if (!rangeItems.length) {
                return null;
              }
              const maxValue = Math.max(...rangeItems.map((item) => Number(item?.max) || 0), 1);
              return (
                <article className="marketing-data-card marketing-data-card-chart" key={chart.title}>
                  <div className="marketing-data-chart-header">
                    <h3>{chart.title}</h3>
                    {chart.description ? <p>{chart.description}</p> : null}
                  </div>
                  <div className="marketing-range-chart">
                    {rangeItems.map((item, index) => {
                      const minValue = Math.max(0, Number(item?.min) || 0);
                      const upperValue = Math.max(minValue, Number(item?.max) || 0);
                      const left = `${(minValue / maxValue) * 100}%`;
                      const width = `${((upperValue - minValue) / maxValue) * 100}%`;
                      const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];

                      return (
                        <div className="marketing-range-row" key={`${chart.title}-${item.label}`}>
                          <div className="marketing-range-header">
                            <strong>{item.label}</strong>
                            <span>{formatChartValue(minValue, chart.unit)} to {formatChartValue(upperValue, chart.unit)}</span>
                          </div>
                          <div className="marketing-range-track">
                            <div className="marketing-range-fill" style={{ left, width, backgroundColor: color }} />
                          </div>
                          {item.detail ? <p className="marketing-range-note">{item.detail}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                  {chart.note ? <p className="marketing-data-note">{chart.note}</p> : null}
                </article>
              );
            }

            if (chart.type === "bars") {
              const barItems = Array.isArray(chart.items) ? chart.items.filter((item) => item?.label) : [];
              if (!barItems.length) {
                return null;
              }
              const maxValue = Math.max(...barItems.map((item) => Number(item?.value) || 0), 1);
              return (
                <article className="marketing-data-card marketing-data-card-chart" key={chart.title}>
                  <div className="marketing-data-chart-header">
                    <h3>{chart.title}</h3>
                    {chart.description ? <p>{chart.description}</p> : null}
                  </div>
                  <div className="marketing-bars-chart">
                    {barItems.map((item, index) => {
                      const numericValue = Math.max(0, Number(item?.value) || 0);
                      const width = `${(numericValue / maxValue) * 100}%`;
                      const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];

                      return (
                        <div className="marketing-bars-row" key={`${chart.title}-${item.label}`}>
                          <div className="marketing-range-header">
                            <strong>{item.label}</strong>
                            <span>{formatChartValue(numericValue, chart.unit)}</span>
                          </div>
                          <div className="marketing-range-track">
                            <div className="marketing-bars-fill" style={{ width, backgroundColor: color }} />
                          </div>
                          {item.detail ? <p className="marketing-range-note">{item.detail}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                  {chart.note ? <p className="marketing-data-note">{chart.note}</p> : null}
                </article>
              );
            }

            return null;
          })}
        </div>
      ) : null}
    </section>
  );
}

function BudgetTemplateIcon({ name }) {
  const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
  };

  let shape = null;

  switch (name) {
    case "grid":
      shape = (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1.4" {...strokeProps} />
          <rect x="14" y="4" width="6" height="6" rx="1.4" {...strokeProps} />
          <rect x="4" y="14" width="6" height="6" rx="1.4" {...strokeProps} />
          <rect x="14" y="14" width="6" height="6" rx="1.4" {...strokeProps} />
        </>
      );
      break;
    case "wallet":
      shape = (
        <>
          <path d="M4 8.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" {...strokeProps} />
          <path d="M6 8.5V6.7A1.7 1.7 0 0 1 7.7 5H18" {...strokeProps} />
          <circle cx="16.5" cy="14" r="1" fill="currentColor" />
        </>
      );
      break;
    case "mandap":
      shape = (
        <>
          <path d="M4 11.5 12 5l8 6.5" {...strokeProps} />
          <path d="M6 11.5h12" {...strokeProps} />
          <path d="M7.5 11.5v7" {...strokeProps} />
          <path d="M16.5 11.5v7" {...strokeProps} />
          <path d="M5.5 18.5h13" {...strokeProps} />
        </>
      );
      break;
    case "team":
      shape = (
        <>
          <circle cx="7.2" cy="7.6" r="2" {...strokeProps} />
          <circle cx="16.8" cy="7.6" r="2" {...strokeProps} />
          <path d="M4.5 12c.6-1.7 1.9-2.6 3.7-2.6s3.1.9 3.7 2.6" {...strokeProps} />
          <path d="M12.1 12c.6-1.7 1.9-2.6 3.7-2.6s3.1.9 3.7 2.6" {...strokeProps} />
          <rect x="6" y="13.7" width="12" height="5.8" rx="1.5" {...strokeProps} />
          <path d="m9.2 16.7 1.6 1.6 3.6-3.6" {...strokeProps} />
        </>
      );
      break;
    case "layers":
      shape = (
        <>
          <path d="m12 4 7.5 4-7.5 4-7.5-4L12 4Z" {...strokeProps} />
          <path d="m4.5 12 7.5 4 7.5-4" {...strokeProps} />
          <path d="m4.5 16 7.5 4 7.5-4" {...strokeProps} />
        </>
      );
      break;
    case "balance":
      shape = (
        <>
          <path d="M12 5v14" {...strokeProps} />
          <path d="M7 8h10" {...strokeProps} />
          <path d="m7 8-3 4h6l-3-4Z" {...strokeProps} />
          <path d="m17 8-3 4h6l-3-4Z" {...strokeProps} />
          <path d="M8 19h8" {...strokeProps} />
        </>
      );
      break;
    case "heart":
      shape = <path d="M12 19.2 5.8 13a4.1 4.1 0 0 1 5.8-5.8l.4.4.4-.4A4.1 4.1 0 1 1 18.2 13L12 19.2Z" {...strokeProps} />;
      break;
    case "family":
      shape = (
        <>
          <circle cx="7.2" cy="8" r="2" {...strokeProps} />
          <circle cx="16.8" cy="8" r="2" {...strokeProps} />
          <circle cx="12" cy="11.4" r="1.7" {...strokeProps} />
          <path d="M4.6 18c.5-2.2 2.2-3.5 4.3-3.5 1.7 0 3.1.7 4 2" {...strokeProps} />
          <path d="M19.4 18c-.5-2.2-2.2-3.5-4.3-3.5-1.7 0-3.1.7-4 2" {...strokeProps} />
          <path d="M9.5 18c.3-1.5 1.3-2.4 2.5-2.4s2.2.9 2.5 2.4" {...strokeProps} />
        </>
      );
      break;
    case "briefcase":
      shape = (
        <>
          <rect x="4" y="7" width="16" height="11" rx="2" {...strokeProps} />
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" {...strokeProps} />
          <path d="M4 11.5h16" {...strokeProps} />
        </>
      );
      break;
    case "pie":
      shape = (
        <>
          <path d="M12 4a8 8 0 1 1-8 8" {...strokeProps} />
          <path d="M12 4v8h8" {...strokeProps} />
        </>
      );
      break;
    case "vendor":
      shape = (
        <>
          <path d="M5 8.5h14v10.2A1.3 1.3 0 0 1 17.7 20H6.3A1.3 1.3 0 0 1 5 18.7V8.5Z" {...strokeProps} />
          <path d="M4.5 8.5 6 5h12l1.5 3.5" {...strokeProps} />
          <path d="M9 12h6" {...strokeProps} />
          <path d="M9 15.5h4" {...strokeProps} />
        </>
      );
      break;
    case "calendar":
      shape = (
        <>
          <rect x="4" y="6" width="16" height="14" rx="2" {...strokeProps} />
          <path d="M8 4v4" {...strokeProps} />
          <path d="M16 4v4" {...strokeProps} />
          <path d="M4 10h16" {...strokeProps} />
          <path d="M8 14h3" {...strokeProps} />
        </>
      );
      break;
    case "spark":
      shape = (
        <>
          <path d="m12 4 1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4L12 4Z" {...strokeProps} />
          <path d="m18.5 4.5.7 2.2 2.3.7-2.3.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2Z" {...strokeProps} />
        </>
      );
      break;
    default:
      shape = <circle cx="12" cy="12" r="4.5" {...strokeProps} />;
      break;
  }

  return (
    <span className="marketing-budget-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation">
        {shape}
      </svg>
    </span>
  );
}

function BudgetTemplateMockup() {
  return (
    <div className="marketing-budget-mockup">
      <div
        className="marketing-budget-mockup-window"
        role="img"
        aria-label="Indian wedding budget template India spreadsheet preview"
      >
        <div className="marketing-budget-mockup-topbar">
          <div className="marketing-budget-mockup-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Indian Wedding Budget Template</p>
        </div>

        <div className="marketing-budget-mockup-summary">
          <article>
            <span>Total Budget</span>
            <strong>Rs. 20L</strong>
          </article>
          <article>
            <span>Committed</span>
            <strong>Rs. 9.8L</strong>
          </article>
          <article>
            <span>Due Next</span>
            <strong>Rs. 2.4L</strong>
          </article>
        </div>

        <div className="marketing-budget-mockup-chart">
          {[
            { label: "Venue + Decor", value: "25%", width: "82%" },
            { label: "Catering", value: "25%", width: "78%" },
            { label: "Attire + Styling", value: "18%", width: "56%" },
            { label: "Travel + Stay", value: "10%", width: "34%" },
          ].map((item) => (
            <div className="marketing-budget-mockup-chart-row" key={item.label}>
              <div className="marketing-budget-mockup-chart-label">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <div className="marketing-budget-mockup-chart-track">
                <div className="marketing-budget-mockup-chart-fill" style={{ width: item.width }} />
              </div>
            </div>
          ))}
        </div>

        <div className="marketing-budget-mockup-table">
          {[
            { vendor: "Venue", status: "Due in 7 days", amount: "Rs. 1.8L" },
            { vendor: "Caterer", status: "Deposit paid", amount: "Rs. 1.2L" },
            { vendor: "Photo Team", status: "Pending approval", amount: "Rs. 75k" },
          ].map((row) => (
            <div className="marketing-budget-mockup-table-row" key={row.vendor}>
              <div>
                <strong>{row.vendor}</strong>
                <span>{row.status}</span>
              </div>
              <p>{row.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetTemplateLandingPage({
  page,
  heroPrimaryLabel,
  heroPrimaryHref,
  heroPrimaryDownload,
  heroSecondaryLabel,
  heroSecondaryHref,
  heroSecondaryDownload,
  finalPrimaryLabel,
  finalPrimaryHref,
  finalPrimaryDownload,
  finalSecondaryLabel,
  finalSecondaryHref,
  finalSecondaryDownload,
}) {
  const statItems = (page.dataInsights || []).slice(0, 4);
  const splitChart = (page.dataCharts || []).find((chart) => chart.type === "donut");
  const regionChart = (page.dataCharts || []).find((chart) => chart.type === "range-bars" && chart.title === "Regional budget ranges");
  const guestCountChart = (page.dataCharts || []).find((chart) => chart.title === "Estimated catering spend by guest count");
  const prioritiesChart = (page.dataCharts || []).find((chart) => chart.type === "bars");
  const howItWorksSteps = Array.isArray(page.howItWorksSteps) ? page.howItWorksSteps : [];
  const seoBudgetSteps = Array.isArray(page.seoBudgetSteps) ? page.seoBudgetSteps : [];
  const costOverviewItems = Array.isArray(page.costOverviewItems) ? page.costOverviewItems.filter((item) => item?.label) : [];
  const costBreakdownRows = Array.isArray(page.costBreakdownRows) ? page.costBreakdownRows.filter((item) => item?.category) : [];
  const resourceLinks = Array.isArray(page.resourceLinks) ? page.resourceLinks.filter((item) => item?.href && item?.label) : [];
  const faqItems = Array.isArray(page.faqs) ? page.faqs.filter((item) => item?.question && item?.answer) : [];
  const [buildSection, savingsSection, templateSection] = page.sections;
  const featureIcons = ["grid", "wallet", "mandap", "team", "layers", "balance"];
  const personaIcons = ["heart", "family", "briefcase"];
  const seoStepIcons = ["wallet", "team", "pie", "vendor", "calendar"];
  const stepIcons = ["wallet", "pie", "vendor", "wallet", "calendar", "spark"];
  const splitSegments = Array.isArray(splitChart?.segments) ? splitChart.segments.filter((segment) => segment?.label) : [];
  const regionItems = Array.isArray(regionChart?.items) ? regionChart.items.filter((item) => item?.label) : [];
  const guestItems = Array.isArray(guestCountChart?.items) ? guestCountChart.items.filter((item) => item?.label) : [];
  const priorityItems = Array.isArray(prioritiesChart?.items) ? prioritiesChart.items.filter((item) => item?.label) : [];
  const maxRegionValue = Math.max(...regionItems.map((item) => Number(item?.max) || 0), 1);
  const maxPriorityValue = Math.max(...priorityItems.map((item) => Number(item?.value) || 0), 1);

  return (
    <main className="marketing-main marketing-budget-main">
      <section className="marketing-budget-hero">
        <div className="marketing-budget-hero-copy">
          <p className="marketing-section-kicker">{page.heroKicker}</p>
          <h1>{page.heroTitle}</h1>
          <p className="marketing-budget-hero-summary">{page.heroSummary}</p>
          <div className="marketing-hero-actions marketing-budget-hero-actions">
            <a className="marketing-primary-action" href={heroPrimaryHref} download={heroPrimaryDownload || undefined}>
              {heroPrimaryLabel}
            </a>
            <a className="marketing-secondary-action" href={heroSecondaryHref} download={heroSecondaryDownload || undefined}>
              {heroSecondaryLabel}
            </a>
          </div>
          <p className="marketing-budget-hero-note">{page.heroBody}</p>
        </div>

        <BudgetTemplateMockup />
      </section>

      {statItems.length ? (
        <section className="marketing-budget-section" aria-labelledby="budget-stats-title">
          <div className="marketing-budget-stats-row">
            {statItems.map((item) => (
              <article className="marketing-budget-stat-card" key={`${item.label}-${item.value}`}>
                <strong>{item.value}</strong>
                <h2>{item.label}</h2>
                {item.detail ? <p>{item.detail}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {costOverviewItems.length ? (
        <section className="marketing-budget-section" aria-labelledby="budget-cost-overview-title">
          <div className="marketing-budget-section-heading">
            <p className="marketing-section-kicker">Wedding Cost Overview</p>
            <h2 id="budget-cost-overview-title">{page.costOverviewTitle}</h2>
            {page.costOverviewIntro ? <p>{page.costOverviewIntro}</p> : null}
          </div>
          <div className="marketing-budget-overview-grid">
            {costOverviewItems.map((item) => (
              <article className="marketing-budget-overview-card" key={item.label}>
                <p className="marketing-budget-overview-label">{item.label}</p>
                <strong>{item.value}</strong>
                {item.detail ? <p>{item.detail}</p> : null}
              </article>
            ))}
          </div>
          <p className="marketing-budget-inline-copy marketing-budget-bridge">
            {page.costOverviewBridge} Pair it with the{" "}
            <a href="/wedding-guest-list-template">wedding guest list template</a>, the{" "}
            <a href="/guides/guest-list-rsvp">guest list and RSVP guide</a>, and the{" "}
            <a href="/wedding-budget-planner-app">wedding budget planner app</a> so the numbers stay connected to real guest decisions.
          </p>
        </section>
      ) : null}

      <section className="marketing-budget-section" aria-labelledby="budget-breakdown-title">
        <div className="marketing-budget-section-heading">
          <p className="marketing-section-kicker">Category Breakdown</p>
          <h2 id="budget-breakdown-title">{page.costBreakdownTitle}</h2>
          {page.costBreakdownIntro ? <p>{page.costBreakdownIntro}</p> : null}
        </div>

        <div className="marketing-budget-breakdown-layout">
          {costBreakdownRows.length ? (
            <article className="marketing-budget-table-card">
              <table className="marketing-budget-cost-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>% of Budget</th>
                    <th>Typical Cost Range</th>
                  </tr>
                </thead>
                <tbody>
                  {costBreakdownRows.map((item) => (
                    <tr key={item.category}>
                      <td>
                        <strong>{item.category}</strong>
                        {item.note ? <span>{item.note}</span> : null}
                      </td>
                      <td>{item.share}</td>
                      <td>{item.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ) : null}

          {splitSegments.length ? (
            <article className="marketing-budget-chart-card marketing-budget-chart-card-tall">
              <div className="marketing-budget-chart-copy">
                <h3>{splitChart?.title}</h3>
                {splitChart?.description ? <p>{splitChart.description}</p> : null}
              </div>
              <div className="marketing-budget-donut-stack">
                <div className="marketing-donut-chart marketing-budget-donut-chart" style={{ background: buildDonutBackground(splitSegments) }}>
                  <div className="marketing-donut-chart-hole">
                    <strong>{splitChart?.centerLabel || "100%"}</strong>
                    {splitChart?.centerNote ? <span>{splitChart.centerNote}</span> : null}
                  </div>
                </div>
                <div className="marketing-budget-segment-list">
                  {splitSegments.map((segment, index) => {
                    const color = segment?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
                    return (
                      <div className="marketing-budget-segment-pill" key={segment.label}>
                        <span className="marketing-chart-dot" style={{ backgroundColor: color }} aria-hidden="true" />
                        <strong>{segment.label}</strong>
                        <span>{formatChartValue(segment.value, "%")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {splitChart?.note ? <p className="marketing-budget-inline-copy">{splitChart.note}</p> : null}
              <p className="marketing-budget-inline-copy">
                Need more detail? Read the <a href="/guides/wedding-budget-planner">wedding budget planning guide</a> and connect vendor payments inside the{" "}
                <a href="/wedding-vendor-manager-app">wedding vendor manager app</a>.
              </p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="marketing-budget-section" aria-labelledby="budget-features-title">
        <div className="marketing-budget-section-heading">
          <p className="marketing-section-kicker">What This Solves</p>
          <h2 id="budget-features-title">A budget page that is fast to scan and useful in real planning.</h2>
        </div>
        <div className="marketing-budget-feature-grid">
          {page.highlights.map((item, index) => (
            <article className="marketing-budget-feature-card" key={item.title}>
              <BudgetTemplateIcon name={featureIcons[index] || "grid"} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-budget-section" aria-labelledby="budget-personas-title">
        <div className="marketing-budget-section-heading">
          <p className="marketing-section-kicker">Who It&apos;s For</p>
          <h2 id="budget-personas-title">Pick the same template up whether you are planning, approving, or managing.</h2>
        </div>
        <div className="marketing-budget-persona-row">
          {page.useCases.map((item, index) => (
            <article className="marketing-budget-persona-card" key={item.title}>
              <BudgetTemplateIcon name={personaIcons[index] || "team"} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-budget-section marketing-budget-section-soft" aria-labelledby="budget-insights-title">
        <div className="marketing-budget-section-heading">
          <p className="marketing-section-kicker">{page.dataSectionKicker}</p>
          <h2 id="budget-insights-title">{page.dataSectionTitle}</h2>
          {page.dataSectionIntro ? <p>{page.dataSectionIntro}</p> : null}
        </div>

        <div className="marketing-budget-chart-grid">
          {regionItems.length ? (
            <article className="marketing-budget-chart-card">
              <div className="marketing-budget-chart-copy">
                <h3>{regionChart?.title}</h3>
                {regionChart?.description ? <p>{regionChart.description}</p> : null}
              </div>
              <div className="marketing-budget-region-list">
                {regionItems.map((item, index) => {
                  const minValue = Math.max(0, Number(item?.min) || 0);
                  const maxValue = Math.max(minValue, Number(item?.max) || 0);
                  const left = `${(minValue / maxRegionValue) * 100}%`;
                  const width = `${((maxValue - minValue) / maxRegionValue) * 100}%`;
                  const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
                  return (
                    <div className="marketing-budget-region-row" key={item.label}>
                      <div className="marketing-budget-region-header">
                        <strong>{item.label}</strong>
                        <span>{formatChartValue(minValue, regionChart.unit)} to {formatChartValue(maxValue, regionChart.unit)}</span>
                      </div>
                      <div className="marketing-range-track">
                        <div className="marketing-range-fill" style={{ left, width, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}

          {priorityItems.length ? (
            <article className="marketing-budget-chart-card">
              <h3>{prioritiesChart?.title}</h3>
              <div className="marketing-budget-priority-list">
                {priorityItems.map((item, index) => {
                  const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
                  const width = `${((Number(item?.value) || 0) / maxPriorityValue) * 100}%`;
                  return (
                    <div className="marketing-budget-priority-row" key={item.label}>
                      <div className="marketing-budget-priority-header">
                        <strong>{item.label}</strong>
                        <span>{formatChartValue(item.value, prioritiesChart.unit)}</span>
                      </div>
                      <div className="marketing-range-track">
                        <div className="marketing-bars-fill" style={{ width, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}
        </div>

        {resourceLinks.length ? (
          <div className="marketing-budget-resource-row">
            {resourceLinks.map((item) => (
              <a className="marketing-budget-resource-card" href={item.href} key={item.href}>
                <strong>{item.label}</strong>
                {item.description ? <span>{item.description}</span> : null}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {guestItems.length ? (
        <section className="marketing-budget-section" aria-labelledby="budget-per-guest-title">
          <div className="marketing-budget-section-heading">
            <p className="marketing-section-kicker">Per Guest Cost</p>
            <h2 id="budget-per-guest-title">{page.perGuestTitle}</h2>
            {page.perGuestIntro ? <p>{page.perGuestIntro}</p> : null}
          </div>

          <div className="marketing-budget-per-guest-layout">
            <article className="marketing-budget-formula-card">
              <p className="marketing-budget-formula-label">Planning formula</p>
              <strong>{page.perGuestFormula}</strong>
              <p>
                Use the <a href="/wedding-guest-list-template">wedding guest list template</a> or the{" "}
                <a href="/guest-list-rsvp-app">guest list and RSVP app</a> first, because the guest count is what makes this number expand or stay controlled.
              </p>
            </article>

            <div className="marketing-budget-scenario-grid">
              {guestItems.map((item) => (
                <article className="marketing-budget-scenario-card" key={item.label}>
                  <p className="marketing-budget-overview-label">{item.label}</p>
                  <strong>{formatChartValue(item.min, guestCountChart.unit)} to {formatChartValue(item.max, guestCountChart.unit)}</strong>
                  {item.detail ? <p>{item.detail}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {seoBudgetSteps.length ? (
        <section className="marketing-budget-section" aria-labelledby="budget-seo-steps-title">
          <div className="marketing-budget-section-heading">
            <p className="marketing-section-kicker">How To Build It</p>
            <h2 id="budget-seo-steps-title">{page.seoBudgetStepsTitle}</h2>
            {page.seoBudgetStepsIntro ? <p>{page.seoBudgetStepsIntro}</p> : null}
          </div>
          <div className="marketing-budget-step-grid marketing-budget-seo-step-grid">
            {seoBudgetSteps.map((step, index) => (
              <article className="marketing-budget-step-card" key={step.title}>
                <div className="marketing-budget-step-top">
                  <span className="marketing-budget-step-number">{String(index + 1).padStart(2, "0")}</span>
                  <BudgetTemplateIcon name={seoStepIcons[index] || "spark"} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {howItWorksSteps.length ? (
        <section className="marketing-budget-section" aria-labelledby="budget-steps-title">
          <div className="marketing-budget-section-heading">
            <p className="marketing-section-kicker">Use It In VivahGo</p>
            <h2 id="budget-steps-title">Start with a template. Move into a live budget system when more people need one current version.</h2>
          </div>
          <div className="marketing-budget-step-grid">
            {howItWorksSteps.map((step, index) => (
              <article className="marketing-budget-step-card" key={step.title}>
                <div className="marketing-budget-step-top">
                  <span className="marketing-budget-step-number">{String(index + 1).padStart(2, "0")}</span>
                  <BudgetTemplateIcon name={stepIcons[index] || "spark"} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

        <section className="marketing-budget-section" aria-labelledby="budget-practical-title">
        <div className="marketing-budget-section-heading">
          <p className="marketing-section-kicker">Practical Tips</p>
          <h2 id="budget-practical-title">Use short action lists so the budget stays practical, not theoretical.</h2>
        </div>
        <div className="marketing-budget-copy-grid">
          {[buildSection, savingsSection].filter(Boolean).map((section) => (
            <article className="marketing-budget-copy-card" key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs?.[0] ? <p>{section.paragraphs[0]}</p> : null}
              {Array.isArray(section.bullets) && section.bullets.length ? (
                <ul className="marketing-budget-bullet-list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {templateSection ? (
        <section className="marketing-budget-section" aria-labelledby="budget-template-structure-title">
          <div className="marketing-budget-section-heading">
            <p className="marketing-section-kicker">Template Structure</p>
            <h2 id="budget-template-structure-title">{templateSection.heading}</h2>
            {templateSection.paragraphs?.[0] ? <p>{templateSection.paragraphs[0]}</p> : null}
          </div>
          <div className="marketing-budget-checklist-grid">
            {templateSection.bullets.map((bullet) => (
              <article className="marketing-budget-checklist-item" key={bullet}>
                <span aria-hidden="true" />
                <p>{bullet}</p>
              </article>
            ))}
          </div>
          <p className="marketing-budget-inline-copy marketing-budget-template-link-copy">
            If you want the budget to connect with tasks, guests, and vendors, move next to the <a href="/wedding-planner-app">wedding planner app</a> or the{" "}
            <a href="/for-wedding-planners">planner workflow page</a>.
          </p>
        </section>
      ) : null}

      {faqItems.length ? (
        <section className="marketing-budget-section" aria-labelledby="budget-faq-title">
          <div className="marketing-budget-section-heading">
            <p className="marketing-section-kicker">FAQs</p>
            <h2 id="budget-faq-title">Questions people ask before locking an Indian wedding budget.</h2>
          </div>
          <div className="marketing-budget-faq-list">
            {faqItems.map((item) => (
              <details className="marketing-budget-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="marketing-budget-final-cta" aria-labelledby="budget-final-cta-title">
        <div className="marketing-budget-final-cta-copy">
          <h2 id="budget-final-cta-title">{page.finalCtaTitle}</h2>
          <p>{page.finalCtaBody}</p>
        </div>
        <div className="marketing-hero-actions marketing-budget-cta-actions">
          <a className="marketing-primary-action" href={finalPrimaryHref} download={finalPrimaryDownload || undefined}>
            {finalPrimaryLabel}
          </a>
          <a className="marketing-secondary-action" href={finalSecondaryHref} download={finalSecondaryDownload || undefined}>
            {finalSecondaryLabel}
          </a>
        </div>
      </section>
    </main>
  );
}

export default function QueryCapturePage({ pageSlug = "" }) {
  const [session, setSession] = useState(() => readAuthSession());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const page = useMemo(() => {
    const nextPage = findQueryPageBySlug(pageSlug);
    return isRenderableQueryPage(nextPage) ? nextPage : null;
  }, [pageSlug]);
  const relatedPages = useMemo(
    () => (page?.relatedPageSlugs || []).map((slug) => QUERY_PAGE_BY_SLUG.get(slug)).filter(Boolean),
    [page]
  );
  const relatedGuides = useMemo(
    () => (page?.relatedGuideSlugs || []).map((slug) => GUIDE_BY_SLUG.get(slug)).filter(Boolean),
    [page]
  );
  const useCases = useMemo(
    () => (page?.useCases || []).filter((item) => Boolean(String(item?.title || "").trim() || String(item?.description || "").trim())),
    [page]
  );
  const heroPrimaryLabel = page?.heroPrimaryLabel || "Start Planning Free";
  const heroPrimaryHref = page?.heroPrimaryHref || PLANNER_HOME_URL;
  const heroPrimaryDownload = Boolean(page?.heroPrimaryDownload);
  const heroSecondaryLabel = page?.heroSecondaryLabel || "See Pricing";
  const heroSecondaryHref = page?.heroSecondaryHref || "/pricing";
  const heroSecondaryDownload = Boolean(page?.heroSecondaryDownload);
  const finalPrimaryLabel = page?.finalPrimaryLabel || "Start Planning Free";
  const finalPrimaryHref = page?.finalPrimaryHref || PLANNER_HOME_URL;
  const finalPrimaryDownload = Boolean(page?.finalPrimaryDownload);
  const finalSecondaryLabel = page?.finalSecondaryLabel || "Read More Guides";
  const finalSecondaryHref = page?.finalSecondaryHref || "/guides";
  const finalSecondaryDownload = Boolean(page?.finalSecondaryDownload);
  const heroMedia = page?.heroMedia && page.heroMedia.src ? page.heroMedia : null;
  const isBudgetTemplatePage = page?.slug === BUDGET_TEMPLATE_PAGE_SLUG;
  const shouldRedirectToCanonical = Boolean(page && pageSlug && pageSlug !== page.slug);

  usePageSeo(
    page
      ? {
        title: page.seoTitle,
        description: page.seoDescription,
        canonicalUrl: getMarketingUrl(`/${page.slug}`),
        structuredData: buildStructuredData(page, relatedGuides, relatedPages),
      }
      : {
        title: "VivahGo | Wedding Planner App for Indian Weddings",
        description: "VivahGo is a wedding planner app for Indian weddings that helps couples, families, and planners manage checklists, budgets, guests, vendors, RSVPs, timelines, and wedding websites in one shared workspace.",
        canonicalUrl: MARKETING_HOME_URL,
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!page) {
      window.location.replace(MARKETING_HOME_URL);
      return undefined;
    }

    if (pageSlug && pageSlug !== page.slug) {
      window.location.replace(`/${page.slug}`);
      return undefined;
    }

    return undefined;
  }, [page, pageSlug]);

  if (!page || shouldRedirectToCanonical) {
    return null;
  }

  return (
    <div className={`marketing-home-shell${isBudgetTemplatePage ? " marketing-budget-template-page" : ""}`}>
      <MarketingSiteHeader activePage="home" session={session} onContactUs={() => setShowFeedbackModal(true)} />

      {isBudgetTemplatePage ? (
        <BudgetTemplateLandingPage
          page={page}
          heroPrimaryLabel={heroPrimaryLabel}
          heroPrimaryHref={heroPrimaryHref}
          heroPrimaryDownload={heroPrimaryDownload}
          heroSecondaryLabel={heroSecondaryLabel}
          heroSecondaryHref={heroSecondaryHref}
          heroSecondaryDownload={heroSecondaryDownload}
          finalPrimaryLabel={finalPrimaryLabel}
          finalPrimaryHref={finalPrimaryHref}
          finalPrimaryDownload={finalPrimaryDownload}
          finalSecondaryLabel={finalSecondaryLabel}
          finalSecondaryHref={finalSecondaryHref}
          finalSecondaryDownload={finalSecondaryDownload}
        />
      ) : (
      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="marketing-hero-copy">
            <p className="marketing-kicker">{page.heroKicker}</p>
            <h1>{page.heroTitle}</h1>
            <p className="marketing-summary">{page.heroSummary}</p>
            <p className="marketing-summary">{page.heroBody}</p>

            <div className="marketing-hero-actions">
              <a className="marketing-primary-action" href={heroPrimaryHref} download={heroPrimaryDownload || undefined}>
                {heroPrimaryLabel}
              </a>
              <a className="marketing-secondary-action marketing-secondary-action-gold" href={heroSecondaryHref} download={heroSecondaryDownload || undefined}>
                {heroSecondaryLabel}
              </a>
            </div>
          </div>
        </section>

        {heroMedia ? (
          <section className="marketing-section marketing-inline-media-section" aria-label={`${page.title} image`}>
            <figure className="marketing-inline-media-card">
              <img
                className="marketing-inline-media-image"
                src={heroMedia.src}
                alt={heroMedia.alt || page.title}
                loading="eager"
                decoding="async"
                style={heroMedia.aspectRatio ? { aspectRatio: heroMedia.aspectRatio } : undefined}
              />
              {heroMedia.creditLabel && heroMedia.creditHref ? (
                <figcaption className="marketing-inline-media-caption">
                  <a href={heroMedia.creditHref} target="_blank" rel="noreferrer">
                    {heroMedia.creditLabel}
                  </a>
                </figcaption>
              ) : null}
            </figure>
          </section>
        ) : null}

        <section className="marketing-section" aria-labelledby="query-page-highlights-title">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Why This Page Matters</p>
            <h2 id="query-page-highlights-title">{page.title} features that solve real wedding planning problems.</h2>
          </div>

          <div className="marketing-feature-grid">
            {page.highlights.map((item) => (
              <article className="marketing-feature-card marketing-feature-card-left" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {useCases.length ? (
          <section className="marketing-section" aria-labelledby="query-page-use-cases-title">
            <div className="marketing-section-heading">
              <p className="marketing-section-kicker">Best For</p>
              <h2 id="query-page-use-cases-title">Who gets the most value from this workflow.</h2>
            </div>

            <div className="marketing-feature-grid">
              {useCases.map((item) => (
                <article className="marketing-feature-card marketing-feature-card-left" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <QueryPageDataSection page={page} />

        {page.sections.map((section) => (
          <section className="marketing-section" key={section.heading}>
            <div className="marketing-section-heading">
              <h2>{section.heading}</h2>
            </div>
            <div className="marketing-guide-body">
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
          </section>
        ))}

        <section className="marketing-section" id="query-page-faqs">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">FAQs</p>
            <h2>Questions people ask about {page.title.toLowerCase()} choices.</h2>
          </div>

          <div className="marketing-faq-list">
            {page.faqs.map((item) => (
              <details className="marketing-faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {relatedPages.length ? (
          <section className="marketing-section" aria-labelledby="related-query-pages-title">
            <div className="marketing-section-heading">
              <p className="marketing-section-kicker">Related Planning Pages</p>
              <h2 id="related-query-pages-title">Compare nearby planning workflows.</h2>
            </div>

            <div className="marketing-guides-grid">
              {relatedPages.map((item) => (
                <a className="marketing-guide-card marketing-guide-card-link" href={`/${item.slug}`} key={item.slug}>
                  <div className="marketing-guide-card-body">
                    <div className="marketing-guide-card-meta">
                      <span>Query Page</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.heroSummary}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {relatedGuides.length ? (
          <section className="marketing-section" aria-labelledby="related-guides-title">
            <div className="marketing-section-heading">
              <p className="marketing-section-kicker">Related Guides</p>
              <h2 id="related-guides-title">Read supporting guides before you start planning.</h2>
            </div>

            <div className="marketing-guides-grid">
              {relatedGuides.map((guide) => (
                <a className="marketing-guide-card marketing-guide-card-link" href={`/guides/${guide.slug}`} key={guide.slug}>
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
        ) : null}

        <section className="marketing-section marketing-final-cta">
          <div className="marketing-section-heading">
            <h2 className="marketing-final-cta-title">{page.finalCtaTitle || "Turn this planning topic into a working wedding system."}</h2>
            <p>{page.finalCtaBody || "Move from reading about the workflow to running it inside a shared VivahGo workspace."}</p>
          </div>
          <div className="marketing-hero-actions marketing-final-actions">
            <a className="marketing-primary-action" href={finalPrimaryHref} download={finalPrimaryDownload || undefined}>
              {finalPrimaryLabel}
            </a>
            <a className="marketing-secondary-action marketing-secondary-action-gold" href={finalSecondaryHref} download={finalSecondaryDownload || undefined}>
              {finalSecondaryLabel}
            </a>
          </div>
        </section>
      </main>
      )}

      <LegalFooter
        className="marketing-legal-footer"
        hasBottomNav={false}
        onOpenFeedback={() => setShowFeedbackModal(true)}
      />

      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
