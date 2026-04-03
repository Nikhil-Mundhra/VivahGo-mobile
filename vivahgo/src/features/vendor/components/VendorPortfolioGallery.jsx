import { FallbackImage, FallbackVideo } from '../../../components/MediaWithFallback';

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
      <div className="rounded-2xl border border-[#ecdcc9] bg-[#fff8ef] p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[#f4e7d8] px-2.5 py-1 text-xs font-medium text-[#7a5c37]">
            Public Portfolio Preview
          </span>
          <span className="text-xs text-[#8a6f4a]">This matches what couples see in the vendor directory.</span>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-[#e8d6bf] bg-[#f6f1ea] shadow-sm">
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
      </div>

      {secondaryItems.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {secondaryItems.map(item => (
            <div key={item._id || item.url} className="overflow-hidden rounded-2xl border border-[#e8d6bf] bg-[#f6f1ea] shadow-sm">
              <PreviewTile item={item} />
              <div className="border-t border-[#e8d6bf] bg-[#fffaf3] p-3">
                <p className="truncate text-sm font-medium text-[#2f2a24]">{item.caption || item.filename || 'Portfolio item'}</p>
                <p className="mt-1 truncate text-xs text-[#8a6f4a]">{item.type === 'VIDEO' ? 'Video' : 'Image'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
