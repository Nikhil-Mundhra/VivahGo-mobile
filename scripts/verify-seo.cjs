#!/usr/bin/env node

const DEFAULT_ROUTES = ['/home', '/pricing', '/careers'];
const REQUIRED_META_KEYS = [
  'description',
  'robots',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
];

function printUsage() {
  console.log('Usage: npm run verify:seo -- <base-url> [route ...]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run verify:seo -- https://vivahgo.com');
  console.log('  npm run verify:seo -- https://vivahgo.com /home /pricing /careers /asha-rohan-1');
  console.log('  SEO_VERIFY_BASE_URL=https://vivahgo.com npm run verify:seo -- /home /pricing');
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  try {
    return new URL(raw).href.replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid base URL: ${raw}`);
  }
}

function normalizeRoute(value) {
  const route = String(value || '').trim();
  if (!route) {
    return '';
  }

  if (route.startsWith('http://') || route.startsWith('https://')) {
    return route;
  }

  return route.startsWith('/') ? route : `/${route}`;
}

function buildTargetUrl(baseUrl, route) {
  if (route.startsWith('http://') || route.startsWith('https://')) {
    return route;
  }

  return `${baseUrl}${route}`;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractTitle(html) {
  const match = String(html).match(/<title>([\s\S]*?)<\/title>/i);
  return decodeHtml(match ? match[1].trim() : '');
}

function extractLink(html, rel) {
  const pattern = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["'][^>]*>`, 'i');
  const match = String(html).match(pattern);
  return decodeHtml(match ? match[1].trim() : '');
}

function extractMetaContent(html, key) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const match = String(html).match(pattern);
  return decodeHtml(match ? match[1].trim() : '');
}

async function inspectUrl(targetUrl) {
  const response = await fetch(targetUrl, {
    headers: {
      'user-agent': 'VivahGo SEO Smoke Test',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });

  const html = await response.text();
  const title = extractTitle(html);
  const canonical = extractLink(html, 'canonical');
  const meta = Object.fromEntries(REQUIRED_META_KEYS.map((key) => [key, extractMetaContent(html, key)]));
  const missing = [];

  if (!title) {
    missing.push('title');
  }
  if (!canonical) {
    missing.push('canonical');
  }
  for (const key of REQUIRED_META_KEYS) {
    if (!meta[key]) {
      missing.push(key);
    }
  }

  return {
    url: targetUrl,
    status: response.status,
    ok: response.ok,
    title,
    canonical,
    meta,
    missing,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const positional = args.filter((arg) => !arg.startsWith('--'));
  let baseUrl = process.env.SEO_VERIFY_BASE_URL || '';
  let routeArgs = positional;

  if (positional[0] && /^https?:\/\//i.test(positional[0])) {
    baseUrl = positional[0];
    routeArgs = positional.slice(1);
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const routes = (routeArgs.length ? routeArgs : DEFAULT_ROUTES)
    .map(normalizeRoute)
    .filter(Boolean);

  let hasFailures = false;
  for (const route of routes) {
    const targetUrl = buildTargetUrl(normalizedBaseUrl, route);
    try {
      const result = await inspectUrl(targetUrl);
      const missingSummary = result.missing.length ? ` missing: ${result.missing.join(', ')}` : '';
      const statusLabel = result.status >= 500 ? 'FAIL' : result.missing.length ? 'FAIL' : 'PASS';

      if (statusLabel === 'FAIL') {
        hasFailures = true;
      }

      console.log(`${statusLabel} ${targetUrl} [status ${result.status}]`);
      console.log(`  title: ${result.title || '(missing)'}`);
      console.log(`  canonical: ${result.canonical || '(missing)'}`);
      if (missingSummary) {
        console.log(`  ${missingSummary.trim()}`);
      }
    } catch (error) {
      hasFailures = true;
      console.log(`FAIL ${targetUrl}`);
      console.log(`  error: ${error.message}`);
    }
  }

  if (hasFailures) {
    process.exitCode = 1;
    return;
  }

  console.log('SEO smoke test passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
