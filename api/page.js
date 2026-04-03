const fs = require('node:fs');
const path = require('node:path');

const { setSecurityHeaders } = require('./_lib/core');
const plannerModule = require('./planner');
const keywordLibrary = require('../vivahgo/src/generated/seo-keywords.json');
const guides = require('../vivahgo/src/shared/content/guides.json');
const queryPages = require('../vivahgo/src/shared/content/query-pages.json');

const DEFAULT_SITE_URL = 'https://vivahgo.com';
const DEFAULT_IMAGE_PATH = '/social-preview.jpg';
const STRUCTURED_DATA_KEYWORDS = keywordLibrary.clusters.primary.slice(0, 24).join(', ');
const COVERAGE_TOPICS = [
  ...keywordLibrary.clusters.primary.slice(0, 8),
  ...keywordLibrary.clusters.cultural.slice(0, 4),
];
const GUIDE_BY_SLUG = new Map(guides.map((guide) => [guide.slug, guide]));
const QUERY_PAGE_BY_SLUG = new Map(queryPages.map((page) => [page.slug, page]));
const DEFAULT_DONUT_COLORS = ['#bb4d28', '#d06d3d', '#f3bf73', '#7d2512', '#a95c2b', '#f0d6a2', '#6b3a2c', '#e18f5e'];
const BUDGET_TEMPLATE_PAGE_SLUG = 'indian-wedding-budget-template';
const QUERY_PAGE_ALIASES = {
  'free-wedding-budget-template': BUDGET_TEMPLATE_PAGE_SLUG,
};
const PAGE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' https://accounts.google.com https://apis.google.com https://www.gstatic.com https://www.chatbase.co",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://www.chatbase.co",
  "frame-src 'self' https://www.google.com https://accounts.google.com https://www.chatbase.co",
  "media-src 'self' blob: https:",
  "form-action 'self'",
].join('; ');
const HOME_FAQS = [
  {
    question: 'Is VivahGo for couples or planners?',
    answer: 'Both. Couples and families can run their own wedding here, and planners can use it to manage client coordination with more visibility.',
  },
  {
    question: 'Can family members be involved without creating more confusion?',
    answer: 'Yes. VivahGo is built for shared visibility, so people can stay involved without relying on scattered chats and repeated updates.',
  },
  {
    question: 'When should we start using it?',
    answer: 'As early as possible. It helps most before details spread across WhatsApp, notes, and spreadsheets.',
  },
];
const HOME_SNAPSHOT_CAPABILITY_BUCKETS = [
  {
    label: 'Plan',
    intro: 'Structure the wedding early so every ceremony starts from the same playbook.',
    items: [
      {
        title: 'Stay on top of every ceremony',
        description: 'Use the wedding checklist app to track tasks, owners, and deadlines across every function.',
      },
      {
        title: 'Keep the full timeline usable',
        description: 'Map roka, mehndi, sangeet, haldi, wedding day, and reception in one connected timeline.',
      },
      {
        title: 'Start faster with Indian wedding templates',
        description: 'Use templates built for cultural ceremonies, stakeholders, and multi-event weddings.',
      },
    ],
  },
  {
    label: 'Track',
    intro: 'See the whole wedding in one dashboard, then go deeper where decisions are moving.',
    items: [
      {
        title: 'Stay in control of your budget',
        description: 'Use the wedding budget planner to compare planned vs actual spend before it becomes stress.',
      },
      {
        title: 'Keep guest decisions current',
        description: 'Track guests, RSVPs, family sides, and headcounts without juggling multiple sheets.',
      },
      {
        title: 'See payments before they turn urgent',
        description: 'Monitor vendor advances, due dates, and pending balances from one dashboard.',
      },
    ],
  },
  {
    label: 'Coordinate',
    intro: 'Keep people, vendors, and approvals aligned without repeated follow-ups.',
    items: [
      {
        title: 'Run vendor work with less follow-up',
        description: 'Use the wedding vendor manager to track bookings, deliverables, and event-day dependencies.',
      },
      {
        title: 'Keep everyone on the same page',
        description: 'Give couples, families, and planners one shared workspace instead of parallel versions.',
      },
    ],
  },
];
const HOME_SNAPSHOT_AUDIENCES = [
  'Couples who want one shared wedding plan instead of scattered chats and spreadsheets.',
  'Families who need visibility into guests, budgets, events, and approvals without confusion.',
  'Wedding planners and studios managing multi-event Indian weddings with several vendors and stakeholders.',
];
const PRICING_SNAPSHOT_PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'Best for couples moving their wedding plan out of chats and into one shared workspace.',
    features: [
      '1 unified wedding workspace',
      'Events, guests, budgets, and vendors together',
      'Checklist and progress tracking',
      'WhatsApp guest reminders',
    ],
  },
  {
    name: 'Premium',
    price: 'INR 2000/month',
    description: 'Best for active planning with more family collaboration, wedding website needs, and tighter coordination.',
    features: [
      'Everything in Starter',
      'Unlimited wedding workspaces',
      'Personalized wedding website',
      'Scheduled reminders and advanced workspace management',
    ],
  },
  {
    name: 'Studio',
    price: 'INR 5000/month',
    description: 'Best for planners and studios running several client weddings with operational visibility.',
    features: [
      'Everything in Premium',
      'Client-ready workspaces',
      'Custom templates',
      'Support for planner-led wedding operations',
    ],
  },
];

let cachedHtmlTemplate = null;

function getCanonicalQueryPageSlug(slug = '') {
  return QUERY_PAGE_ALIASES[slug] || slug;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function formatDisplayLabel(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split('-').map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)).join('-'))
    .join(' ');
}

