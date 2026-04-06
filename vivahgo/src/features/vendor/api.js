import { request } from "../../shared/api/request.js";

const VENDOR_PROFILE_CACHE_KEY = "vendor:me";
const VENDOR_DIRECTORY_CACHE_KEY = "vendors:directory";

export function vendorProfileQueryKey() {
  return ["vendor", "me"];
}

export function vendorDirectoryQueryKey() {
  return ["vendors", "directory"];
}

export function fetchVendorProfile(token) {
  return request("/vendor/me", {
    token,
    ttlMs: 30 * 1000,
    cacheKey: VENDOR_PROFILE_CACHE_KEY,
  });
}

export function registerVendor(token, data, mutationMeta = {}) {
  return request("/vendor/me", {
    method: "POST",
    token,
    body: {
      ...data,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function updateVendorProfile(token, data, mutationMeta = {}) {
  return request("/vendor/me", {
    method: "PATCH",
    token,
    body: {
      ...data,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function fetchPresignedUrl(token, { filename, contentType, size }) {
  return request("/media/presigned-url", {
    method: "POST",
    token,
    body: { filename, contentType, size },
  });
}

export function fetchVerificationPresignedUrl(token, { filename, contentType, size }) {
  return request("/media/verification-presigned-url", {
    method: "POST",
    token,
    body: { filename, contentType, size },
  });
}

export function saveVendorMedia(token, mediaData, mutationMeta = {}) {
  return request("/vendor/media", {
    method: "POST",
    token,
    body: {
      ...mediaData,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function updateVendorMedia(token, mediaData, mutationMeta = {}) {
  return request("/vendor/media", {
    method: "PUT",
    token,
    body: {
      ...mediaData,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function removeVendorMedia(token, mediaId, mutationMeta = {}) {
  return request("/vendor/media", {
    method: "DELETE",
    token,
    body: {
      mediaId,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function saveVendorVerificationDocument(token, payload, mutationMeta = {}) {
  return request("/vendor/verification", {
    method: "POST",
    token,
    body: {
      ...payload,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function removeVendorVerificationDocument(token, documentId, mutationMeta = {}) {
  return request("/vendor/verification", {
    method: "DELETE",
    token,
    body: {
      documentId,
      correlationId: mutationMeta.correlationId || "",
      clientSequence: mutationMeta.clientSequence ?? null,
      baseRevision: mutationMeta.baseRevision ?? null,
    },
    invalidateKeys: [VENDOR_PROFILE_CACHE_KEY, VENDOR_DIRECTORY_CACHE_KEY],
  });
}

export function fetchApprovedVendors() {
  return request("/vendors", {
    ttlMs: 60 * 1000,
    cacheKey: VENDOR_DIRECTORY_CACHE_KEY,
  });
}
