import { request } from "../../shared/api/request.js";

export function fetchVendorProfile(token) {
  return request("/vendor/me", { token });
}

export function registerVendor(token, data) {
  return request("/vendor/me", { method: "POST", token, body: data });
}

export function updateVendorProfile(token, data) {
  return request("/vendor/me", { method: "PATCH", token, body: data });
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

export function saveVendorMedia(token, mediaData) {
  return request("/vendor/media", { method: "POST", token, body: mediaData });
}

export function updateVendorMedia(token, mediaData) {
  return request("/vendor/media", { method: "PUT", token, body: mediaData });
}

export function removeVendorMedia(token, mediaId) {
  return request("/vendor/media", { method: "DELETE", token, body: { mediaId } });
}

export function saveVendorVerificationDocument(token, payload) {
  return request("/vendor/verification", { method: "POST", token, body: payload });
}

export function removeVendorVerificationDocument(token, documentId) {
  return request("/vendor/verification", { method: "DELETE", token, body: { documentId } });
}

export function fetchApprovedVendors() {
  return request("/vendors");
}