function renderSnapshotList(items, className = 'marketing-guide-list') {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    return '';
  }

  return `<ul class="${escapeAttribute(className)}">${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderSnapshotParagraphs(paragraphs) {
  const safeParagraphs = Array.isArray(paragraphs) ? paragraphs.filter(Boolean) : [];
  return safeParagraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function renderSnapshotActions(actions) {
  const safeActions = Array.isArray(actions) ? actions.filter((item) => item?.href && item?.label) : [];
  if (!safeActions.length) {
    return '';
  }

  return `<div class="marketing-hero-actions">${safeActions.map((action) => (
    `<a class="${escapeAttribute(action.className || 'marketing-secondary-action')}" href="${escapeAttribute(action.href)}"${action.download ? ' download' : ''}>${escapeHtml(action.label)}</a>`
  )).join('')}</div>`;
}

function formatChartNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value || '');
  }

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1);
}

function formatChartValue(value, unit = '') {
  const normalizedUnit = String(unit || '').trim();
  if (normalizedUnit === 'Rs. lakh') {
    return `Rs. ${formatChartNumber(value)} lakh`;
  }
  if (normalizedUnit === '%') {
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

  return stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e9d4be 0% 100%)';
}

function buildQueryPageDataSnapshot(page) {
  const dataInsights = Array.isArray(page?.dataInsights) ? page.dataInsights.filter((item) => item?.value && item?.label) : [];
  const dataCharts = Array.isArray(page?.dataCharts) ? page.dataCharts.filter((item) => item?.title) : [];
  if (!dataInsights.length && !dataCharts.length) {
    return '';
  }

  const insightMarkup = dataInsights.map((item) => `
            <article class="marketing-data-card">
              <p class="marketing-data-value">${escapeHtml(item.value)}</p>
              <h3>${escapeHtml(item.label)}</h3>
              ${item.detail ? `<p class="marketing-data-caption">${escapeHtml(item.detail)}</p>` : ''}
            </article>`).join('');

  const chartMarkup = dataCharts.map((chart) => {
    if (chart.type === 'donut') {
      const donutSegments = Array.isArray(chart.segments) ? chart.segments.filter((segment) => segment?.label) : [];
      if (!donutSegments.length) {
        return '';
      }

      const legendMarkup = donutSegments.map((segment, index) => {
        const color = segment?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
        return `
                    <div class="marketing-chart-legend-row">
                      <span class="marketing-chart-dot" style="background-color: ${escapeAttribute(color)};" aria-hidden="true"></span>
                      <div>
                        <strong>${escapeHtml(segment.label)}</strong>
                        <p>${escapeHtml(formatChartValue(segment.value, '%'))}${segment.detail ? ` • ${escapeHtml(segment.detail)}` : ''}</p>
                      </div>
                    </div>`;
      }).join('');

      return `
            <article class="marketing-data-card marketing-data-card-chart">
              <div class="marketing-data-chart-header">
                <h3>${escapeHtml(chart.title)}</h3>
                ${chart.description ? `<p>${escapeHtml(chart.description)}</p>` : ''}
              </div>
              <div class="marketing-donut-layout">
                <div class="marketing-donut-chart" style="background: ${escapeAttribute(buildDonutBackground(donutSegments))};">
                  <div class="marketing-donut-chart-hole">
                    <strong>${escapeHtml(chart.centerLabel || '100%')}</strong>
                    ${chart.centerNote ? `<span>${escapeHtml(chart.centerNote)}</span>` : ''}
                  </div>
                </div>
                <div class="marketing-chart-legend">${legendMarkup}
                </div>
              </div>
              ${chart.note ? `<p class="marketing-data-note">${escapeHtml(chart.note)}</p>` : ''}
            </article>`;
    }

    if (chart.type === 'range-bars') {
      const rangeItems = Array.isArray(chart.items) ? chart.items.filter((item) => item?.label) : [];
      if (!rangeItems.length) {
        return '';
      }
      const maxValue = Math.max(...rangeItems.map((item) => Number(item?.max) || 0), 1);
      const rows = rangeItems.map((item, index) => {
        const minValue = Math.max(0, Number(item?.min) || 0);
        const upperValue = Math.max(minValue, Number(item?.max) || 0);
        const left = `${(minValue / maxValue) * 100}%`;
        const width = `${((upperValue - minValue) / maxValue) * 100}%`;
        const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];

        return `
                    <div class="marketing-range-row">
                      <div class="marketing-range-header">
                        <strong>${escapeHtml(item.label)}</strong>
                        <span>${escapeHtml(formatChartValue(minValue, chart.unit))} to ${escapeHtml(formatChartValue(upperValue, chart.unit))}</span>
                      </div>
                      <div class="marketing-range-track">
                        <div class="marketing-range-fill" style="left: ${escapeAttribute(left)}; width: ${escapeAttribute(width)}; background-color: ${escapeAttribute(color)};"></div>
                      </div>
                      ${item.detail ? `<p class="marketing-range-note">${escapeHtml(item.detail)}</p>` : ''}
                    </div>`;
      }).join('');

      return `
            <article class="marketing-data-card marketing-data-card-chart">
              <div class="marketing-data-chart-header">
                <h3>${escapeHtml(chart.title)}</h3>
                ${chart.description ? `<p>${escapeHtml(chart.description)}</p>` : ''}
              </div>
              <div class="marketing-range-chart">${rows}
              </div>
              ${chart.note ? `<p class="marketing-data-note">${escapeHtml(chart.note)}</p>` : ''}
            </article>`;
    }

    if (chart.type === 'bars') {
      const barItems = Array.isArray(chart.items) ? chart.items.filter((item) => item?.label) : [];
      if (!barItems.length) {
        return '';
      }
      const maxValue = Math.max(...barItems.map((item) => Number(item?.value) || 0), 1);
      const rows = barItems.map((item, index) => {
        const numericValue = Math.max(0, Number(item?.value) || 0);
        const width = `${(numericValue / maxValue) * 100}%`;
        const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];

        return `
                    <div class="marketing-bars-row">
                      <div class="marketing-range-header">
                        <strong>${escapeHtml(item.label)}</strong>
                        <span>${escapeHtml(formatChartValue(numericValue, chart.unit))}</span>
                      </div>
                      <div class="marketing-range-track">
                        <div class="marketing-bars-fill" style="width: ${escapeAttribute(width)}; background-color: ${escapeAttribute(color)};"></div>
                      </div>
                      ${item.detail ? `<p class="marketing-range-note">${escapeHtml(item.detail)}</p>` : ''}
                    </div>`;
      }).join('');

      return `
            <article class="marketing-data-card marketing-data-card-chart">
              <div class="marketing-data-chart-header">
                <h3>${escapeHtml(chart.title)}</h3>
                ${chart.description ? `<p>${escapeHtml(chart.description)}</p>` : ''}
              </div>
              <div class="marketing-bars-chart">${rows}
              </div>
              ${chart.note ? `<p class="marketing-data-note">${escapeHtml(chart.note)}</p>` : ''}
            </article>`;
    }

    return '';
  }).filter(Boolean).join('');

  return `
        <section class="marketing-section" aria-labelledby="seo-query-data-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">${escapeHtml(page.dataSectionKicker || 'Budget Benchmarks')}</p>
            <h2 id="seo-query-data-title">${escapeHtml(page.dataSectionTitle || 'Planning data that makes the budget easier to trust.')}</h2>
            ${page.dataSectionIntro ? `<p>${escapeHtml(page.dataSectionIntro)}</p>` : ''}
          </div>
          ${insightMarkup ? `<div class="marketing-data-grid">${insightMarkup}
          </div>` : ''}
          ${chartMarkup ? `<div class="marketing-data-chart-grid">${chartMarkup}
          </div>` : ''}
        </section>`;
}

function getRequestSiteUrl(req) {
  const configuredSiteUrl = [
    process.env.VITE_SITE_URL,
    process.env.SITE_URL,
    process.env.PUBLIC_SITE_URL,
  ].find((value) => typeof value === 'string' && value.trim());
  if (configuredSiteUrl) {
    return configuredSiteUrl.trim().replace(/\/$/, '');
  }

  const forwardedProto = typeof req.headers?.['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto'].split(',')[0].trim()
    : '';
  const forwardedHost = typeof req.headers?.['x-forwarded-host'] === 'string'
    ? req.headers['x-forwarded-host'].split(',')[0].trim()
    : '';
  const host = forwardedHost || req.headers?.host || '';
  if (host && !/^(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(host)) {
    return `${forwardedProto || 'https'}://${host}`.replace(/\/$/, '');
  }

  return DEFAULT_SITE_URL;
}

function buildAbsoluteUrl(req, value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  try {
    return new URL(normalized).href;
  } catch {
    const siteUrl = getRequestSiteUrl(req);
    const pathname = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return new URL(pathname, `${siteUrl}/`).href;
  }
}

function buildMarketingUrl(pathname = '/') {
  return new URL(pathname, `${DEFAULT_SITE_URL}/`).href;
}

function readBuiltHtmlTemplate() {
  if (cachedHtmlTemplate) {
    return cachedHtmlTemplate;
  }

  const rootDir = process.cwd();
  const candidates = [
    path.join(rootDir, 'vivahgo', 'dist', 'index.html'),
    path.join(rootDir, 'VivahGo', 'dist', 'index.html'),
    path.join(rootDir, 'vivahgo', 'index.html'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedHtmlTemplate = fs.readFileSync(candidate, 'utf8');
      return cachedHtmlTemplate;
    }
  }

  throw new Error('Could not locate the built app shell.');
}

function stripManagedSeo(html) {
  return String(html || '')
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta[^>]+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name="robots"[^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name="theme-color"[^>]*>\s*/gi, '')
    .replace(/<meta[^>]+property="og:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<meta[^>]+name="twitter:[^"]+"[^>]*>\s*/gi, '')
    .replace(/<link[^>]+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<script[^>]+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, '');
}

function buildSeoMarkup(meta, req) {
  const title = escapeHtml(meta.title);
  const description = escapeAttribute(meta.description);
  const robots = escapeAttribute(meta.robots || 'index, follow');
  const canonicalUrl = escapeAttribute(buildAbsoluteUrl(req, meta.canonicalUrl || meta.canonicalPath || '/'));
  const imageUrl = escapeAttribute(buildAbsoluteUrl(req, meta.image || DEFAULT_IMAGE_PATH));
  const imageAlt = escapeAttribute(meta.imageAlt || 'VivahGo wedding planning preview');
  const type = escapeAttribute(meta.type || 'website');
  const themeColor = escapeAttribute(meta.themeColor || '#6b0f0f');
  const locale = escapeAttribute(meta.locale || 'en_IN');
  const structuredData = Array.isArray(meta.structuredData)
    ? meta.structuredData.filter(Boolean)
    : (meta.structuredData ? [meta.structuredData] : []);

  const lines = [
    `    <title>${title}</title>`,
    `    <meta name="description" content="${description}" />`,
    `    <meta name="robots" content="${robots}" />`,
    `    <meta name="theme-color" content="${themeColor}" />`,
    `    <link rel="canonical" href="${canonicalUrl}" />`,
    `    <meta property="og:type" content="${type}" />`,
    `    <meta property="og:site_name" content="VivahGo" />`,
    `    <meta property="og:locale" content="${locale}" />`,
    `    <meta property="og:title" content="${escapeAttribute(meta.title)}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:url" content="${canonicalUrl}" />`,
    `    <meta property="og:image" content="${imageUrl}" />`,
    `    <meta property="og:image:type" content="image/jpeg" />`,
    `    <meta property="og:image:width" content="1200" />`,
    `    <meta property="og:image:height" content="630" />`,
    `    <meta property="og:image:alt" content="${imageAlt}" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${escapeAttribute(meta.title)}" />`,
    `    <meta name="twitter:description" content="${description}" />`,
    `    <meta name="twitter:image" content="${imageUrl}" />`,
    `    <meta name="twitter:image:alt" content="${imageAlt}" />`,
  ];

  for (const item of structuredData) {
    lines.push(`    <script type="application/ld+json">${escapeJsonForHtml(item)}</script>`);
  }

  return lines.join('\n');
}

function injectMetadataIntoHtml(html, meta, req) {
  const baseHtml = stripManagedSeo(html);
  const seoMarkup = buildSeoMarkup(meta, req);

  if (/<script[^>]+type="module"/i.test(baseHtml)) {
    return baseHtml.replace(/(\s*<script[^>]+type="module")/i, `\n${seoMarkup}\n$1`);
  }

  return baseHtml.replace(/<\/head>/i, `\n${seoMarkup}\n  </head>`);
}

function injectRootMarkupIntoHtml(html, rootMarkup = '') {
  const root = `<div id="root">${rootMarkup || ''}</div>`;

  if (/<div id="root">\s*<\/div>/i.test(html)) {
    return html.replace(/<div id="root">\s*<\/div>/i, root);
  }

  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<\/body>/i, `${root}</body>`);
  }

  return `${html}${root}`;
}

