const path = require('node:path');

const MARKETING_PUBLIC_ASSET_PATHS = [
  '/MainHero.png',
];

function collectGuideCoverImages(guides = []) {
  return guides
    .map((guide) => (typeof guide?.coverImage === 'string' ? guide.coverImage.trim() : ''))
    .filter(Boolean);
}

function collectTrackedPublicAssetPaths(guides = []) {
  return Array.from(new Set([
    ...MARKETING_PUBLIC_ASSET_PATHS,
    ...collectGuideCoverImages(guides),
  ]));
}

function buildTrackedFilenameMap(guides = []) {
  return new Map(
    collectTrackedPublicAssetPaths(guides).map((assetPath) => [path.posix.basename(assetPath), assetPath])
  );
}

module.exports = {
  MARKETING_PUBLIC_ASSET_PATHS,
  buildTrackedFilenameMap,
  collectGuideCoverImages,
  collectTrackedPublicAssetPaths,
};
