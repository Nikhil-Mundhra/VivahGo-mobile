import { useState } from "react";
import { useBackButtonClose } from "../../../hooks/useBackButtonClose";

function AccountScreen({ user, authMode, wedding, setWedding, subscription, onClose, onLogout, onDeleteAccount }) {
  const [form, setForm] = useState({
    bride: wedding.bride || "",
    groom: wedding.groom || "",
    date: wedding.date || "",
    venue: wedding.venue || "",
    budget: wedding.budget || "",
    guests: wedding.guests || "",
  });
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
                  Active until {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            {tier !== "starter" ? (
              <>
                <p style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 8 }}>
                  Need to renew or switch plans? Open pricing and complete the next Razorpay payment cycle there.
                </p>
                <a
                  className="btn-secondary"
                  href="/home#pricing"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}
                >
                  View Premium Plans
                </a>
              </>
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

        {/* Danger Zone */}
        {!isDemo && onDeleteAccount && (
          <div style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid rgba(139,26,26,0.18)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: "#b91c1c", textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 12,
            }}>
              Danger Zone
            </div>

            {!confirmDelete ? (
              <button
                onClick={() => { setConfirmDelete(true); setDeleteError(""); }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1.5px solid #b91c1c",
                  background: "transparent",
                  color: "#b91c1c",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                }}
              >
                Delete Account
              </button>
            ) : (
              <div style={{
                background: "rgba(185,28,28,0.06)",
                border: "1.5px solid rgba(185,28,28,0.25)",
                borderRadius: 12,
                padding: "14px 16px",
              }}>
                <p style={{
                  fontSize: 13, color: "#7f1d1d",
                  lineHeight: 1.5, marginBottom: 14, marginTop: 0,
                }}>
                  This will permanently delete your account and all wedding data. This cannot be undone.
                </p>
                {deleteError && (
                  <p style={{
                    fontSize: 12, color: "#b91c1c",
                    marginBottom: 10, marginTop: 0,
                  }}>
                    {deleteError}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteError(""); }}
                    disabled={deleting}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 9,
                      border: "1px solid rgba(139,26,26,0.2)",
                      background: "transparent",
                      color: "var(--color-light-text)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDeleting(true);
                      setDeleteError("");
                      try {
                        await onDeleteAccount();
                      } catch (err) {
                        setDeleteError(err?.message || "Failed to delete account. Please try again.");
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 9,
                      border: "none",
                      background: deleting ? "#e57373" : "#b91c1c",
                      color: "white",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: deleting ? "not-allowed" : "pointer",
                    }}
                  >
                    {deleting ? "Deleting…" : "Yes, Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountScreen;
