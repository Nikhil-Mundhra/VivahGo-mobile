import { WHATSAPP_SUPPORT_NUMBER } from "../constants";

function VendorDetailScreen({ vendor, onBack }) {
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
        <div className="vendor-detail-hero-icon">{vendor.emoji}</div>
        <div className="vendor-detail-hero-info">
          <div className="vendor-detail-name">{vendor.name}</div>
          <div className="vendor-detail-meta">{vendor.type} · {vendor.city}</div>
          <div className="vendor-stars">
            {"★".repeat(vendor.rating)}{"☆".repeat(5 - vendor.rating)}
            <span style={{ color: "var(--color-light-text)", fontSize: 11 }}> {vendor.rating}.0</span>
          </div>
          <div className="vendor-detail-price">{vendor.price}</div>
        </div>
        {vendor.booked && (
          <div className="vendor-detail-booked-badge">Booked ✓</div>
        )}
      </div>

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
