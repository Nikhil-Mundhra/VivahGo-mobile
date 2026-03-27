import { useEffect } from "react";

export const DEFAULT_SITE_URL = "https://vivahgo.com";
export const DEFAULT_SEO_IMAGE_PATH = "/social-preview.jpg";
const LOCAL_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3})$/;

function getRuntimeEnv() {
  if (typeof import.meta !== "undefined" && import.meta?.env) {
    return import.meta.env;
  }

  return {};
}

export function resolveSiteUrl(env = getRuntimeEnv(), win = typeof window !== "undefined" ? window : undefined) {
  const configuredSiteUrl = typeof env.VITE_SITE_URL === "string" ? env.VITE_SITE_URL.trim() : "";
  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/$/, "");
  }

  const hostname = typeof win?.location?.hostname === "string" ? win.location.hostname : "";
  const origin = typeof win?.location?.origin === "string" ? win.location.origin : "";
  if (origin && !LOCAL_HOST_PATTERN.test(hostname)) {
    return origin.replace(/\/$/, "");
  }

  return DEFAULT_SITE_URL;
}

export function buildAbsoluteUrl(value = "", options = {}) {
  const { siteUrl = DEFAULT_SITE_URL } = options;
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  try {
    return new URL(normalizedValue).href;
  } catch {
    const normalizedPath = normalizedValue.startsWith("/") ? normalizedValue : `/${normalizedValue}`;
    return new URL(normalizedPath, `${siteUrl.replace(/\/$/, "")}/`).href;
  }
}

function upsertMeta(doc, attribute, name, content) {
  if (!doc?.head || !attribute || !name) {
    return null;
  }

  let element = doc.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = doc.createElement("meta");
    element.setAttribute(attribute, name);
    doc.head.appendChild(element);
  }

  element.setAttribute("content", content);
  element.dataset.managedSeo = "true";
  return element;
}

function upsertLink(doc, rel, href) {
  if (!doc?.head || !rel || !href) {
    return null;
  }

  let element = doc.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = doc.createElement("link");
    element.setAttribute("rel", rel);
    doc.head.appendChild(element);
  }

  element.setAttribute("href", href);
  element.dataset.managedSeo = "true";
  return element;
}

function clearManagedStructuredData(doc) {
  if (!doc?.head) {
    return;
  }

  doc.head.querySelectorAll('script[data-managed-seo="structured-data"]').forEach((node) => {
    node.remove();
  });
}

function appendStructuredData(doc, structuredData) {
  if (!doc?.head) {
    return;
  }

  clearManagedStructuredData(doc);

  const items = Array.isArray(structuredData) ? structuredData : [structuredData];
  items
    .filter(Boolean)
    .forEach((item) => {
      const script = doc.createElement("script");
      script.type = "application/ld+json";
      script.dataset.managedSeo = "structured-data";
      script.textContent = JSON.stringify(item);
      doc.head.appendChild(script);
    });
}

export function applySeoMetadata(config = {}, options = {}) {
  const {
    doc = typeof document !== "undefined" ? document : undefined,
    env = getRuntimeEnv(),
    win = typeof window !== "undefined" ? window : undefined,
  } = options;

  const siteUrl = resolveSiteUrl(env, win);
  const title = String(config.title || "VivahGo | Wedding Planning Simplified").trim();
  const description = String(
    config.description || "VivahGo helps couples manage tasks, budgets, events, guests, and vendors in one place."
  ).trim();
  const type = String(config.type || "website").trim();
  const imagePath = config.image || DEFAULT_SEO_IMAGE_PATH;
  const imageUrl = buildAbsoluteUrl(imagePath, { siteUrl });
  const canonicalUrl = buildAbsoluteUrl(config.canonicalUrl || config.path || "/", { siteUrl });
  const robots = config.noindex ? "noindex, nofollow" : "index, follow";
  const imageAlt = String(config.imageAlt || "VivahGo wedding planning preview").trim();
  const locale = String(config.locale || "en_IN").trim();
  const themeColor = String(config.themeColor || "#6b0f0f").trim();

  if (!doc?.head) {
    return {
      title,
      description,
      type,
      imageUrl,
      canonicalUrl,
      robots,
      siteUrl,
    };
  }

  doc.title = title;

  upsertMeta(doc, "name", "description", description);
  upsertMeta(doc, "name", "robots", robots);
  upsertMeta(doc, "name", "theme-color", themeColor);
  upsertMeta(doc, "property", "og:type", type);
  upsertMeta(doc, "property", "og:site_name", "VivahGo");
  upsertMeta(doc, "property", "og:locale", locale);
  upsertMeta(doc, "property", "og:title", title);
  upsertMeta(doc, "property", "og:description", description);
  upsertMeta(doc, "property", "og:url", canonicalUrl);
  upsertMeta(doc, "property", "og:image", imageUrl);
  upsertMeta(doc, "property", "og:image:alt", imageAlt);
  upsertMeta(doc, "name", "twitter:card", imageUrl ? "summary_large_image" : "summary");
  upsertMeta(doc, "name", "twitter:title", title);
  upsertMeta(doc, "name", "twitter:description", description);
  upsertMeta(doc, "name", "twitter:image", imageUrl);
  upsertMeta(doc, "name", "twitter:image:alt", imageAlt);
  upsertLink(doc, "canonical", canonicalUrl);
  appendStructuredData(doc, config.structuredData || null);

  return {
    title,
    description,
    type,
    imageUrl,
    canonicalUrl,
    robots,
    siteUrl,
  };
}

export function usePageSeo(config) {
  const canonicalUrl = config?.canonicalUrl;
  const description = config?.description;
  const image = config?.image;
  const imageAlt = config?.imageAlt;
  const noindex = config?.noindex;
  const path = config?.path;
  const themeColor = config?.themeColor;
  const title = config?.title;
  const type = config?.type;
  const structuredData = config?.structuredData || null;
  const structuredDataKey = JSON.stringify(structuredData);

  useEffect(() => {
    applySeoMetadata({
      canonicalUrl,
      description,
      image,
      imageAlt,
      noindex,
      path,
      structuredData,
      themeColor,
      title,
      type,
    });
  }, [
    canonicalUrl,
    description,
    image,
    imageAlt,
    noindex,
    path,
    structuredDataKey,
    structuredData,
    themeColor,
    title,
    type,
  ]);
}
