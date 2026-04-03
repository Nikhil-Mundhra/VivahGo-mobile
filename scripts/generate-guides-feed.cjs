#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GUIDES_PATH = path.join(ROOT_DIR, 'vivahgo', 'src', 'shared', 'content', 'guides.json');
const PUBLIC_ASSET_MAP_PATH = path.join(ROOT_DIR, 'vivahgo', 'src', 'generated', 'public-asset-map.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'vivahgo', 'public', 'guides', 'feed.xml');
const SITE_URL = 'https://vivahgo.com';
const FEED_URL = `${SITE_URL}/guides/feed.xml`;

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value, fallback) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return fallback;
  }

  const normalized = candidate.length === 10 ? `${candidate}T00:00:00.000Z` : candidate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid guide date: ${candidate}`);
  }

  return parsed.toISOString();
}

function toRfc822Date(value, fallback) {
  return new Date(toIsoDate(value, fallback)).toUTCString();
}

function buildGuideDescription(guide) {
  return `${guide.summary} ${guide.seoDescription}`.trim();
}

function loadPublicAssetMap() {
  if (!fs.existsSync(PUBLIC_ASSET_MAP_PATH)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLIC_ASSET_MAP_PATH, 'utf8'));
    return parsed?.assets && typeof parsed.assets === 'object' ? parsed.assets : {};
  } catch {
    return {};
  }
}

function buildGuidesFeed(guides, options = {}) {
  const siteUrl = String(options.siteUrl || SITE_URL).replace(/\/$/, '');
  const feedUrl = String(options.feedUrl || `${siteUrl}/guides/feed.xml`);
  const fallbackDate = String(options.fallbackDate || '2026-03-27T00:00:00.000Z');
  const publicAssetMap = options.publicAssetMap && typeof options.publicAssetMap === 'object'
    ? options.publicAssetMap
    : loadPublicAssetMap();
  const sortedGuides = [...guides].sort((a, b) => {
    return toIsoDate(b.updatedAt || b.publishedAt, fallbackDate).localeCompare(
      toIsoDate(a.updatedAt || a.publishedAt, fallbackDate)
    );
  });
  const lastBuildDate = sortedGuides.length
    ? toRfc822Date(sortedGuides[0].updatedAt || sortedGuides[0].publishedAt, fallbackDate)
    : new Date(fallbackDate).toUTCString();

  const items = sortedGuides.map((guide) => {
    const guideUrl = `${siteUrl}/guides/${guide.slug}`;
    const pubDate = toRfc822Date(guide.publishedAt || guide.updatedAt, fallbackDate);
    const updatedDate = toIsoDate(guide.updatedAt || guide.publishedAt, fallbackDate);
    const imageUrl = guide.coverImage
      ? (publicAssetMap[guide.coverImage] || `${siteUrl}${guide.coverImage}`)
      : '';

    return [
      '  <item>',
      `    <title>${escapeXml(guide.title)}</title>`,
      `    <link>${escapeXml(guideUrl)}</link>`,
      `    <guid isPermaLink="true">${escapeXml(guideUrl)}</guid>`,
      `    <description>${escapeXml(buildGuideDescription(guide))}</description>`,
      `    <pubDate>${escapeXml(pubDate)}</pubDate>`,
      `    <category>${escapeXml('Guides')}</category>`,
      `    <dc:creator>${escapeXml('VivahGo')}</dc:creator>`,
      `    <content:encoded><![CDATA[<p>${escapeXml(guide.summary)}</p><p>${escapeXml(guide.seoDescription)}</p>${imageUrl ? `<p><img src="${escapeXml(imageUrl)}" alt="${escapeXml(guide.coverAlt || guide.title)}" /></p>` : ''}<p>Read the full guide at <a href="${escapeXml(guideUrl)}">${escapeXml(guideUrl)}</a>.</p>]]></content:encoded>`,
      `    <dc:date>${escapeXml(updatedDate)}</dc:date>`,
      '  </item>',
    ].join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"',
    '  xmlns:atom="http://www.w3.org/2005/Atom"',
    '  xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '>',
    '  <channel>',
    `    <title>${escapeXml('VivahGo Guides')}</title>`,
    `    <link>${escapeXml(`${siteUrl}/guides`)}</link>`,
    `    <description>${escapeXml('Indian wedding planning guides from VivahGo, including checklists, timelines, budgets, guests, vendors, and destination planning.')}</description>`,
    '    <language>en-IN</language>',
    `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

function readGuides() {
  return JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
}

function writeGuidesFeed() {
  const guides = readGuides();
  const xml = buildGuidesFeed(guides);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8');
  return { outputPath: OUTPUT_PATH, xml };
}

if (require.main === module) {
  const { outputPath } = writeGuidesFeed();
  console.log(`Wrote ${path.relative(ROOT_DIR, outputPath)}`);
}

module.exports = {
  FEED_URL,
  GUIDES_PATH,
  OUTPUT_PATH,
  SITE_URL,
  buildGuidesFeed,
  writeGuidesFeed,
};
