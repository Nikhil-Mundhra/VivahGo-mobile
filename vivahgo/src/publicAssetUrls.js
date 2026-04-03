import publicAssetMap from "./generated/public-asset-map.js";

export function resolvePublicAssetUrl(assetPath = "") {
  const normalizedAssetPath = String(assetPath || "").trim();
  if (!normalizedAssetPath) {
    return "";
  }
  // For guide content, we want to preserve the original asset paths as 
  // the images are too small, making them expensive on blob
  if (normalizedAssetPath.startsWith("/guides/")) {
    return normalizedAssetPath;
  }

  return publicAssetMap?.assets?.[normalizedAssetPath] || normalizedAssetPath;
}
