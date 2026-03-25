import { useMemo, useState } from "react";
import { WHATSAPP_SUPPORT_NUMBER } from "../constants";
import { formatVendorBudgetRange, formatVendorPricePerPlate, formatVendorPriceTier, getVendorQuickFacts } from "../utils";
import { FallbackImage, FallbackVideo } from "./MediaWithFallback";

function VendorDetailScreen({ vendor, onBack, onToggleWishlist, onAddReview }) {
  const quickFacts = getVendorQuickFacts(vendor);
  const media = Array.isArray(vendor.media) ? vendor.media : [];
  const coverItem = media.find(item => item?.isCover) || media[0] || null;
  const testimonials = useMemo(() => {
    const seeded = Array.isArray(vendor.testimonials) ? vendor.testimonials : [];
    const reviews = Array.isArray(vendor.reviews) ? vendor.reviews : [];
    return [...seeded, ...reviews];
  }, [vendor.reviews, vendor.testimonials]);
  const [reviewForm, setReviewForm] = useState({ name: "", rating: String(vendor.rating || 5), text: "" });

  function handleRequestService() {
    const message = encodeURIComponent(
      `Hello! I found ${vendor.name} on VivahGo and would like to request their ${vendor.type} services. Could you please help me with availability and booking details?`
    );
    window.open(`https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  function handleViewMap() {
    const query = encodeURIComponent(vendor.mapQuery || vendor.address || `${vendor.name} ${vendor.city}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener,noreferrer");
  }

  function submitReview(event) {
    event.preventDefault();
    const trimmedName = reviewForm.name.trim();
    const trimmedText = reviewForm.text.trim();
    if (!trimmedName || !trimmedText) {
      return;
    }

    onAddReview?.({
      author: trimmedName,
      rating: Number(reviewForm.rating) || vendor.rating || 5,
      text: trimmedText,
    });
    setReviewForm({ name: "", rating: String(vendor.rating || 5), text: "" });
  }

  return (
    <div className="vendor-detail-screen">
      {/* Back Header */}
      <div className="vendor-detail-header">
        <button className="vendor-detail-back" onClick={onBack}>←</button>
        <div className="vendor-detail-header-title">Vendor Details</div>
        <button type="button" className={`vendor-detail-wishlist${vendor.wishlist ? " active" : ""}`} onClick={onToggleWishlist}>
          {vendor.wishlist ? "In Wishlist" : "Wishlist"}
        </button>
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
          <div className="vendor-detail-meta-line">
            {formatVendorBudgetRange(vendor) || "Budget on request"}
            {formatVendorPricePerPlate(vendor) ? ` · ${formatVendorPricePerPlate(vendor)}` : ""}
          </div>
        </div>
        {vendor.booked && (
          <div className="vendor-detail-booked-badge">Booked ✓</div>
        )}
      </div>

      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Directory Highlights</div>
        <div className="vendor-detail-stat-grid">
          <div className="vendor-detail-stat-card">
            <div className="vendor-detail-stat-label">Budget</div>
            <div className="vendor-detail-stat-value">{formatVendorBudgetRange(vendor) || "On request"}</div>
          </div>
          <div className="vendor-detail-stat-card">
            <div className="vendor-detail-stat-label">Price per plate</div>
            <div className="vendor-detail-stat-value">{formatVendorPricePerPlate(vendor) || "Not applicable"}</div>
          </div>
          <div className="vendor-detail-stat-card">
            <div className="vendor-detail-stat-label">Reviews</div>
            <div className="vendor-detail-stat-value">{vendor.reviewCount || testimonials.length || 0}</div>
          </div>
          <div className="vendor-detail-stat-card">
            <div className="vendor-detail-stat-label">Booking style</div>
            <div className="vendor-detail-stat-value">{vendor.serviceMode || "Custom quote"}</div>
          </div>
        </div>
      </div>

      {coverItem && (
        <div className="vendor-detail-section">
          <div className="vendor-detail-section-title">Portfolio Highlights</div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ borderRadius: 20, overflow: "hidden", background: "#F6F1EA" }}>
              {coverItem.type === "VIDEO" ? (
                <FallbackVideo
                  src={coverItem.url}
                  controls
                  preload="metadata"
                  style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }}
                />
              ) : (
                <FallbackImage
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
                        <FallbackVideo
                          src={item.url}
                          preload="metadata"
                          style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <FallbackImage
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
        {(vendor.address || vendor.type === "Venue") && (
          <div className="vendor-detail-map-card">
            <div className="vendor-detail-map-text">
              <div style={{ fontWeight: 600, color: "var(--color-dark-text)" }}>Map location of the venue</div>
              <div style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 4 }}>
                {vendor.address || `${vendor.city} service area`}
              </div>
            </div>
            <button type="button" className="vendor-detail-map-btn" onClick={handleViewMap}>Open Map</button>
          </div>
        )}
      </div>

      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Testimonials</div>
        {testimonials.length === 0 && (
          <div className="vendor-detail-empty">No testimonials yet. Be the first to review this vendor.</div>
        )}
        {testimonials.map((item, index) => (
          <div className="vendor-detail-testimonial" key={`${item.author}-${index}`}>
            <div className="vendor-detail-testimonial-head">
              <strong>{item.author || "VivahGo Couple"}</strong>
              <span>{`${"★".repeat(item.rating || vendor.rating || 5)}${"☆".repeat(5 - (item.rating || vendor.rating || 5))}`}</span>
            </div>
            <div>{item.text}</div>
          </div>
        ))}
      </div>

      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Review This Vendor</div>
        <form className="vendor-detail-review-form" onSubmit={submitReview}>
          <input
            className="input-field"
            value={reviewForm.name}
            onChange={event => setReviewForm(current => ({ ...current, name: event.target.value }))}
            placeholder="Your name"
          />
          <select
            className="select-field"
            value={reviewForm.rating}
            onChange={event => setReviewForm(current => ({ ...current, rating: event.target.value }))}
          >
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
          <textarea
            className="textarea-field"
            value={reviewForm.text}
            onChange={event => setReviewForm(current => ({ ...current, text: event.target.value }))}
            placeholder={vendor.reviewPrompt || "Share your review"}
            rows={4}
          />
          <button type="submit" className="vendor-secondary-btn">Submit Review</button>
        </form>
      </div>

      {/* Request Service */}
      <div className="vendor-detail-cta">
        <button className="vendor-secondary-btn" type="button" onClick={handleViewMap} style={{ marginBottom: 10 }}>
          View Location on Map
        </button>
        <button className="vendor-request-btn" onClick={handleRequestService}>
          <span style={{ fontSize: 20 }}>💬</span> Request Service via WhatsApp
        </button>
      </div>
    </div>
  );
}

export default VendorDetailScreen;
