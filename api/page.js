const fs = require('node:fs');
const path = require('node:path');

const { setSecurityHeaders } = require('./_lib/core');
const plannerModule = require('./planner');
const keywordLibrary = require('../vivahgo/src/generated/seo-keywords.json');
const guides = require('../vivahgo/src/content/guides.json');

const DEFAULT_SITE_URL = 'https://vivahgo.com';
const DEFAULT_IMAGE_PATH = '/social-preview.jpg';
const STRUCTURED_DATA_KEYWORDS = keywordLibrary.clusters.primary.slice(0, 24).join(', ');
const COVERAGE_TOPICS = [
  ...keywordLibrary.clusters.primary.slice(0, 8),
  ...keywordLibrary.clusters.cultural.slice(0, 4),
];
const GUIDE_BY_SLUG = new Map(guides.map((guide) => [guide.slug, guide]));
const PAGE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' https://accounts.google.com https://apis.google.com https://www.gstatic.com",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "frame-src 'self' https://www.google.com https://accounts.google.com",
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
  const canonicalUrl = escapeAttribute(buildAbsoluteUrl(req, meta.canonicalPath || '/'));
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
      description: 'Compare Indian wedding planner app pricing for couples, families, planners, and studios managing guests, budgets, vendors, RSVPs, and wedding websites.',
      canonicalPath: '/pricing',
      robots: 'index, follow',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'VivahGo Pricing',
          url: buildAbsoluteUrl(req, '/pricing'),
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
      canonicalPath: '/careers',
      robots: 'index, follow',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'VivahGo Careers',
        url: buildAbsoluteUrl(req, '/careers'),
        description: 'Explore open roles at VivahGo.',
        keywords: STRUCTURED_DATA_KEYWORDS,
      },
    };
  }

  if (page === 'guides') {
    return {
      title: 'VivahGo Guides | Indian Wedding Planning Resources',
      description: 'Read Indian wedding planning guides for checklists, budgets, guest list management, vendor coordination, cultural wedding timelines, and destination weddings.',
      canonicalPath: '/guides',
      robots: 'index, follow',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'VivahGo Guides',
          url: buildAbsoluteUrl(req, '/guides'),
          description: 'Guides for Indian wedding planning, budgeting, guest lists, vendor coordination, cultural ceremonies, and destination wedding organization.',
          keywords: STRUCTURED_DATA_KEYWORDS,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: buildAbsoluteUrl(req, '/home') },
            { '@type': 'ListItem', position: 2, name: 'Guides', item: buildAbsoluteUrl(req, '/guides') },
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
            url: buildAbsoluteUrl(req, `/guides/${guide.slug}`),
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
    title: 'VivahGo | Indian Wedding Planner App for Cultural Weddings',
    description: 'VivahGo is an Indian wedding planner app for cultural weddings with checklist tracking, budgets, guest lists, vendors, RSVPs, ceremonies, and wedding websites.',
    canonicalPath: '/home',
    robots: 'index, follow',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'VivahGo',
        url: buildAbsoluteUrl(req, '/home'),
        logo: buildAbsoluteUrl(req, '/logo.svg'),
        description: 'Indian wedding planning software for couples, families, and planners managing ceremonies, guests, budgets, vendors, and wedding websites.',
        keywords: STRUCTURED_DATA_KEYWORDS,
        areaServed: ['India', 'UAE', 'USA', 'UK', 'Canada', 'Australia', 'Singapore'],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'VivahGo',
        url: buildAbsoluteUrl(req, '/home'),
        description: 'Wedding planning software for Indian weddings with shared tasks, budgets, guests, vendors, and event management.',
        inLanguage: 'en-IN',
        keywords: STRUCTURED_DATA_KEYWORDS,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'VivahGo',
        url: buildAbsoluteUrl(req, '/home'),
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: 'Indian wedding planner app for cultural weddings with checklists, budgets, vendor coordination, guest RSVP tracking, and wedding websites.',
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
        url: buildAbsoluteUrl(req, `/guides/${guide.slug}`),
        author: {
          '@type': 'Organization',
          name: 'VivahGo',
        },
        publisher: {
          '@type': 'Organization',
          name: 'VivahGo',
          logo: {
            '@type': 'ImageObject',
            url: buildAbsoluteUrl(req, '/logo.svg'),
          },
        },
        keywords: Array.isArray(guide.keywords) ? guide.keywords.join(', ') : '',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: buildAbsoluteUrl(req, '/home') },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: buildAbsoluteUrl(req, '/guides') },
          { '@type': 'ListItem', position: 3, name: guide.title, item: buildAbsoluteUrl(req, `/guides/${guide.slug}`) },
        ],
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
      const htmlTemplate = await loadHtmlTemplate();
      const routeData = await getRouteData(req, plannerHandlers);
      const meta = resolveMetadata(req, routeData);
      const html = injectMetadataIntoHtml(htmlTemplate, meta, req);
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
        title: 'VivahGo | Indian Wedding Planner App for Cultural Weddings',
        description: 'VivahGo is an Indian wedding planner app for cultural weddings with checklist tracking, budgets, guest lists, vendors, RSVPs, ceremonies, and wedding websites.',
        canonicalPath: '/home',
        robots: 'index, follow',
      };
      const html = injectMetadataIntoHtml('<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>', fallbackMeta, req);
      return sendHtmlResponse(res, 500, html, 'no-store');
    }
  };
}

module.exports = createPageHandler();
module.exports.buildGuideMetadata = buildGuideMetadata;
module.exports.buildMarketingMetadata = buildMarketingMetadata;
module.exports.buildRsvpMetadata = buildRsvpMetadata;
module.exports.buildWebsiteMetadata = buildWebsiteMetadata;
module.exports.createPageHandler = createPageHandler;
module.exports.getRequestSiteUrl = getRequestSiteUrl;
module.exports.injectMetadataIntoHtml = injectMetadataIntoHtml;
module.exports.resolveMetadata = resolveMetadata;
