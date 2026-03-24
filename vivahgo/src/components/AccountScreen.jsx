import { useState } from "react";
import { useBackButtonClose } from "../hooks/useBackButtonClose";
import { createPortalSession } from "../api";

function AccountScreen({ user, authMode, wedding, setWedding, subscription, authToken, onClose, onLogout }) {
  const [form, setForm] = useState({
    bride: wedding.bride || "",
    groom: wedding.groom || "",
    date: wedding.date || "",
    venue: wedding.venue || "",
    budget: wedding.budget || "",
    guests: wedding.guests || "",
  });
  const [saved, setSaved] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  useBackButtonClose(true, onClose);

  function handleSave() {
    setWedding(current => ({ ...current, ...form }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onClose();
  }

  const isDemo = authMode === "demo";

  const tier = subscription?.tier || "starter";
  const tierLabel = tier === "studio" ? "Studio" : tier === "premium" ? "Premium" : "Starter";
  const tierColors = {
    starter: { bg: "rgba(139,26,26,0.09)", text: "var(--color-crimson)", border: "rgba(139,26,26,0.18)" },
    premium: { bg: "rgba(212,175,55,0.12)", text: "#8B6914", border: "rgba(212,175,55,0.3)" },
    studio: { bg: "rgba(30,60,114,0.10)", text: "#1a3a7c", border: "rgba(30,60,114,0.25)" },
  };
  const tierColor = tierColors[tier] || tierColors.starter;

  async function handleManageSubscription() {
    if (!authToken) return;
    setPortalError("");
    setPortalLoading(true);
    try {
      const { url } = await createPortalSession(authToken);
      window.location.href = url;
    } catch (err) {
      setPortalError(err.message || "Could not open subscription portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Account & Settings ⚙️</div>

        {/* Profile */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          marginBottom: 20, paddingBottom: 20,
          borderBottom: "1px solid rgba(212,175,55,0.15)",
        }}>
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user?.name}
              style={{
                width: 54, height: 54, borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid var(--color-gold)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 54, height: 54, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--color-crimson), var(--color-deep-red))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, color: "white", fontWeight: 700,
              border: "2px solid var(--color-gold)",
              flexShrink: 0,
            }}>
              {(user?.name || "V").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18, fontWeight: 700,
              color: "var(--color-crimson)",
              lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {user?.name || "Guest"}
            </div>
            {user?.email && (
              <div style={{
                fontSize: 12.5, color: "var(--color-light-text)",
                marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {user.email}
              </div>
            )}
            <div style={{ marginTop: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 600,
                borderRadius: 8, padding: "2px 9px",
                background: isDemo ? "rgba(245,127,23,0.12)" : "rgba(139,26,26,0.09)",
                color: isDemo ? "#E65100" : "var(--color-crimson)",
                border: isDemo ? "1px solid rgba(245,127,23,0.25)" : "1px solid rgba(139,26,26,0.18)",
              }}>
                {isDemo ? "Demo Mode" : "Google Account"}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Tier */}
        {!isDemo && (
          <div style={{
            marginBottom: 20, paddingBottom: 20,
            borderBottom: "1px solid rgba(212,175,55,0.15)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--color-gold)", textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 10,
            }}>
              Subscription
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 12, fontWeight: 700,
                borderRadius: 8, padding: "3px 11px",
                background: tierColor.bg,
                color: tierColor.text,
                border: `1px solid ${tierColor.border}`,
              }}>
                {tierLabel} Plan
              </span>
              {subscription?.currentPeriodEnd && tier !== "starter" && (
                <span style={{ fontSize: 11, color: "var(--color-light-text)" }}>
                  Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            {portalError && (
              <p style={{ fontSize: 12, color: "var(--color-crimson)", marginTop: 8 }}>{portalError}</p>
            )}
            {tier !== "starter" ? (
              <button
                className="btn-secondary"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                style={{ marginTop: 10, opacity: portalLoading ? 0.7 : 1 }}
              >
                {portalLoading ? "Opening\u2026" : "Manage Subscription"}
              </button>
            ) : (
              <a
                className="btn-primary"
                href="/home#pricing"
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}
              >
                Upgrade to Premium
              </a>
            )}
          </div>
        )}

        {/* Section label */}
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: "var(--color-gold)", textTransform: "uppercase",
          letterSpacing: 1, marginBottom: 14,
        }}>
          Wedding Details
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="input-group">
            <div className="input-label">Bride&apos;s Name</div>
            <input
              className="input-field"
              value={form.bride}
              onChange={e => setForm({ ...form, bride: e.target.value })}
              placeholder="e.g. Aarohi"
            />
          </div>
          <div className="input-group">
            <div className="input-label">Groom&apos;s Name</div>
            <input
              className="input-field"
              value={form.groom}
              onChange={e => setForm({ ...form, groom: e.target.value })}
              placeholder="e.g. Kabir"
            />
          </div>
        </div>

        <div className="input-group">
          <div className="input-label">Main Wedding Day</div>
          <input
            className="input-field"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            placeholder="e.g. 25 November 2027"
          />
        </div>

        <div className="input-group">
          <div className="input-label">Venue / Location</div>
          <input
            className="input-field"
            value={form.venue}
            onChange={e => setForm({ ...form, venue: e.target.value })}
            placeholder="e.g. Jaipur Palace Grounds"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="input-group">
            <div className="input-label">Total Budget (₹)</div>
            <input
              className="input-field"
              type="number"
              value={form.budget}
              onChange={e => setForm({ ...form, budget: e.target.value })}
              placeholder="e.g. 5000000"
            />
          </div>
          <div className="input-group">
            <div className="input-label">Expected Guests</div>
            <input
              className="input-field"
              type="number"
              value={form.guests}
              onChange={e => setForm({ ...form, guests: e.target.value })}
              placeholder="e.g. 300"
            />
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleSave}
          style={saved ? { background: "linear-gradient(135deg, #2E7D32, #1B5E20)" } : undefined}
        >
          {saved ? "✓ Saved!" : "Save Changes"}
        </button>
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-secondary-danger" onClick={onLogout}>
          Log Out
        </button>
      </div>
    </div>
  );
}

export default AccountScreen;