function buildHomeSnapshot() {
  const capabilityMarkup = HOME_SNAPSHOT_CAPABILITY_BUCKETS.map((bucket) => `
            <article class="marketing-feature-card marketing-feature-card-left marketing-capability-bucket-card">
              <div class="marketing-capability-bucket-head">
                <p class="marketing-capability-bucket-label">${escapeHtml(bucket.label)}</p>
                <p class="marketing-capability-bucket-intro">${escapeHtml(bucket.intro)}</p>
              </div>
              <div class="marketing-capability-list">${bucket.items.map((item) => `
                <div class="marketing-capability-item">
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.description)}</p>
                </div>`).join('')}
              </div>
            </article>`).join('');
  const queryPageMarkup = queryPages.map((page) => `
              <article class="marketing-guide-card">
                <div class="marketing-guide-card-body">
                  <div class="marketing-guide-card-meta"><span>Planning Page</span></div>
                  <h3><a href="${escapeAttribute(buildMarketingUrl(`/${page.slug}`))}">${escapeHtml(page.title)}</a></h3>
                  <p>${escapeHtml(page.heroSummary)}</p>
                </div>
              </article>`).join('');
  const guideMarkup = guides.slice(0, 3).map((guide) => `
              <article class="marketing-guide-card">
                <div class="marketing-guide-card-body">
                  <div class="marketing-guide-card-meta"><span>${escapeHtml(guide.readTime)}</span></div>
                  <h3><a href="${escapeAttribute(buildMarketingUrl(`/guides/${guide.slug}`))}">${escapeHtml(guide.title)}</a></h3>
                  <p>${escapeHtml(guide.summary)}</p>
                </div>
              </article>`).join('');
  const faqMarkup = HOME_FAQS.map((item) => `
            <details class="marketing-faq-item">
              <summary>${escapeHtml(item.question)}</summary>
              <p>${escapeHtml(item.answer)}</p>
            </details>`).join('');

  return `
    <div class="marketing-home-shell" data-seo-snapshot="home">
      <main class="marketing-main">
        <section class="marketing-hero">
          <div class="marketing-hero-copy">
            <p class="marketing-kicker">Wedding planner app for Indian weddings</p>
            <h1>The wedding planner app that keeps your entire wedding in one place.</h1>
            <p class="marketing-summary">VivahGo helps couples, families, and planners manage guests, budgets, vendors, RSVPs, timelines, and family coordination together in a single shared workspace.</p>
            <p class="marketing-summary">Use it as your wedding checklist app, budget planner, guest list manager, RSVP tracker, and vendor coordination system across every ceremony.</p>
            ${renderSnapshotActions([
              { href: 'https://planner.vivahgo.com/', label: 'Start Planning Free', className: 'marketing-primary-action' },
              { href: '/pricing', label: 'See Pricing', className: 'marketing-secondary-action marketing-secondary-action-gold' },
              { href: '/guides', label: 'Read Guides', className: 'marketing-secondary-action' },
            ])}
          </div>
        </section>

        <section class="marketing-section" aria-labelledby="seo-home-capabilities-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Planner App Features</p>
            <h2 id="seo-home-capabilities-title">Everything a wedding planner app should actually help you manage.</h2>
            <p>VivahGo keeps the core planning workflows clear enough to scan and strong enough to run a real wedding from.</p>
          </div>
          <div class="marketing-feature-grid marketing-capability-bucket-grid">${capabilityMarkup}
          </div>
        </section>

        <section class="marketing-section" aria-labelledby="seo-home-audience-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Built For Real Wedding Workflows</p>
            <h2 id="seo-home-audience-title">Made for couples, families, and planners managing Indian weddings.</h2>
          </div>
          ${renderSnapshotList(HOME_SNAPSHOT_AUDIENCES)}
        </section>

        <section class="marketing-section" aria-labelledby="seo-home-guides-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Planning Resources</p>
            <h2 id="seo-home-guides-title">Explore practical guides that support the app.</h2>
            <p>Use the guide library for checklists, budgets, guest planning, vendor coordination, and ceremony-specific timelines.</p>
          </div>
          <div class="marketing-guides-grid">${guideMarkup}
          </div>
        </section>

        <section class="marketing-section" aria-labelledby="seo-home-query-pages-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Planning Pages</p>
            <h2 id="seo-home-query-pages-title">Explore dedicated pages for the exact planning workflow you need.</h2>
            <p>Jump directly into checklist planning, budgeting, guest tracking, vendor coordination, free templates, and planner-specific workflows.</p>
          </div>
          <div class="marketing-guides-grid">${queryPageMarkup}
          </div>
        </section>

        <section class="marketing-section" id="seo-home-faqs">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">FAQs</p>
            <h2>Questions people ask before they start planning</h2>
          </div>
          <div class="marketing-faq-list">${faqMarkup}
          </div>
        </section>
      </main>
    </div>`;
}

function buildPricingSnapshot() {
  const planMarkup = PRICING_SNAPSHOT_PLANS.map((plan) => `
            <article class="marketing-pricing-card">
              <div class="marketing-pricing-card-copy">
                <p class="marketing-section-kicker">${escapeHtml(plan.name)}</p>
                <h2>${escapeHtml(plan.price)}</h2>
                <p>${escapeHtml(plan.description)}</p>
                ${renderSnapshotList(plan.features)}
              </div>
            </article>`).join('');

  return `
    <div class="marketing-home-shell" data-seo-snapshot="pricing">
      <main class="marketing-main">
        <section class="marketing-section marketing-pricing-page-intro">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Wedding Planner App Pricing</p>
            <h1>Choose the VivahGo plan that fits your wedding or planning business.</h1>
            <p>Compare plans for couples, families, and wedding planners who need one shared workspace for guests, budgets, vendors, RSVPs, and wedding websites.</p>
          </div>
          ${renderSnapshotActions([
            { href: 'https://planner.vivahgo.com/', label: 'Start Planning Free', className: 'marketing-primary-action' },
            { href: '/guides', label: 'Read Guides', className: 'marketing-secondary-action' },
          ])}
        </section>

        <section class="marketing-section" aria-labelledby="seo-pricing-plans-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Plans</p>
            <h2 id="seo-pricing-plans-title">Pricing for every stage of wedding planning.</h2>
          </div>
          <div class="marketing-pricing-grid">${planMarkup}
          </div>
        </section>
      </main>
    </div>`;
}

function buildGuidesSnapshot() {
  const guideMarkup = guides.map((guide) => `
            <article class="marketing-guide-card">
              <div class="marketing-guide-card-body">
                <div class="marketing-guide-card-meta"><span>${escapeHtml(guide.readTime)}</span></div>
                <h2><a href="${escapeAttribute(buildMarketingUrl(`/guides/${guide.slug}`))}">${escapeHtml(guide.title)}</a></h2>
                <p>${escapeHtml(guide.summary)}</p>
              </div>
            </article>`).join('');

  return `
    <div class="marketing-home-shell" data-seo-snapshot="guides">
      <main class="marketing-main">
        <section class="marketing-hero">
          <div class="marketing-hero-copy">
            <p class="marketing-kicker">Wedding planning guides</p>
            <h1>Find the guide you need for your next wedding planning decision.</h1>
            <p class="marketing-summary">Browse Indian wedding planning guides for checklists, budgets, guest lists, vendor coordination, cultural timelines, and destination wedding workflows.</p>
            ${renderSnapshotActions([
              { href: 'https://planner.vivahgo.com/', label: 'Start Planning Free', className: 'marketing-primary-action' },
              { href: '/pricing', label: 'See Pricing', className: 'marketing-secondary-action marketing-secondary-action-gold' },
            ])}
          </div>
        </section>

        <section class="marketing-section" aria-labelledby="seo-guides-library-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Guide Library</p>
            <h2 id="seo-guides-library-title">Published wedding planning resources</h2>
          </div>
          <div class="marketing-guides-grid">${guideMarkup}
          </div>
        </section>
      </main>
    </div>`;
}

function buildGuideSnapshot(guide) {
  if (!guide) {
    return `
      <div class="marketing-home-shell" data-seo-snapshot="guide-missing">
        <main class="marketing-main">
          <section class="marketing-section marketing-pricing-page-intro">
            <div class="marketing-section-heading">
              <p class="marketing-section-kicker">Guide Not Found</p>
              <h1>This guide is not available yet.</h1>
              <p>Return to the guides hub to browse the published guide pages.</p>
            </div>
            ${renderSnapshotActions([
              { href: '/guides', label: 'Back to Guides', className: 'marketing-primary-action' },
            ])}
          </section>
        </main>
      </div>`;
  }

  const sectionMarkup = guide.sections.map((section) => `
            <section class="marketing-guide-subsection">
              <h2>${escapeHtml(section.heading)}</h2>
              ${renderSnapshotParagraphs(section.paragraphs)}
              ${renderSnapshotList(section.bullets)}
            </section>`).join('');

  return `
    <div class="marketing-home-shell" data-seo-snapshot="guide">
      <main class="marketing-main">
        <section class="marketing-section marketing-guide-article-hero">
          <div class="marketing-guide-article-copy">
            <p class="marketing-section-kicker">Guide</p>
            <h1>${escapeHtml(guide.title)}</h1>
            <p class="marketing-summary">${escapeHtml(guide.summary)}</p>
            <p>${escapeHtml(guide.seoDescription)}</p>
            ${renderSnapshotActions([
              { href: 'https://planner.vivahgo.com/', label: 'Open VivahGo Planner', className: 'marketing-primary-action' },
              { href: '/guides', label: 'Back to Guides', className: 'marketing-secondary-action' },
            ])}
          </div>
        </section>

        <section class="marketing-section marketing-guide-section">
          <div class="marketing-guide-body">${sectionMarkup}
          </div>
        </section>
      </main>
      </div>`;
}

function isRenderableQueryPage(page) {
  if (!page || typeof page !== 'object') {
    return false;
  }

  const hasTitle = Boolean(String(page.title || '').trim());
  const hasSlug = Boolean(String(page.slug || '').trim());
  const hasHero = [page.heroTitle, page.heroSummary, page.heroBody].some((value) => Boolean(String(value || '').trim()));
  const hasHighlights = Array.isArray(page.highlights) && page.highlights.some((item) => (
    Boolean(String(item?.title || '').trim()) || Boolean(String(item?.description || '').trim())
  ));
  const hasSections = Array.isArray(page.sections) && page.sections.some((section) => (
    Boolean(String(section?.heading || '').trim())
    || (Array.isArray(section?.paragraphs) && section.paragraphs.some((paragraph) => Boolean(String(paragraph || '').trim())))
    || (Array.isArray(section?.bullets) && section.bullets.some((bullet) => Boolean(String(bullet || '').trim())))
  ));
  const hasFaqs = Array.isArray(page.faqs) && page.faqs.some((item) => (
    Boolean(String(item?.question || '').trim()) || Boolean(String(item?.answer || '').trim())
  ));

  return hasTitle && hasSlug && (hasHero || hasHighlights || hasSections || hasFaqs);
}

