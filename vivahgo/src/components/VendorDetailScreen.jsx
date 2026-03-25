import { WHATSAPP_SUPPORT_NUMBER } from "../constants";
import { formatVendorPriceTier, getVendorQuickFacts } from "../utils";

function VendorDetailScreen({ vendor, onBack }) {
  const quickFacts = getVendorQuickFacts(vendor);
  const media = Array.isArray(vendor.media) ? vendor.media : [];
  const coverItem = media.find(item => item?.isCover) || media[0] || null;

  function handleRequestService() {
    const message = encodeURIComponent(
      `Hello! I found ${vendor.name} on VivahGo and would like to request their ${vendor.type} services. Could you please help me with availability and booking details?`
    );
    window.open(`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="vendor-detail-screen">
      {/* Back Header */}
      <div className="vendor-detail-header">
        <button className="vendor-detail-back" onClick={onBack}>←</button>
        <div className="vendor-detail-header-title">Vendor Details</div>
      </div>

      {/* Hero Card */}
      <div className="vendor-detail-hero">
        {vendor.coverImageUrl ? (
          <img
            src={vendor.coverImageUrl}
            alt={vendor.name}
            style={{ width: 82, height: 82, borderRadius: 22, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div className="vendor-detail-hero-icon">{vendor.emoji}</div>
        )}
        <div className="vendor-detail-hero-info">
          <div className="vendor-detail-name">{vendor.name}</div>
          <div className="vendor-detail-meta">{vendor.type} · {vendor.city}</div>
          {quickFacts.length > 0 && (
            <div className="vendor-detail-facts-row">
              <div className="vendor-detail-meta-line">{quickFacts.join(" · ")}</div>
            </div>
          )}
          <div className="vendor-stars">
            {"★".repeat(vendor.rating)}{"☆".repeat(5 - vendor.rating)}
            <span style={{ color: "var(--color-light-text)", fontSize: 11 }}> {vendor.rating}.0</span>
          </div>
          <div className="vendor-detail-price">{formatVendorPriceTier(vendor.priceLevel)}</div>
        </div>
        {vendor.booked && (
          <div className="vendor-detail-booked-badge">Booked ✓</div>
        )}
      </div>

      {coverItem && (
        <div className="vendor-detail-section">
          <div className="vendor-detail-section-title">Portfolio Highlights</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ borderRadius: 20, overflow: "hidden", background: "#F6F1EA" }}>
              {coverItem.type === "VIDEO" ? (
                <video
                  src={coverItem.url}
                  controls
                  preload="metadata"
                  style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
                />
              ) : (
                <img
                  src={coverItem.url}
                  alt={coverItem.altText || coverItem.filename || vendor.name}
                  style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
                />
              )}
            </div>
            {media.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {media
                  .filter(item => item._id !== coverItem._id)
                  .slice(0, 3)
                  .map(item => (
                    <div key={item._id || item.url} style={{ borderRadius: 16, overflow: "hidden", background: "#F6F1EA" }}>
                      {item.type === "VIDEO" ? (
                        <video
                          src={item.url}
                          preload="metadata"
                          style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <img
                          src={item.url}
                          alt={item.altText || item.filename || vendor.name}
                          style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                        />
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Services */}
      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Services Offered</div>
        {(vendor.services || []).map((svc, i) => (
          <div className="vendor-detail-service-row" key={i}>
            <div className="vendor-detail-service-dot">✦</div>
            <div className="vendor-detail-service-label">{svc}</div>
          </div>
        ))}
      </div>

      {/* Locations */}
      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Available Locations</div>
        <div className="vendor-detail-locations">
          {(vendor.locations || [vendor.city]).map((loc, i) => (
            <div className="vendor-detail-location-chip" key={i}>📍 {loc}</div>
          ))}
        </div>
      </div>

      {/* Request Service */}
      <div className="vendor-detail-cta">
        <button className="vendor-request-btn" onClick={handleRequestService}>
          <span style={{ fontSize: 20 }}>💬</span> Request Service via WhatsApp
        </button>
      </div>
    </div>
  );
}

export default VendorDetailScreen;
