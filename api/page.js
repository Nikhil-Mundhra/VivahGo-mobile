const fs = require('node:fs');
const path = require('node:path');

const plannerModule = require('./planner');

const DEFAULT_SITE_URL = 'https://vivahgo.com';
const DEFAULT_IMAGE_PATH = '/Thumbnail.png';
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
    `    <meta property="og:title" content="${escapeAttribute(meta.title)}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:url" content="${canonicalUrl}" />`,
    `    <meta property="og:image" content="${imageUrl}" />`,
    `    <meta property="og:image:type" content="image/png" />`,
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
      description: 'Compare VivahGo plans for couples, families, and planners coordinating one or many Indian wedding celebrations.',
      canonicalPath: '/pricing',
      robots: 'index, follow',
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'VivahGo Pricing',
          url: buildAbsoluteUrl(req, '/pricing'),
          description: 'VivahGo pricing for couples, families, and wedding planners.',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'OfferCatalog',
          name: 'VivahGo Plans',
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
      },
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
    title: 'VivahGo | Wedding Planning for Indian Weddings',
    description: 'VivahGo helps couples and planners manage wedding tasks, budgets, guests, events, vendors, and wedding websites in one shared workspace.',
    canonicalPath: '/home',
    robots: 'index, follow',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'VivahGo',
        url: buildAbsoluteUrl(req, '/home'),
        logo: buildAbsoluteUrl(req, '/logo.svg'),
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
  if (route === 'website') {
    return buildWebsiteMetadata(req, req.query?.slug || '', routeData?.payload, routeData?.statusCode);
  }

  if (route === 'rsvp') {
    return buildRsvpMetadata(req, req.query?.token || '', routeData?.payload, routeData?.statusCode);
  }

  return buildMarketingMetadata(req, route || 'home');
}

function sendHtmlResponse(res, statusCode, html, cacheControl) {
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
        title: 'VivahGo | Wedding Planning for Indian Weddings',
        description: 'VivahGo helps couples and planners manage wedding tasks, budgets, guests, events, and vendors in one shared workspace.',
        canonicalPath: '/home',
        robots: 'index, follow',
      };
      const html = injectMetadataIntoHtml('<!doctype html><html lang="en"><head></head><body><div id="root"></div></body></html>', fallbackMeta, req);
      return sendHtmlResponse(res, 500, html, 'no-store');
    }
  };
}

module.exports = createPageHandler();
module.exports.buildMarketingMetadata = buildMarketingMetadata;
module.exports.buildRsvpMetadata = buildRsvpMetadata;
module.exports.buildWebsiteMetadata = buildWebsiteMetadata;
module.exports.createPageHandler = createPageHandler;
module.exports.getRequestSiteUrl = getRequestSiteUrl;
module.exports.injectMetadataIntoHtml = injectMetadataIntoHtml;
module.exports.resolveMetadata = resolveMetadata;
