import { useMemo, useState } from "react";
import { WHATSAPP_SUPPORT_NUMBER } from "../constants";
import { formatVendorBudgetRange, formatVendorPricePerPlate, formatVendorPriceTier, getVendorPriceLevel, getVendorQuickFacts } from "../utils";
import { FallbackImage, FallbackVideo } from "./MediaWithFallback";
import { VENDOR_AVAILABILITY_COPY, addWeeks, buildWeekDays, dateKeyFromDate, getAvailabilityForDate, parseDateKey, startOfWeek } from "../vendorAvailability";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function formatWeekOption(date) {
  const weekStart = startOfWeek(date);
  const weekEnd = buildWeekDays(weekStart)[6].date;
  return `${WEEK_RANGE_FORMATTER.format(weekStart)} - ${WEEK_RANGE_FORMATTER.format(weekEnd)}`;
}

function VendorDetailScreen({ vendor, availabilityRange, onBack, onToggleWishlist, onAddReview }) {
  const initialVisibleTestimonials = 2;
  const quickFacts = getVendorQuickFacts(vendor);
  const media = Array.isArray(vendor.media) ? vendor.media : [];
  const canReviewVendor = Boolean(vendor.booked);
  const coverItem = media.find(item => item?.isCover) || media[0] || null;
  const testimonials = useMemo(() => {
    const seeded = Array.isArray(vendor.testimonials) ? vendor.testimonials : [];
    const reviews = Array.isArray(vendor.reviews) ? vendor.reviews : [];
    return [...seeded, ...reviews];
  }, [vendor.reviews, vendor.testimonials]);
  const [reviewForm, setReviewForm] = useState({ name: "", rating: String(vendor.rating || 5), text: "" });
  const [showAllTestimonials, setShowAllTestimonials] = useState(false);
  const initialWeekDate = availabilityRange?.startDate ? parseDateKey(availabilityRange.startDate) : new Date();
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => startOfWeek(initialWeekDate));

  const mapQuery = vendor.mapQuery || vendor.address || vendor.city || `${vendor.name} service area`;
  const embeddedMapQuery = encodeURIComponent(mapQuery);
  const visibleTestimonials = showAllTestimonials ? testimonials : testimonials.slice(0, initialVisibleTestimonials);
  const weekDays = useMemo(() => buildWeekDays(selectedWeekStart), [selectedWeekStart]);
  const weekOptions = useMemo(() => (
    Array.from({ length: 6 }, (_, index) => {
      const date = addWeeks(selectedWeekStart, index - 1);
      return {
        key: dateKeyFromDate(date),
        date,
        label: formatWeekOption(date),
      };
    })
  ), [selectedWeekStart]);
  const focusedRangeLabel = `${WEEK_RANGE_FORMATTER.format(weekDays[0].date)} - ${WEEK_RANGE_FORMATTER.format(weekDays[6].date)}`;

  function getDayTone(status) {
    if (status === "open") return "vendor-availability-day is-open";
    if (status === "partial") return "vendor-availability-day is-partial";
    if (status === "near-full") return "vendor-availability-day is-near-full";
    if (status === "full") return "vendor-availability-day is-full";
    return "vendor-availability-day is-unavailable";
  }

  function handleRequestService() {
    const whatsappNumber = String(vendor?.whatsappNumber || WHATSAPP_SUPPORT_NUMBER || "").replace(/[^0-9]/g, "");
    const message = encodeURIComponent(
      `Hello! I found ${vendor.name} on VivahGo and would like to request their ${vendor.type} services. Could you please help me with availability and booking details?`
    );
    window.open(`https://wa.me/${whatsappNumber || WHATSAPP_SUPPORT_NUMBER}?text=${message}`, "_blank", "noopener,noreferrer");
  }

  function submitReview(event) {
    event.preventDefault();
    if (!canReviewVendor) {
      return;
    }
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
          <div className="vendor-detail-meta">{vendor.type}{vendor.subType ? ` · ${vendor.subType}` : ""}{vendor.city ? ` · ${vendor.city}` : ""}</div>
          {quickFacts.length > 0 && (
            <div className="vendor-detail-facts-row">
              <div className="vendor-detail-meta-line">{quickFacts.join(" · ")}</div>
            </div>
          )}
          <div className="vendor-stars">
            {"★".repeat(vendor.rating)}{"☆".repeat(5 - vendor.rating)}
            <span style={{ color: "var(--color-light-text)", fontSize: 11 }}> {vendor.rating}.0</span>
          </div>
          <div className="vendor-detail-price">{formatVendorPriceTier(getVendorPriceLevel(vendor))}</div>
          <div className="vendor-detail-meta-line">
            {formatVendorBudgetRange(vendor) || "Price on request"}
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
            <div className="vendor-detail-stat-label">Price Range</div>
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

      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Availability This Week</div>
        <div className="vendor-availability-panel">
          <div className="vendor-availability-panel-head">
            <div>
              <div className="vendor-availability-panel-title">{MONTH_LABEL_FORMATTER.format(selectedWeekStart)}</div>
              <div className="vendor-availability-panel-copy">{focusedRangeLabel}</div>
            </div>
            <div className="vendor-availability-nav">
              <button type="button" className="vendor-availability-nav-btn" onClick={() => setSelectedWeekStart(current => addWeeks(current, -1))}>
                Previous
              </button>
              <button type="button" className="vendor-availability-nav-btn" onClick={() => setSelectedWeekStart(current => addWeeks(current, 1))}>
                Next
              </button>
            </div>
          </div>
          <div className="vendor-availability-week-picker" role="tablist" aria-label="Select availability week">
            {weekOptions.map((option) => {
              const isActive = dateKeyFromDate(option.date) === dateKeyFromDate(selectedWeekStart);
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`vendor-availability-week-chip${isActive ? " active" : ""}`}
                  onClick={() => setSelectedWeekStart(startOfWeek(option.date))}
                >
                  Week of {option.label}
                </button>
              );
            })}
          </div>
          <div className="vendor-availability-week-grid">
            {weekDays.map((day, index) => {
              const availability = getAvailabilityForDate(vendor, day.key);
              return (
                <div key={day.key} className={getDayTone(availability.status)}>
                  <span className="vendor-availability-day-label">{WEEKDAY_LABELS[index]}</span>
                  <strong className="vendor-availability-day-number">{day.date.getDate()}</strong>
                  <span className="vendor-availability-day-status">{VENDOR_AVAILABILITY_COPY[availability.status]}</span>
                </div>
              );
            })}
          </div>
          <div className="vendor-availability-panel-footnote">
            Couples can browse one week at a time so they can quickly sanity-check whether this vendor fits their event window.
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

      {Array.isArray(vendor.bundledServices) && vendor.bundledServices.length > 0 && (
        <div className="vendor-detail-section">
          <div className="vendor-detail-section-title">Also Offers</div>
          <div className="vendor-detail-locations">
            {vendor.bundledServices.map((service, i) => (
              <div className="vendor-detail-location-chip" key={`${service}-${i}`}>✨ {service}</div>
            ))}
          </div>
        </div>
      )}

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
              <div style={{ fontWeight: 600, color: "var(--color-dark-text)" }}>Map preview of the service area</div>
              <div style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 4 }}>
                {vendor.address || `${vendor.city} service area`}
              </div>
            </div>
            <div className="vendor-detail-map-embed">
              <iframe
                title={`${vendor.city || vendor.name} map`}
                src={`https://www.google.com/maps?q=${embeddedMapQuery}&z=12&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        )}
      </div>

      {/* Request Service */}
      <div className="vendor-detail-cta">
        <button className="vendor-request-btn" onClick={handleRequestService}>
          <span style={{ fontSize: 20 }}>💬</span> Request Service via WhatsApp
        </button>
      </div>

      <div className="vendor-detail-section">
        <div className="vendor-detail-section-title">Testimonials</div>
        {testimonials.length === 0 && (
          <div className="vendor-detail-empty">No testimonials yet. Be the first to review this vendor.</div>
        )}
        {visibleTestimonials.map((item, index) => (
          <div className="vendor-detail-testimonial" key={`${item.author}-${index}`}>
            <div className="vendor-detail-testimonial-head">
              <strong>{item.author || "VivahGo Couple"}</strong>
              <span>{`${"★".repeat(item.rating || vendor.rating || 5)}${"☆".repeat(5 - (item.rating || vendor.rating || 5))}`}</span>
            </div>
            <div>{item.text}</div>
          </div>
        ))}
        {testimonials.length > initialVisibleTestimonials && !showAllTestimonials && (
          <button
            type="button"
            className="vendor-detail-more-btn"
            onClick={() => setShowAllTestimonials(true)}
          >
            New More
          </button>
        )}
      </div>

      <div className="vendor-detail-section">
        {canReviewVendor ? (
          <>
            <div className="vendor-detail-section-title">Review This Vendor</div>
            <form className="vendor-detail-review-form" onSubmit={submitReview}>
              <input
                className="input-field"
                value={reviewForm.name}
                onChange={event => setReviewForm(current => ({ ...current, name: event.target.value }))}
                placeholder="Your name"
              />
              <div className="vendor-detail-star-picker" aria-label="Select rating">
                {[1, 2, 3, 4, 5].map(star => {
                  const isActive = star <= Number(reviewForm.rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      className={`vendor-detail-star-button${isActive ? " active" : ""}`}
                      onClick={() => setReviewForm(current => ({ ...current, rating: String(star) }))}
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
                      aria-pressed={isActive}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              <textarea
                className="textarea-field"
                value={reviewForm.text}
                onChange={event => setReviewForm(current => ({ ...current, text: event.target.value }))}
                placeholder={vendor.reviewPrompt || "Share your review"}
                rows={4}
              />
              <button type="submit" className="vendor-secondary-btn">Submit Review</button>
            </form>
          </>
        ) : (
          <div className="vendor-detail-locked-note">
            Book this vendor to unlock the review form.
          </div>
        )}
      </div>
    </div>
  );
}

export default VendorDetailScreen;
