const fs = require('node:fs');
const path = require('node:path');

const { setSecurityHeaders } = require('./_lib/core');
const plannerModule = require('./planner');
const keywordLibrary = require('../vivahgo/src/generated/seo-keywords.json');
const guides = require('../vivahgo/src/content/guides.json');
const queryPages = require('../vivahgo/src/content/query-pages.json');

const DEFAULT_SITE_URL = 'https://vivahgo.com';
const DEFAULT_IMAGE_PATH = '/social-preview.jpg';
const STRUCTURED_DATA_KEYWORDS = keywordLibrary.clusters.primary.slice(0, 24).join(', ');
const COVERAGE_TOPICS = [
  ...keywordLibrary.clusters.primary.slice(0, 8),
  ...keywordLibrary.clusters.cultural.slice(0, 4),
];
const GUIDE_BY_SLUG = new Map(guides.map((guide) => [guide.slug, guide]));
const QUERY_PAGE_BY_SLUG = new Map(queryPages.map((page) => [page.slug, page]));
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
const HOME_SNAPSHOT_CAPABILITIES = [
  {
    title: 'Wedding checklist app',
    description: 'Track ceremony-level tasks, owners, and deadlines instead of letting planning drift across WhatsApp and notes.',
  },
  {
    title: 'Wedding budget planner',
    description: 'Monitor planned spend, actual spend, pending balances, and ceremony-wise budget pressure from one dashboard.',
  },
  {
    title: 'Guest list and RSVP tracker',
    description: 'Keep headcounts, family sides, confirmations, and follow-ups organized in one current guest workflow.',
  },
  {
    title: 'Wedding vendor manager',
    description: 'Coordinate vendors, payment checkpoints, deliverables, and event-day dependencies without repeated follow-ups.',
  },
  {
    title: 'Multi-event wedding timeline',
    description: 'Map every ceremony, venue shift, owner, and dependency inside one connected wedding plan.',
  },
  {
    title: 'Family collaboration workspace',
    description: 'Give couples, parents, and planners one shared planning view without confusing parallel versions.',
  },
  {
    title: 'Payment and due-date tracking',
    description: 'Watch upcoming vendor balances, pending commitments, and payment deadlines before they turn urgent.',
  },
  {
    title: 'Wedding reminders and follow-ups',
    description: 'Keep confirmations, reminders, and planning follow-ups moving so important details do not stall.',
  },
  {
    title: 'Ceremony-by-ceremony planning',
    description: 'Track rituals, hospitality, logistics, and decor separately for each function while keeping the full wedding connected.',
  },
  {
    title: 'Shared source of truth',
    description: 'Keep dates, notes, owners, and decisions in one place instead of repeating the same update across calls and chats.',
  },
  {
    title: 'Wedding website builder',
    description: 'Publish a guest-facing wedding website with event details, venue information, and a polished public experience.',
  },
  {
    title: 'Planner and studio workflows',
    description: 'Support wedding planners and studios managing multiple client weddings with clearer operational visibility.',
  },
  {
    title: 'Vendor and guest coordination',
    description: 'Connect guest counts, vendor readiness, and event flow so every planning decision stays actionable.',
  },
  {
    title: 'Indian wedding planning templates',
    description: 'Start faster with planning structures designed for cultural ceremonies, family involvement, and multi-event weddings.',
  },
  {
    title: 'Wedding planning dashboard',
    description: 'Review tasks, budgets, guests, vendors, and event status from one decision-making screen.',
  },
  {
    title: 'Couple and planner friendly setup',
    description: 'Get organized quickly whether you are planning your own wedding or running weddings professionally.',
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
    `<a class="${escapeAttribute(action.className || 'marketing-secondary-action')}" href="${escapeAttribute(action.href)}">${escapeHtml(action.label)}</a>`
  )).join('')}</div>`;
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
  const capabilityMarkup = HOME_SNAPSHOT_CAPABILITIES.map((item) => `
            <article class="marketing-feature-card marketing-feature-card-left">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description)}</p>
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
            <p>VivahGo is built to handle the planning work that usually gets split across WhatsApp, spreadsheets, notes, and repeated family calls.</p>
          </div>
          <div class="marketing-feature-grid">${capabilityMarkup}
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
            <p>Jump directly into checklist planning, budgeting, guest tracking, vendor coordination, and broader wedding planner app workflows.</p>
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
              { href: 'https://planner.vivahgo.com/', label: 'Start Planning Free', className: 'marketing-primary-action' },
              { href: '/pricing', label: 'See Pricing', className: 'marketing-secondary-action marketing-secondary-action-gold' },
            ])}
          </div>
        </section>

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
            { href: 'https://planner.vivahgo.com/', label: page.finalPrimaryLabel || 'Start Planning Free', className: 'marketing-primary-action' },
            { href: page.finalSecondaryHref || '/guides', label: page.finalSecondaryLabel || 'Read More Guides', className: 'marketing-secondary-action marketing-secondary-action-gold' },
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
    const page = QUERY_PAGE_BY_SLUG.get(slug) || null;
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
  const page = payload?.page || QUERY_PAGE_BY_SLUG.get(slug) || null;
  if (statusCode !== 200 || !isRenderableQueryPage(page)) {
    return {
      title: 'Page Not Found | VivahGo',
      description: payload?.error || 'The requested planning page could not be found.',
      canonicalPath: `/${slug}`,
      robots: 'noindex, nofollow',
    };
  }

  return {
    title: page.seoTitle,
    description: page.seoDescription,
    canonicalPath: `/${page.slug}`,
    robots: 'index, follow',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: page.seoTitle,
        url: buildMarketingUrl(`/${page.slug}`),
        description: page.seoDescription,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: buildMarketingUrl('/') },
          { '@type': 'ListItem', position: 2, name: page.title, item: buildMarketingUrl(`/${page.slug}`) },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: (page.faqs || []).map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${page.title} capabilities`,
        itemListElement: (page.highlights || []).map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.title,
        })),
      },
    ],
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
