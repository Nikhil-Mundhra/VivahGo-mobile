import VendorDetailScreen from './VendorDetailScreen';
import { formatVendorBudgetRange, formatVendorPriceTier, getVendorPriceLevel, getVendorQuickFacts } from '../lib/vendorFormatting.js';

function getPreviewEmoji(type) {
  const emojiByType = {
    Venue: '🏛️',
    Photography: '📸',
    Catering: '🍽️',
    'Wedding Invitations': '💌',
    'Wedding Gifts': '🎁',
    Music: '🎵',
    'Wedding Transportation': '🚌',
    'Tent House': '⛺',
    'Wedding Entertainment': '🎭',
    Florists: '🌷',
    'Wedding Planners': '🗂️',
    'Wedding Videography': '🎥',
    Honeymoon: '✈️',
    'Wedding Decorators': '✨',
    'Wedding Cakes': '🎂',
    'Wedding DJ': '🎧',
    Pandit: '🪔',
    Photobooth: '📷',
    Astrologers: '🔮',
    'Party Places': '🥂',
    Choreographer: '💃',
    'Bridal & Pre-Bridal': '👰',
    'Groom Services': '🤵',
    Bride: '👰',
    Groom: '🤵',
  };

  return emojiByType[type] || '🏷️';
}

function buildDirectoryVendor(vendor) {
  if (!vendor) {
    return null;
  }

  const media = Array.isArray(vendor.media) ? vendor.media : [];
  const visibleMedia = media
    .filter(item => item?.isVisible !== false)
    .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
  const coverMedia = visibleMedia.find(item => item?.isCover) || visibleMedia[0] || null;
  const primaryLocation = [vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ');
  const coverageLocations = Array.isArray(vendor.coverageAreas)
    ? vendor.coverageAreas.map(item => [item?.city, item?.state, item?.country].filter(Boolean).join(', '))
    : [];

  return {
    id: vendor._id || 'preview_vendor',
    name: vendor.businessName || 'Your Business Name',
    type: vendor.type || 'Vendor',
    subType: vendor.subType || '',
    bundledServices: Array.isArray(vendor.bundledServices) ? vendor.bundledServices : [],
    description: vendor.description || '',
    country: vendor.country || '',
    state: vendor.state || '',
    city: vendor.city || '',
    phone: vendor.phone || '',
    website: vendor.website || '',
    emoji: getPreviewEmoji(vendor.type),
    rating: 0,
    reviewCount: 0,
    priceLevel: null,
    booked: false,
    wishlist: false,
    serviceMode: '',
    services: [],
    locations: [primaryLocation, ...coverageLocations].filter(Boolean),
    testimonials: [],
    reviews: [],
    media: visibleMedia,
    coverImageUrl: coverMedia?.type === 'IMAGE' ? coverMedia.url : '',
    coverItem: coverMedia,
    budgetRange: vendor.budgetRange,
    featured: false,
    featuredLabel: '',
  };
}

function PreviewCard({ vendor }) {
  const quickFacts = getVendorQuickFacts(vendor);

  return (
    <div className="vendor-card">
      <div className="vendor-top">
        {vendor.coverImageUrl ? (
          <img
            src={vendor.coverImageUrl}
            alt={vendor.name}
            style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div className="vendor-icon">{vendor.emoji}</div>
        )}
        <div className="vendor-info">
          <div className="vendor-name">{vendor.name}</div>
          <div className="vendor-type">
            {vendor.type}
            {vendor.subType ? ` · ${vendor.subType}` : ''}
            {vendor.city ? ` · ${vendor.city}` : ''}
          </div>
          {quickFacts.length > 0 && (
            <div className="vendor-facts-row">
              <div className="vendor-facts-inline">{quickFacts.join(' · ')}</div>
            </div>
          )}
          <div className="vendor-stars">
            {'☆☆☆☆☆'} <span style={{ color: 'var(--color-light-text)', fontSize: 11 }}>No rating</span>{' '}
            <span style={{ color: 'var(--color-light-text)', fontSize: 11 }}>(0 reviews)</span>
          </div>
        </div>
      </div>
      <div className="vendor-bottom">
        <div className="vendor-price-wrap">
          <div className="vendor-price">{formatVendorPriceTier(getVendorPriceLevel(vendor))}</div>
          <div style={{ fontSize: 11, color: 'var(--color-light-text)', marginTop: 2 }}>
            {formatVendorBudgetRange(vendor) || 'Price on request'}
          </div>
        </div>
        <div className="vendor-card-actions">
          <button type="button" className="vendor-wishlist-btn" aria-label="Add to wishlist">♡</button>
          <div className="vendor-view-arrow">View Details →</div>
        </div>
      </div>
    </div>
  );
}

export default function VendorDirectoryPreview({ vendor }) {
  const directoryVendor = buildDirectoryVendor(vendor);

  if (!directoryVendor) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4a]">
          Vendor Card Preview
        </div>
        <PreviewCard vendor={directoryVendor} />
      </div>
      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f4a]">
          Vendor Detail Preview
        </div>
        <div className="overflow-hidden rounded-[24px] border border-[#e8d6bf] bg-white shadow-sm">
          <VendorDetailScreen
            vendor={directoryVendor}
            onBack={() => {}}
            onToggleWishlist={() => {}}
            onAddReview={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
