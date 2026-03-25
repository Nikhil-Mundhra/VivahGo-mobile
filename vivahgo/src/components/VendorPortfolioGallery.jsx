import { FallbackImage, FallbackVideo } from './MediaWithFallback';

function sortVisibleMedia(media) {
  return [...(Array.isArray(media) ? media : [])]
    .filter(item => item?.isVisible !== false)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
}

function PreviewTile({ item, cover = false }) {
  const commonClassName = cover
    ? 'h-full w-full object-cover'
    : 'aspect-square h-full w-full object-cover';

  if (item.type === 'VIDEO') {
    return (
      <FallbackVideo
        src={item.url}
        preload="metadata"
        controls
        className={commonClassName}
        aria-label={item.altText || item.filename || 'Portfolio video'}
      />
    );
  }

  return (
    <FallbackImage
      src={item.url}
      alt={item.altText || item.filename || 'Portfolio image'}
      loading="lazy"
      className={commonClassName}
    />
  );
}

export default function VendorPortfolioGallery({ media }) {
  const visibleMedia = sortVisibleMedia(media);

  if (visibleMedia.length === 0) {
    return (
      <p className="rounded-2xl border border-gray-100 bg-gray-50 py-8 text-center text-sm text-gray-400">
        Nothing is published yet. Visible portfolio items will appear here.
      </p>
    );
  }

  const coverItem = visibleMedia.find(item => item.isCover) || visibleMedia[0];
  const secondaryItems = visibleMedia.filter(item => item._id !== coverItem._id);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-gray-100 shadow-sm">
        <div className="relative aspect-[16/9]">
          <PreviewTile item={coverItem} cover />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 text-white">
            <div className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
              {coverItem.type === 'VIDEO' ? 'Featured video' : 'Featured image'}
            </div>
            <p className="mt-2 text-base font-semibold">{coverItem.caption || coverItem.filename || 'Featured portfolio item'}</p>
          {coverItem.altText && (
              <p className="mt-1 text-sm text-white/80">{coverItem.altText}</p>
            )}
          </div>
        </div>
      </div>

      {secondaryItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {secondaryItems.map(item => (
            <div key={item._id || item.url} className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 shadow-sm">
              <PreviewTile item={item} />
              <div className="border-t border-gray-100 bg-white p-3">
                <p className="truncate text-sm font-medium text-gray-800">{item.caption || item.filename || 'Portfolio item'}</p>
                <p className="mt-1 truncate text-xs text-gray-400">{item.type === 'VIDEO' ? 'Video' : 'Image'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