function buildBudgetTemplateQuerySnapshot(page) {
  const statItems = Array.isArray(page?.dataInsights) ? page.dataInsights.slice(0, 4).filter((item) => item?.value && item?.label) : [];
  const splitChart = (page?.dataCharts || []).find((chart) => chart.type === 'donut');
  const regionChart = (page?.dataCharts || []).find((chart) => chart.type === 'range-bars' && chart.title === 'Regional budget ranges');
  const guestCountChart = (page?.dataCharts || []).find((chart) => chart.title === 'Estimated catering spend by guest count');
  const prioritiesChart = (page?.dataCharts || []).find((chart) => chart.type === 'bars');
  const costOverviewItems = Array.isArray(page?.costOverviewItems) ? page.costOverviewItems.filter((item) => item?.label) : [];
  const costBreakdownRows = Array.isArray(page?.costBreakdownRows) ? page.costBreakdownRows.filter((item) => item?.category) : [];
  const seoBudgetSteps = Array.isArray(page?.seoBudgetSteps) ? page.seoBudgetSteps.filter((item) => item?.title) : [];
  const splitSegments = Array.isArray(splitChart?.segments) ? splitChart.segments.filter((segment) => segment?.label) : [];
  const regionItems = Array.isArray(regionChart?.items) ? regionChart.items.filter((item) => item?.label) : [];
  const guestItems = Array.isArray(guestCountChart?.items) ? guestCountChart.items.filter((item) => item?.label) : [];
  const priorityItems = Array.isArray(prioritiesChart?.items) ? prioritiesChart.items.filter((item) => item?.label) : [];
  const howItWorksSteps = Array.isArray(page?.howItWorksSteps) ? page.howItWorksSteps.filter((item) => item?.title) : [];
  const useCases = Array.isArray(page?.useCases) ? page.useCases.filter((item) => item?.title) : [];
  const resourceLinks = Array.isArray(page?.resourceLinks) ? page.resourceLinks.filter((item) => item?.href && item?.label) : [];
  const faqItems = Array.isArray(page?.faqs) ? page.faqs.filter((item) => item?.question && item?.answer) : [];
  const [buildSection, savingsSection, templateSection] = Array.isArray(page?.sections) ? page.sections : [];
  const maxRegionValue = Math.max(...regionItems.map((item) => Number(item?.max) || 0), 1);
  const maxPriorityValue = Math.max(...priorityItems.map((item) => Number(item?.value) || 0), 1);

  const statsMarkup = statItems.map((item) => `
            <article class="marketing-budget-stat-card">
              <strong>${escapeHtml(item.value)}</strong>
              <h2>${escapeHtml(item.label)}</h2>
              ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
            </article>`).join('');

  const costOverviewMarkup = costOverviewItems.map((item) => `
            <article class="marketing-budget-overview-card">
              <p class="marketing-budget-overview-label">${escapeHtml(item.label)}</p>
              <strong>${escapeHtml(item.value)}</strong>
              ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
            </article>`).join('');

  const breakdownRowMarkup = costBreakdownRows.map((item) => `
                  <tr>
                    <td><strong>${escapeHtml(item.category)}</strong>${item.note ? `<span>${escapeHtml(item.note)}</span>` : ''}</td>
                    <td>${escapeHtml(item.share)}</td>
                    <td>${escapeHtml(item.range)}</td>
                  </tr>`).join('');

  const featureMarkup = (page?.highlights || []).map((item, index) => `
            <article class="marketing-budget-feature-card">
              <span class="marketing-budget-step-number">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description)}</p>
            </article>`).join('');

  const personaMarkup = useCases.map((item, index) => `
            <article class="marketing-budget-persona-card">
              <span class="marketing-budget-step-number">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description)}</p>
            </article>`).join('');

  const segmentMarkup = splitSegments.map((segment, index) => {
    const color = segment?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
    return `
                  <div class="marketing-budget-segment-pill">
                    <span class="marketing-chart-dot" style="background-color: ${escapeAttribute(color)};" aria-hidden="true"></span>
                    <strong>${escapeHtml(segment.label)}</strong>
                    <span>${escapeHtml(formatChartValue(segment.value, '%'))}</span>
                  </div>`;
  }).join('');

  const regionMarkup = regionItems.map((item, index) => {
    const minValue = Math.max(0, Number(item?.min) || 0);
    const maxValue = Math.max(minValue, Number(item?.max) || 0);
    const left = `${(minValue / maxRegionValue) * 100}%`;
    const width = `${((maxValue - minValue) / maxRegionValue) * 100}%`;
    const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];

    return `
                  <div class="marketing-budget-region-row">
                    <div class="marketing-budget-region-header">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(formatChartValue(minValue, regionChart?.unit))} to ${escapeHtml(formatChartValue(maxValue, regionChart?.unit))}</span>
                    </div>
                    <div class="marketing-range-track">
                      <div class="marketing-range-fill" style="left: ${escapeAttribute(left)}; width: ${escapeAttribute(width)}; background-color: ${escapeAttribute(color)};"></div>
                    </div>
                  </div>`;
  }).join('');

  const guestMarkup = guestItems.map((item) => `
            <article class="marketing-budget-scenario-card">
              <p class="marketing-budget-overview-label">${escapeHtml(item.label)}</p>
              <strong>${escapeHtml(formatChartValue(item.min, guestCountChart?.unit))} to ${escapeHtml(formatChartValue(item.max, guestCountChart?.unit))}</strong>
              ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ''}
            </article>`).join('');

  const priorityMarkup = priorityItems.map((item, index) => {
    const color = item?.color || DEFAULT_DONUT_COLORS[index % DEFAULT_DONUT_COLORS.length];
    const width = `${((Number(item?.value) || 0) / maxPriorityValue) * 100}%`;
    return `
                  <div class="marketing-budget-priority-row">
                    <div class="marketing-budget-priority-header">
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(formatChartValue(item.value, prioritiesChart?.unit))}</span>
                    </div>
                    <div class="marketing-range-track">
                      <div class="marketing-bars-fill" style="width: ${escapeAttribute(width)}; background-color: ${escapeAttribute(color)};"></div>
                    </div>
                    </div>`;
  }).join('');

  const seoStepMarkup = seoBudgetSteps.map((step, index) => `
            <article class="marketing-budget-step-card">
              <div class="marketing-budget-step-top">
                <span class="marketing-budget-step-number">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
              </div>
              <h3>${escapeHtml(step.title)}</h3>
              <p>${escapeHtml(step.description || '')}</p>
            </article>`).join('');

  const stepMarkup = howItWorksSteps.map((step, index) => `
            <article class="marketing-budget-step-card">
              <div class="marketing-budget-step-top">
                <span class="marketing-budget-step-number">${escapeHtml(String(index + 1).padStart(2, '0'))}</span>
              </div>
              <h3>${escapeHtml(step.title)}</h3>
              <p>${escapeHtml(step.description || '')}</p>
            </article>`).join('');

  const copyCardMarkup = [buildSection, savingsSection].filter(Boolean).map((section) => `
            <article class="marketing-budget-copy-card">
              <h3>${escapeHtml(section.heading)}</h3>
              ${section.paragraphs?.[0] ? `<p>${escapeHtml(section.paragraphs[0])}</p>` : ''}
              ${renderSnapshotList(section.bullets, 'marketing-budget-bullet-list')}
            </article>`).join('');

  const templateMarkup = Array.isArray(templateSection?.bullets) ? templateSection.bullets.map((bullet) => `
            <article class="marketing-budget-checklist-item">
              <span aria-hidden="true"></span>
              <p>${escapeHtml(bullet)}</p>
            </article>`).join('') : '';

  const resourceMarkup = resourceLinks.map((item) => `
            <a class="marketing-budget-resource-card" href="${escapeAttribute(item.href)}">
              <strong>${escapeHtml(item.label)}</strong>
              ${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}
            </a>`).join('');

  const faqMarkup = faqItems.map((item) => `
            <details class="marketing-budget-faq-item">
              <summary>${escapeHtml(item.question)}</summary>
              <p>${escapeHtml(item.answer)}</p>
            </details>`).join('');

  return `
    <div class="marketing-home-shell marketing-budget-template-page" data-seo-snapshot="query-page-budget-template">
      <main class="marketing-main marketing-budget-main">
        <section class="marketing-budget-hero">
          <div class="marketing-budget-hero-copy">
            <p class="marketing-section-kicker">${escapeHtml(page.heroKicker)}</p>
            <h1>${escapeHtml(page.heroTitle)}</h1>
            <p class="marketing-budget-hero-summary">${escapeHtml(page.heroSummary)}</p>
            ${renderSnapshotActions([
              { href: page.heroPrimaryHref || '/templates/wedding-budget-template.csv', label: page.heroPrimaryLabel || 'Download free CSV', className: 'marketing-primary-action', download: page.heroPrimaryDownload },
              { href: page.heroSecondaryHref || 'https://planner.vivahgo.com/', label: page.heroSecondaryLabel || 'Use it live in VivahGo', className: 'marketing-secondary-action', download: page.heroSecondaryDownload },
            ])}
            <p class="marketing-budget-hero-note">${escapeHtml(page.heroBody || '')}</p>
          </div>
          <div class="marketing-budget-mockup">
            <div class="marketing-budget-mockup-window" role="img" aria-label="Indian wedding budget template India spreadsheet preview">
              <div class="marketing-budget-mockup-topbar">
                <div class="marketing-budget-mockup-dots" aria-hidden="true"><span></span><span></span><span></span></div>
                <p>Indian Wedding Budget Template</p>
              </div>
              <div class="marketing-budget-mockup-summary">
                <article><span>Total Budget</span><strong>Rs. 20L</strong></article>
                <article><span>Committed</span><strong>Rs. 9.8L</strong></article>
                <article><span>Due Next</span><strong>Rs. 2.4L</strong></article>
              </div>
              <div class="marketing-budget-mockup-chart">
                <div class="marketing-budget-mockup-chart-row"><div class="marketing-budget-mockup-chart-label"><span>Venue + Decor</span><strong>25%</strong></div><div class="marketing-budget-mockup-chart-track"><div class="marketing-budget-mockup-chart-fill" style="width: 82%;"></div></div></div>
                <div class="marketing-budget-mockup-chart-row"><div class="marketing-budget-mockup-chart-label"><span>Catering</span><strong>25%</strong></div><div class="marketing-budget-mockup-chart-track"><div class="marketing-budget-mockup-chart-fill" style="width: 78%;"></div></div></div>
                <div class="marketing-budget-mockup-chart-row"><div class="marketing-budget-mockup-chart-label"><span>Attire + Styling</span><strong>18%</strong></div><div class="marketing-budget-mockup-chart-track"><div class="marketing-budget-mockup-chart-fill" style="width: 56%;"></div></div></div>
                <div class="marketing-budget-mockup-chart-row"><div class="marketing-budget-mockup-chart-label"><span>Travel + Stay</span><strong>10%</strong></div><div class="marketing-budget-mockup-chart-track"><div class="marketing-budget-mockup-chart-fill" style="width: 34%;"></div></div></div>
              </div>
              <div class="marketing-budget-mockup-table">
                <div class="marketing-budget-mockup-table-row"><div><strong>Venue</strong><span>Due in 7 days</span></div><p>Rs. 1.8L</p></div>
                <div class="marketing-budget-mockup-table-row"><div><strong>Caterer</strong><span>Deposit paid</span></div><p>Rs. 1.2L</p></div>
                <div class="marketing-budget-mockup-table-row"><div><strong>Photo Team</strong><span>Pending approval</span></div><p>Rs. 75k</p></div>
              </div>
            </div>
          </div>
        </section>

        ${statsMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-stats-title"><div class="marketing-budget-stats-row">${statsMarkup}
        </div></section>` : ''}

        ${costOverviewMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-cost-overview-title">
          <div class="marketing-budget-section-heading">
            <p class="marketing-section-kicker">Wedding Cost Overview</p>
            <h2 id="budget-cost-overview-title">${escapeHtml(page.costOverviewTitle || 'What does an Indian wedding cost in 2025?')}</h2>
            ${page.costOverviewIntro ? `<p>${escapeHtml(page.costOverviewIntro)}</p>` : ''}
          </div>
          <div class="marketing-budget-overview-grid">${costOverviewMarkup}
          </div>
          <p class="marketing-budget-inline-copy marketing-budget-bridge">${escapeHtml(page.costOverviewBridge || '')} Pair it with the <a href="/wedding-guest-list-template">wedding guest list template</a>, the <a href="/guides/guest-list-rsvp">guest list and RSVP guide</a>, and the <a href="/wedding-budget-planner-app">wedding budget planner app</a> so the numbers stay connected to real guest decisions.</p>
        </section>` : ''}

        <section class="marketing-budget-section" aria-labelledby="budget-breakdown-title">
          <div class="marketing-budget-section-heading">
            <p class="marketing-section-kicker">Category Breakdown</p>
            <h2 id="budget-breakdown-title">${escapeHtml(page.costBreakdownTitle || 'Indian Wedding Cost Breakdown by Category')}</h2>
            ${page.costBreakdownIntro ? `<p>${escapeHtml(page.costBreakdownIntro)}</p>` : ''}
          </div>
          <div class="marketing-budget-breakdown-layout">
            ${breakdownRowMarkup ? `<article class="marketing-budget-table-card">
              <table class="marketing-budget-cost-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>% of Budget</th>
                    <th>Typical Cost Range</th>
                  </tr>
                </thead>
                <tbody>${breakdownRowMarkup}
                </tbody>
              </table>
            </article>` : ''}
            ${splitSegments.length ? `<article class="marketing-budget-chart-card marketing-budget-chart-card-tall"><div class="marketing-budget-chart-copy"><h3>${escapeHtml(splitChart?.title || 'Sample budget split')}</h3>${splitChart?.description ? `<p>${escapeHtml(splitChart.description)}</p>` : ''}</div><div class="marketing-budget-donut-stack"><div class="marketing-donut-chart marketing-budget-donut-chart" style="background: ${escapeAttribute(buildDonutBackground(splitSegments))};"><div class="marketing-donut-chart-hole"><strong>${escapeHtml(splitChart?.centerLabel || '100%')}</strong>${splitChart?.centerNote ? `<span>${escapeHtml(splitChart.centerNote)}</span>` : ''}</div></div><div class="marketing-budget-segment-list">${segmentMarkup}</div></div>${splitChart?.note ? `<p class="marketing-budget-inline-copy">${escapeHtml(splitChart.note)}</p>` : ''}<p class="marketing-budget-inline-copy">Need more detail? Read the <a href="/guides/wedding-budget-planner">wedding budget planning guide</a> and connect vendor payments inside the <a href="/wedding-vendor-manager-app">wedding vendor manager app</a>.</p></article>` : ''}
          </div>
        </section>

        <section class="marketing-budget-section" aria-labelledby="budget-features-title">
          <div class="marketing-budget-section-heading">
            <p class="marketing-section-kicker">What This Solves</p>
            <h2 id="budget-features-title">A budget page that is fast to scan and useful in real planning.</h2>
          </div>
          <div class="marketing-budget-feature-grid">${featureMarkup}
          </div>
        </section>

        <section class="marketing-budget-section" aria-labelledby="budget-personas-title">
          <div class="marketing-budget-section-heading">
            <p class="marketing-section-kicker">Who It&apos;s For</p>
            <h2 id="budget-personas-title">Pick the same template up whether you are planning, approving, or managing.</h2>
          </div>
          <div class="marketing-budget-persona-row">${personaMarkup}
          </div>
        </section>

        <section class="marketing-budget-section marketing-budget-section-soft" aria-labelledby="budget-insights-title">
          <div class="marketing-budget-section-heading">
            <p class="marketing-section-kicker">${escapeHtml(page.dataSectionKicker || 'Indian Wedding Budget Data')}</p>
            <h2 id="budget-insights-title">${escapeHtml(page.dataSectionTitle || 'Use benchmark data before you lock the big-budget categories.')}</h2>
            ${page.dataSectionIntro ? `<p>${escapeHtml(page.dataSectionIntro)}</p>` : ''}
          </div>
          <div class="marketing-budget-chart-grid">
            ${regionItems.length ? `<article class="marketing-budget-chart-card"><div class="marketing-budget-chart-copy"><h3>${escapeHtml(regionChart?.title || 'Regional budget ranges')}</h3>${regionChart?.description ? `<p>${escapeHtml(regionChart.description)}</p>` : ''}</div><div class="marketing-budget-region-list">${regionMarkup}</div></article>` : ''}
            ${priorityItems.length ? `<article class="marketing-budget-chart-card"><h3>${escapeHtml(prioritiesChart?.title || 'What couples prioritised in 2024')}</h3><div class="marketing-budget-priority-list">${priorityMarkup}</div></article>` : ''}
          </div>
          ${resourceMarkup ? `<div class="marketing-budget-resource-row">${resourceMarkup}
          </div>` : ''}
        </section>

        ${guestMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-per-guest-title">
          <div class="marketing-budget-section-heading">
            <p class="marketing-section-kicker">Per Guest Cost</p>
            <h2 id="budget-per-guest-title">${escapeHtml(page.perGuestTitle || 'Cost of Indian Wedding per Guest')}</h2>
            ${page.perGuestIntro ? `<p>${escapeHtml(page.perGuestIntro)}</p>` : ''}
          </div>
          <div class="marketing-budget-per-guest-layout">
            <article class="marketing-budget-formula-card">
              <p class="marketing-budget-formula-label">Planning formula</p>
              <strong>${escapeHtml(page.perGuestFormula || 'Total catering cost = guest count × cost per plate × number of functions')}</strong>
              <p>Use the <a href="/wedding-guest-list-template">wedding guest list template</a> or the <a href="/guest-list-rsvp-app">guest list and RSVP app</a> first, because the guest count is what makes this number expand or stay controlled.</p>
            </article>
            <div class="marketing-budget-scenario-grid">${guestMarkup}
            </div>
          </div>
        </section>` : ''}

        ${seoStepMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-seo-steps-title"><div class="marketing-budget-section-heading"><p class="marketing-section-kicker">How To Build It</p><h2 id="budget-seo-steps-title">${escapeHtml(page.seoBudgetStepsTitle || 'How to Create a Wedding Budget in India')}</h2>${page.seoBudgetStepsIntro ? `<p>${escapeHtml(page.seoBudgetStepsIntro)}</p>` : ''}</div><div class="marketing-budget-step-grid marketing-budget-seo-step-grid">${seoStepMarkup}</div></section>` : ''}

        ${stepMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-steps-title"><div class="marketing-budget-section-heading"><p class="marketing-section-kicker">Use It In VivahGo</p><h2 id="budget-steps-title">Start with a template. Move into a live budget system when more people need one current version.</h2></div><div class="marketing-budget-step-grid">${stepMarkup}</div></section>` : ''}

        ${copyCardMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-practical-title"><div class="marketing-budget-section-heading"><p class="marketing-section-kicker">Practical Tips</p><h2 id="budget-practical-title">Use short action lists so the budget stays practical, not theoretical.</h2></div><div class="marketing-budget-copy-grid">${copyCardMarkup}</div></section>` : ''}

        ${templateMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-template-structure-title"><div class="marketing-budget-section-heading"><p class="marketing-section-kicker">Template Structure</p><h2 id="budget-template-structure-title">${escapeHtml(templateSection?.heading || 'What to include in your template')}</h2>${templateSection?.paragraphs?.[0] ? `<p>${escapeHtml(templateSection.paragraphs[0])}</p>` : ''}</div><div class="marketing-budget-checklist-grid">${templateMarkup}</div><p class="marketing-budget-inline-copy marketing-budget-template-link-copy">If you want the budget to connect with tasks, guests, and vendors, move next to the <a href="/wedding-planner-app">wedding planner app</a> or the <a href="/for-wedding-planners">planner workflow page</a>.</p></section>` : ''}

        ${faqMarkup ? `<section class="marketing-budget-section" aria-labelledby="budget-faq-title"><div class="marketing-budget-section-heading"><p class="marketing-section-kicker">FAQs</p><h2 id="budget-faq-title">Questions people ask before locking an Indian wedding budget.</h2></div><div class="marketing-budget-faq-list">${faqMarkup}
        </div></section>` : ''}

        <section class="marketing-budget-final-cta" aria-labelledby="budget-final-cta-title">
          <div class="marketing-budget-final-cta-copy">
            <h2 id="budget-final-cta-title">${escapeHtml(page.finalCtaTitle || 'Stop guessing your wedding budget')}</h2>
            <p>${escapeHtml(page.finalCtaBody || 'Start with a template. Move to a live system when things get real.')}</p>
          </div>
          ${renderSnapshotActions([
            { href: page.finalPrimaryHref || 'https://planner.vivahgo.com/', label: page.finalPrimaryLabel || 'Start Budget in VivahGo', className: 'marketing-primary-action', download: page.finalPrimaryDownload },
            { href: page.finalSecondaryHref || '/templates/wedding-budget-template.csv', label: page.finalSecondaryLabel || 'Download CSV', className: 'marketing-secondary-action', download: page.finalSecondaryDownload },
          ])}
        </section>
      </main>
    </div>`;
}

function buildQueryPageSnapshot(page) {
  if (!isRenderableQueryPage(page)) {
    return `
      <div class="marketing-home-shell" data-seo-snapshot="query-missing">
        <main class="marketing-main">
          <section class="marketing-section marketing-pricing-page-intro">
            <div class="marketing-section-heading">
              <p class="marketing-section-kicker">Page Not Found</p>
              <h1>This planning page is not available.</h1>
              <p>Return to the homepage or browse the guides to find the right planning resource.</p>
            </div>
            ${renderSnapshotActions([
              { href: '/', label: 'Back to Home', className: 'marketing-primary-action' },
              { href: '/guides', label: 'Browse Guides', className: 'marketing-secondary-action' },
            ])}
          </section>
        </main>
      </div>`;
  }

  if (page.slug === BUDGET_TEMPLATE_PAGE_SLUG) {
    return buildBudgetTemplateQuerySnapshot(page);
  }

  const highlightMarkup = page.highlights.map((item) => `
            <article class="marketing-feature-card marketing-feature-card-left">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description)}</p>
            </article>`).join('');
  const useCaseMarkup = (page.useCases || []).filter((item) => item && (item.title || item.description)).map((item) => `
            <article class="marketing-feature-card marketing-feature-card-left">
              <h3>${escapeHtml(item.title || '')}</h3>
              <p>${escapeHtml(item.description || '')}</p>
            </article>`).join('');
  const heroMediaMarkup = page.heroMedia?.src ? `
        <section class="marketing-section marketing-inline-media-section" aria-label="${escapeAttribute(`${page.title} image`)}">
          <figure class="marketing-inline-media-card">
            <img class="marketing-inline-media-image" src="${escapeAttribute(page.heroMedia.src)}" alt="${escapeAttribute(page.heroMedia.alt || page.title)}"${page.heroMedia.aspectRatio ? ` style="aspect-ratio: ${escapeAttribute(page.heroMedia.aspectRatio)};"` : ''} loading="eager" decoding="async" />
            ${page.heroMedia.creditLabel && page.heroMedia.creditHref ? `<figcaption class="marketing-inline-media-caption"><a href="${escapeAttribute(page.heroMedia.creditHref)}" target="_blank" rel="noreferrer">${escapeHtml(page.heroMedia.creditLabel)}</a></figcaption>` : ''}
          </figure>
        </section>` : '';
  const sectionMarkup = page.sections.map((section) => `
            <section class="marketing-guide-subsection">
              <h2>${escapeHtml(section.heading)}</h2>
              ${renderSnapshotParagraphs(section.paragraphs)}
              ${renderSnapshotList(section.bullets)}
            </section>`).join('');
  const faqMarkup = page.faqs.map((item) => `
            <details class="marketing-faq-item">
              <summary>${escapeHtml(item.question)}</summary>
              <p>${escapeHtml(item.answer)}</p>
            </details>`).join('');
  const relatedPageMarkup = (page.relatedPageSlugs || []).map((slug) => QUERY_PAGE_BY_SLUG.get(slug)).filter(Boolean).map((item) => `
              <article class="marketing-guide-card">
                <div class="marketing-guide-card-body">
                  <div class="marketing-guide-card-meta"><span>Planning Page</span></div>
                  <h3><a href="${escapeAttribute(buildMarketingUrl(`/${item.slug}`))}">${escapeHtml(item.title)}</a></h3>
                  <p>${escapeHtml(item.heroSummary)}</p>
                </div>
              </article>`).join('');
  const relatedGuideMarkup = (page.relatedGuideSlugs || []).map((slug) => GUIDE_BY_SLUG.get(slug)).filter(Boolean).map((guide) => `
              <article class="marketing-guide-card">
                <div class="marketing-guide-card-body">
                  <div class="marketing-guide-card-meta"><span>${escapeHtml(guide.readTime)}</span></div>
                  <h3><a href="${escapeAttribute(buildMarketingUrl(`/guides/${guide.slug}`))}">${escapeHtml(guide.title)}</a></h3>
                  <p>${escapeHtml(guide.summary)}</p>
                </div>
              </article>`).join('');

  return `
    <div class="marketing-home-shell" data-seo-snapshot="query-page">
      <main class="marketing-main">
        <section class="marketing-hero">
          <div class="marketing-hero-copy">
            <p class="marketing-kicker">${escapeHtml(page.heroKicker)}</p>
            <h1>${escapeHtml(page.heroTitle)}</h1>
            <p class="marketing-summary">${escapeHtml(page.heroSummary)}</p>
            <p class="marketing-summary">${escapeHtml(page.heroBody)}</p>
            ${renderSnapshotActions([
              { href: page.heroPrimaryHref || 'https://planner.vivahgo.com/', label: page.heroPrimaryLabel || 'Start Planning Free', className: 'marketing-primary-action', download: page.heroPrimaryDownload },
              { href: page.heroSecondaryHref || '/pricing', label: page.heroSecondaryLabel || 'See Pricing', className: 'marketing-secondary-action marketing-secondary-action-gold', download: page.heroSecondaryDownload },
            ])}
          </div>
        </section>

        ${heroMediaMarkup}

        <section class="marketing-section" aria-labelledby="seo-query-highlights-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Why This Page Matters</p>
            <h2 id="seo-query-highlights-title">${escapeHtml(page.title)} features that solve real wedding planning problems.</h2>
          </div>
          <div class="marketing-feature-grid">${highlightMarkup}
          </div>
        </section>

        ${useCaseMarkup ? `
        <section class="marketing-section" aria-labelledby="seo-query-use-cases-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Best For</p>
            <h2 id="seo-query-use-cases-title">Who gets the most value from this workflow.</h2>
          </div>
          <div class="marketing-feature-grid">${useCaseMarkup}
          </div>
        </section>` : ''}

        ${buildQueryPageDataSnapshot(page)}

        <section class="marketing-section marketing-guide-section">
          <div class="marketing-guide-body">${sectionMarkup}
          </div>
        </section>

        <section class="marketing-section" id="seo-query-faqs">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">FAQs</p>
            <h2>Questions people ask about ${escapeHtml(page.title.toLowerCase())} choices.</h2>
          </div>
          <div class="marketing-faq-list">${faqMarkup}
          </div>
        </section>

        <section class="marketing-section" aria-labelledby="seo-query-related-pages-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Related Planning Pages</p>
            <h2 id="seo-query-related-pages-title">Compare nearby planning workflows.</h2>
          </div>
          <div class="marketing-guides-grid">${relatedPageMarkup}
          </div>
        </section>

        <section class="marketing-section" aria-labelledby="seo-query-related-guides-title">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">Related Guides</p>
            <h2 id="seo-query-related-guides-title">Read supporting guides before you start planning.</h2>
          </div>
          <div class="marketing-guides-grid">${relatedGuideMarkup}
          </div>
        </section>

        <section class="marketing-section marketing-final-cta">
          <div class="marketing-section-heading">
            <h2 class="marketing-final-cta-title">${escapeHtml(page.finalCtaTitle || 'Turn this planning topic into a working wedding system.')}</h2>
            <p>${escapeHtml(page.finalCtaBody || 'Move from reading about the workflow to running it inside a shared VivahGo workspace.')}</p>
          </div>
          ${renderSnapshotActions([
            { href: page.finalPrimaryHref || 'https://planner.vivahgo.com/', label: page.finalPrimaryLabel || 'Start Planning Free', className: 'marketing-primary-action', download: page.finalPrimaryDownload },
            { href: page.finalSecondaryHref || '/guides', label: page.finalSecondaryLabel || 'Read More Guides', className: 'marketing-secondary-action marketing-secondary-action-gold', download: page.finalSecondaryDownload },
          ])}
        </section>
      </main>
    </div>`;
}

function buildCareersSnapshot() {
  return `
    <div class="marketing-home-shell" data-seo-snapshot="careers">
      <main class="marketing-main">
        <section class="marketing-section marketing-pricing-page-intro">
          <div class="marketing-section-heading">
            <p class="marketing-section-kicker">VivahGo Careers</p>
            <h1>Help build better wedding planning tools for couples, families, and planners.</h1>
            <p>Join a team focused on turning messy wedding coordination into a calmer, shared planning experience.</p>
          </div>
          ${renderSnapshotActions([
            { href: '/', label: 'Explore VivahGo', className: 'marketing-primary-action' },
            { href: '/guides', label: 'Read Guides', className: 'marketing-secondary-action' },
          ])}
        </section>
      </main>
    </div>`;
}

function buildRouteSnapshot(routeData) {
  const route = routeData?.route || '';
  if (route === 'pricing') {
    return buildPricingSnapshot();
  }

  if (route === 'guides') {
    return buildGuidesSnapshot();
  }

  if (route === 'guide') {
    return buildGuideSnapshot(routeData?.payload?.guide || null);
  }

  if (route === 'query') {
    return buildQueryPageSnapshot(routeData?.payload?.page || null);
  }

  if (route === 'careers') {
    return buildCareersSnapshot();
  }

  if (!route || route === 'home') {
    return buildHomeSnapshot();
  }

  return '';
}

function createJsonCaptureResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

async function getRouteData(req, plannerHandlers = plannerModule) {
  const route = String(req.query?.route || '').trim().toLowerCase();
  if (route === 'guide') {
    const slug = String(req.query?.slug || '').trim();
    const guide = GUIDE_BY_SLUG.get(slug) || null;
    return {
      route,
      statusCode: guide ? 200 : 404,
      payload: guide ? { guide } : { error: 'Guide not found.' },
    };
  }

  if (route === 'query') {
    const slug = String(req.query?.slug || '').trim();
    const canonicalSlug = getCanonicalQueryPageSlug(slug);
    const page = QUERY_PAGE_BY_SLUG.get(canonicalSlug) || null;
    if (canonicalSlug !== slug && isRenderableQueryPage(page)) {
      return {
        route,
        statusCode: 302,
        redirectTo: `/${canonicalSlug}`,
        payload: { page },
      };
    }
    if (!isRenderableQueryPage(page)) {
      return {
        route,
        statusCode: 302,
        redirectTo: '/',
        payload: { error: 'Planning page not found.' },
      };
    }
    return {
      route,
      statusCode: 200,
      payload: { page },
    };
  }

  if (route === 'website') {
    const res = createJsonCaptureResponse();
    await plannerHandlers.handlePlannerPublic({
      method: 'GET',
      headers: req.headers || {},
      query: { slug: req.query?.slug || '' },
    }, res);
    return { route, statusCode: res.statusCode || 200, payload: res.body };
  }

  if (route === 'rsvp') {
    const res = createJsonCaptureResponse();
    await plannerHandlers.handlePlannerRsvp({
      method: 'GET',
      headers: req.headers || {},
      query: { token: req.query?.token || '' },
    }, res);
    return { route, statusCode: res.statusCode || 200, payload: res.body };
  }

  return { route, statusCode: 200, payload: null };
}

function buildMarketingMetadata(req, page) {
  if (page === 'pricing') {
    return {
      title: 'VivahGo Pricing | Plans for Couples and Planners',
      description: 'Compare wedding planner app pricing for couples, families, planners, and studios managing guests, budgets, vendors, RSVPs, and wedding websites.',
      canonicalUrl: buildMarketingUrl('/pricing'),
      robots: 'index, follow',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'VivahGo Pricing',
          url: buildMarketingUrl('/pricing'),
          description: 'VivahGo pricing for couples, families, and wedding planners.',
          keywords: STRUCTURED_DATA_KEYWORDS,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'OfferCatalog',
          name: 'VivahGo Plans',
          keywords: STRUCTURED_DATA_KEYWORDS,
          itemListElement: [
            { '@type': 'Offer', name: 'Starter', priceCurrency: 'INR', price: '0', availability: 'https://schema.org/InStock' },
            { '@type': 'Offer', name: 'Premium', priceCurrency: 'INR', price: '2000', availability: 'https://schema.org/InStock' },
            { '@type': 'Offer', name: 'Studio', priceCurrency: 'INR', price: '5000', availability: 'https://schema.org/InStock' },
          ],
        },
      ],
    };
  }

  if (page === 'careers') {
    return {
      title: 'VivahGo Careers | Join the Team',
      description: 'Explore open roles at VivahGo and help us build better wedding planning tools for couples, families, and planners.',
      canonicalUrl: buildMarketingUrl('/careers'),
      robots: 'index, follow',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'VivahGo Careers',
        url: buildMarketingUrl('/careers'),
        description: 'Explore open roles at VivahGo.',
        keywords: STRUCTURED_DATA_KEYWORDS,
      },
    };
  }

  if (page === 'guides') {
    return {
      title: 'VivahGo Guides | Indian Wedding Planning Resources',
      description: 'Read Indian wedding planning guides for checklists, budgets, guest list management, vendor coordination, cultural wedding timelines, and destination weddings.',
      canonicalUrl: buildMarketingUrl('/guides'),
      robots: 'index, follow',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'VivahGo Guides',
          url: buildMarketingUrl('/guides'),
          description: 'Guides for Indian wedding planning, budgeting, guest lists, vendor coordination, cultural ceremonies, and destination wedding organization.',
          keywords: STRUCTURED_DATA_KEYWORDS,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: buildMarketingUrl('/') },
            { '@type': 'ListItem', position: 2, name: 'Guides', item: buildMarketingUrl('/guides') },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Wedding planning guides',
          itemListElement: guides.map((guide, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: guide.title,
            url: buildMarketingUrl(`/guides/${guide.slug}`),
          })),
        },
      ],
    };
  }

  if (page === 'wedding') {
    return {
      title: 'VivahGo Wedding Website | Beautiful Public Wedding Pages',
      description: 'Create a wedding website with event details, venue information, and a polished guest-facing experience.',
      canonicalPath: '/wedding',
      robots: 'noindex, nofollow',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'VivahGo Wedding Website',
        url: buildAbsoluteUrl(req, '/wedding'),
        description: 'Create a public wedding website with VivahGo.',
      },
    };
  }

  return {
    title: 'VivahGo | Wedding Planner App for Indian Weddings',
    description: 'VivahGo is a wedding planner app for Indian weddings that helps couples, families, and planners manage checklists, budgets, guests, vendors, RSVPs, timelines, and wedding websites in one shared workspace.',
    canonicalUrl: buildMarketingUrl('/'),
    robots: 'index, follow',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'VivahGo',
        url: buildMarketingUrl('/'),
        logo: buildMarketingUrl('/logo.svg'),
        description: 'Wedding planning software for Indian weddings with shared checklists, budgets, guest management, vendor coordination, RSVPs, timelines, and wedding websites.',
        keywords: STRUCTURED_DATA_KEYWORDS,
        areaServed: ['India', 'UAE', 'USA', 'UK', 'Canada', 'Australia', 'Singapore'],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'VivahGo',
        url: buildMarketingUrl('/'),
        description: 'Wedding planner app for Indian weddings with shared checklists, budgets, guests, vendors, timelines, and event management.',
        inLanguage: 'en-IN',
        keywords: STRUCTURED_DATA_KEYWORDS,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'VivahGo',
        url: buildMarketingUrl('/'),
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'Wedding planner app for Indian weddings with checklists, budgets, guest list management, vendor coordination, RSVP tracking, timelines, and wedding websites.',
        keywords: STRUCTURED_DATA_KEYWORDS,
        featureList: [
          'Wedding checklist management',
          'Budget tracking',
          'Guest list and RSVP tracking',
          'Vendor coordination',
          'Multi-event wedding timelines',
          'Wedding website creation',
        ],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Indian wedding planning coverage',
        itemListElement: COVERAGE_TOPICS.map((topic, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: formatDisplayLabel(topic),
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: HOME_FAQS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };
}

function buildGuideMetadata(req, slug, payload, statusCode) {
  const guide = payload?.guide || GUIDE_BY_SLUG.get(slug) || null;
  if (statusCode !== 200 || !guide) {
    return {
      title: 'Guide Not Found | VivahGo',
      description: payload?.error || 'The requested guide could not be found.',
      canonicalPath: `/guides/${slug}`,
      robots: 'noindex, nofollow',
    };
  }

  return {
    title: `${guide.title} | VivahGo Guides`,
    description: guide.seoDescription,
    canonicalPath: `/guides/${guide.slug}`,
    robots: 'index, follow',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.seoDescription,
        url: buildMarketingUrl(`/guides/${guide.slug}`),
        author: {
          '@type': 'Organization',
          name: 'VivahGo',
        },
        publisher: {
          '@type': 'Organization',
          name: 'VivahGo',
          logo: {
            '@type': 'ImageObject',
            url: buildMarketingUrl('/logo.svg'),
          },
        },
        keywords: Array.isArray(guide.keywords) ? guide.keywords.join(', ') : '',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: buildMarketingUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: buildMarketingUrl('/guides') },
          { '@type': 'ListItem', position: 3, name: guide.title, item: buildMarketingUrl(`/guides/${guide.slug}`) },
        ],
      },
    ],
  };
}

function buildQueryPageMetadata(req, slug, payload, statusCode) {
  const canonicalSlug = getCanonicalQueryPageSlug(slug);
  const page = payload?.page || QUERY_PAGE_BY_SLUG.get(canonicalSlug) || null;
  const faqItems = Array.isArray(page?.faqs) ? page.faqs.filter((item) => item?.question && item?.answer) : [];
  const highlightItems = Array.isArray(page?.highlights) ? page.highlights.filter((item) => item?.title) : [];
  const relatedResources = [
    ...(Array.isArray(page?.resourceLinks) ? page.resourceLinks.filter((item) => item?.href && item?.label).map((item) => ({
      name: item.label,
      url: buildMarketingUrl(item.href),
    })) : []),
    ...((page?.relatedPageSlugs || []).map((itemSlug) => QUERY_PAGE_BY_SLUG.get(itemSlug)).filter(Boolean).map((item) => ({
      name: item.title,
      url: buildMarketingUrl(`/${item.slug}`),
    }))),
    ...((page?.relatedGuideSlugs || []).map((guideSlug) => GUIDE_BY_SLUG.get(guideSlug)).filter(Boolean).map((guide) => ({
      name: guide.title,
      url: buildMarketingUrl(`/guides/${guide.slug}`),
    }))),
  ];
  if (statusCode !== 200 || !isRenderableQueryPage(page)) {
    return {
      title: 'Page Not Found | VivahGo',
      description: payload?.error || 'The requested planning page could not be found.',
      canonicalPath: `/${canonicalSlug || slug}`,
      robots: 'noindex, nofollow',
    };
  }

  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.seoTitle,
      url: buildMarketingUrl(`/${page.slug}`),
      description: page.seoDescription,
      keywords: Array.isArray(page.keywords) ? page.keywords.join(', ') : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: buildMarketingUrl('/') },
        { '@type': 'ListItem', position: 2, name: page.title, item: buildMarketingUrl(`/${page.slug}`) },
      ],
    },
  ];

  if (page.slug === BUDGET_TEMPLATE_PAGE_SLUG) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.seoTitle,
      description: page.seoDescription,
      url: buildMarketingUrl(`/${page.slug}`),
      mainEntityOfPage: buildMarketingUrl(`/${page.slug}`),
      dateModified: page.schemaDateModified,
      author: {
        '@type': 'Organization',
        name: 'VivahGo',
      },
      publisher: {
        '@type': 'Organization',
        name: 'VivahGo',
        logo: {
          '@type': 'ImageObject',
          url: buildMarketingUrl('/logo.svg'),
        },
      },
      keywords: Array.isArray(page.keywords) ? page.keywords.join(', ') : '',
    });
  }

  if (faqItems.length) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  if (highlightItems.length) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${page.title} capabilities`,
      itemListElement: highlightItems.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.title,
      })),
    });
  }

  if (relatedResources.length) {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${page.title} related resources`,
      itemListElement: relatedResources.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    });
  }

  return {
    title: page.seoTitle,
    description: page.seoDescription,
    canonicalPath: `/${page.slug}`,
    robots: 'index, follow',
    structuredData,
  };
}

function buildWebsiteMetadata(req, slug, payload, statusCode) {
  if (statusCode !== 200 || !payload?.plan) {
    return {
      title: 'Wedding Website Not Found | VivahGo',
      description: payload?.error || 'This public wedding page could not be found. Please check the link or ask the couple for the latest website URL.',
      canonicalPath: `/${slug}`,
      robots: 'noindex, nofollow',
    };
  }

  const wedding = payload.wedding || {};
  const plan = payload.plan || {};
  const coupleDisplay = [wedding.bride || plan.bride || '', wedding.groom || plan.groom || ''].filter(Boolean).join(' & ') || 'Our Wedding';
  const eventCount = Array.isArray(payload.events) ? payload.events.length : 0;
  const scheduleText = eventCount > 0 ? ` View ${eventCount} shared event${eventCount === 1 ? '' : 's'} and wedding details on VivahGo.` : ' View wedding details on VivahGo.';

  return {
    title: `${coupleDisplay} | Wedding Website`,
    description: `${coupleDisplay}${wedding.date || plan.date ? ` are celebrating on ${wedding.date || plan.date}` : ''}${wedding.venue || plan.venue ? ` at ${wedding.venue || plan.venue}` : ''}.${scheduleText}`.trim(),
    canonicalPath: `/${slug}`,
    robots: 'noindex, nofollow',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `${coupleDisplay} Wedding Website`,
      url: buildAbsoluteUrl(req, `/${slug}`),
      description: `${coupleDisplay} wedding website powered by VivahGo.`,
    },
  };
}

function buildRsvpMetadata(req, token, payload, statusCode) {
  if (statusCode !== 200 || !payload?.guest) {
    return {
      title: 'RSVP Unavailable | VivahGo',
      description: payload?.error || 'This RSVP page is unavailable.',
      canonicalPath: `/rsvp/${token}`,
      robots: 'noindex, nofollow',
    };
  }

  const wedding = payload.wedding || {};
  const plan = payload.plan || {};
  const coupleDisplay = [wedding.bride || plan.bride || '', wedding.groom || plan.groom || ''].filter(Boolean).join(' & ') || 'Wedding Celebration';

  return {
    title: `${coupleDisplay} | RSVP`,
    description: `Confirm your invitation for ${coupleDisplay}${wedding.date || plan.date ? ` on ${wedding.date || plan.date}` : ''}${wedding.venue || plan.venue ? ` at ${wedding.venue || plan.venue}` : ''}.`,
    canonicalPath: `/rsvp/${token}`,
    robots: 'noindex, nofollow',
  };
}

function resolveMetadata(req, routeData) {
  const route = routeData?.route || String(req.query?.route || '').trim().toLowerCase();
  if (route === 'guide') {
    return buildGuideMetadata(req, req.query?.slug || '', routeData?.payload, routeData?.statusCode);
  }

  if (route === 'query') {
    return buildQueryPageMetadata(req, req.query?.slug || '', routeData?.payload, routeData?.statusCode);
  }

  if (route === 'website') {
    return buildWebsiteMetadata(req, req.query?.slug || '', routeData?.payload, routeData?.statusCode);
  }

  if (route === 'rsvp') {
    return buildRsvpMetadata(req, req.query?.token || '', routeData?.payload, routeData?.statusCode);
  }

  return buildMarketingMetadata(req, route || 'home');
}

function sendHtmlResponse(res, statusCode, html, cacheControl) {
  setSecurityHeaders(null, res, { contentSecurityPolicy: PAGE_CONTENT_SECURITY_POLICY });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }

  if (typeof res.status === 'function') {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }

  if (typeof res.send === 'function') {
    return res.send(html);
  }

  res.body = html;
  if (typeof res.end === 'function') {
    return res.end(html);
  }

  return html;
}

function sendRedirectResponse(res, statusCode, location, cacheControl) {
  setSecurityHeaders(null, res, { contentSecurityPolicy: PAGE_CONTENT_SECURITY_POLICY });
  res.setHeader('Location', location);
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }

  if (typeof res.status === 'function') {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }

  if (typeof res.end === 'function') {
    return res.end();
  }

  return null;
}

function getCacheControl(route) {
  if (route === 'rsvp') {
    return 'no-store';
  }

  if (route === 'website') {
    return 'public, s-maxage=600, stale-while-revalidate=3600';
  }

  return 'public, s-maxage=3600, stale-while-revalidate=86400';
}

function createPageHandler(options = {}) {
  const loadHtmlTemplate = options.loadHtmlTemplate || readBuiltHtmlTemplate;
  const plannerHandlers = options.plannerHandlers || plannerModule;

  return async function handler(req, res) {
    setSecurityHeaders(req, res, { contentSecurityPolicy: PAGE_CONTENT_SECURITY_POLICY });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    try {
      const routeData = await getRouteData(req, plannerHandlers);
      if (routeData?.redirectTo) {
        return sendRedirectResponse(res, routeData.statusCode || 302, routeData.redirectTo, 'no-store');
      }

      const htmlTemplate = await loadHtmlTemplate();
      const meta = resolveMetadata(req, routeData);
      const htmlWithMeta = injectMetadataIntoHtml(htmlTemplate, meta, req);
      const html = injectRootMarkupIntoHtml(htmlWithMeta, buildRouteSnapshot(routeData));
      const statusCode = routeData.statusCode || 200;

      if (req.method === 'HEAD') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', getCacheControl(routeData.route));
        if (typeof res.status === 'function') {
          res.status(statusCode);
        } else {
          res.statusCode = statusCode;
        }
        return res.end();
      }

      return sendHtmlResponse(res, statusCode, html, getCacheControl(routeData.route));
    } catch (error) {
      console.error('Page rendering failed:', error);
      const fallbackMeta = {
        title: 'VivahGo | Wedding Planner App for Indian Weddings',
        description: 'VivahGo is a wedding planner app for Indian weddings that helps couples, families, and planners manage checklists, budgets, guests, vendors, RSVPs, timelines, and wedding websites in one shared workspace.',
        canonicalUrl: buildMarketingUrl('/'),
        robots: 'index, follow',
      };
      const htmlWithMeta = injectMetadataIntoHtml('<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>', fallbackMeta, req);
      const html = injectRootMarkupIntoHtml(htmlWithMeta, buildHomeSnapshot());
      return sendHtmlResponse(res, 500, html, 'no-store');
    }
  };
}

module.exports = createPageHandler();
module.exports.buildGuideMetadata = buildGuideMetadata;
module.exports.buildMarketingMetadata = buildMarketingMetadata;
module.exports.buildQueryPageMetadata = buildQueryPageMetadata;
module.exports.buildRsvpMetadata = buildRsvpMetadata;
module.exports.buildRouteSnapshot = buildRouteSnapshot;
module.exports.buildWebsiteMetadata = buildWebsiteMetadata;
module.exports.createPageHandler = createPageHandler;
module.exports.getRequestSiteUrl = getRequestSiteUrl;
module.exports.injectMetadataIntoHtml = injectMetadataIntoHtml;
module.exports.injectRootMarkupIntoHtml = injectRootMarkupIntoHtml;
module.exports.resolveMetadata = resolveMetadata;
