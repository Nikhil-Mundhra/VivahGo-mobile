import { useState } from "react";
import { useBackButtonClose } from "../../../shared/hooks/useBackButtonClose.js";
import { DEFAULT_REMINDER_SETTINGS } from "../../../plannerDefaults";
import { getMarketingUrl } from "../../../siteUrls.js";

const PRICING_URL = getMarketingUrl("/pricing");

function AccountScreen({
  user,
  authMode,
  subscription,
  activePlan,
  planAccess,
  notificationPreferences,
  notificationSupport,
  notificationError,
  isUpdatingNotifications,
  onClose,
  onLogout,
  onDeleteAccount,
  onStartOnboarding,
  onEnableBrowserNotifications,
  onDisableBrowserNotifications,
  onSaveNotificationPreferences,
  onUpdateReminderSettings,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useBackButtonClose(true, onClose);

  const isDemo = authMode === "demo";

  const tier = subscription?.tier || "starter";
  const tierLabel = tier === "studio" ? "Studio" : tier === "premium" ? "Premium" : "Starter";
  const tierColors = {
    starter: { bg: "rgba(139,26,26,0.09)", text: "var(--color-crimson)", border: "rgba(139,26,26,0.18)" },
    premium: { bg: "rgba(212,175,55,0.12)", text: "#8B6914", border: "rgba(212,175,55,0.3)" },
    studio: { bg: "rgba(30,60,114,0.10)", text: "#1a3a7c", border: "rgba(30,60,114,0.25)" },
  };
  const tierColor = tierColors[tier] || tierColors.starter;
  const activeUntilLabel = subscription?.currentPeriodEnd && tier !== "starter"
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const isPaidPlan = tier === "premium" || tier === "studio";
  const reminderSettings = {
    ...DEFAULT_REMINDER_SETTINGS,
    ...(activePlan?.reminderSettings || {}),
  };
  const canConfigureScheduledReminders = !isDemo && Boolean(planAccess?.canEdit) && isPaidPlan;
  const browserPushConnected = Boolean(notificationPreferences?.browserPushEnabled);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Account & Settings</div>

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
            {isDemo && (
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  borderRadius: 8, padding: "2px 9px",
                  background: "rgba(245,127,23,0.12)",
                  color: "#E65100",
                  border: "1px solid rgba(245,127,23,0.25)",
                }}>
                  Demo Mode
                </span>
              </div>
            )}
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
            <div style={{
              borderRadius: 14,
              padding: "14px 16px",
              background: tierColor.bg,
              border: `1px solid ${tierColor.border}`,
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: tierColor.text,
              }}>
                {tierLabel} Plan
              </div>
              {activeUntilLabel && (
                <div style={{
                  fontSize: 11,
                  color: "var(--color-light-text)",
                  marginTop: 6,
                }}>
                  Active until {activeUntilLabel}
                </div>
              )}
            </div>
            {tier !== "starter" ? (
              <>
                <p style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 8 }}>
                  Need to renew or switch plans? Open pricing and complete the next Razorpay payment cycle there.
                </p>
                {tier !== "studio" && (
                  <a
                    className="btn-secondary"
                    href={PRICING_URL}
                    style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}
                  >
                    View Plans
                  </a>
                )}
              </>
            ) : (
              <a
                className="btn-primary"
                href={PRICING_URL}
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}
              >
                Upgrade to Premium
              </a>
            )}
          </div>
        )}

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
              Notifications
            </div>
            <div style={{
              borderRadius: 14,
              padding: "14px 16px",
              background: "rgba(212,175,55,0.08)",
              border: "1px solid rgba(212,175,55,0.18)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-crimson)" }}>
                Browser notifications
              </div>
              <div style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 6, lineHeight: 1.5 }}>
                {notificationSupport?.configured
                  ? browserPushConnected
                    ? "This browser is connected for planner reminders."
                    : notificationSupport?.permission === "denied"
                      ? "Browser permission is blocked. Update your browser settings to enable reminders."
                      : "Connect this browser to receive Premium planner reminders."
                  : "Firebase web messaging is not configured yet."}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {!browserPushConnected ? (
                  <button className="btn-primary" onClick={onEnableBrowserNotifications} disabled={isUpdatingNotifications || !notificationSupport?.configured}>
                    {isUpdatingNotifications ? "Connecting..." : "Enable Browser Notifications"}
                  </button>
                ) : (
                  <button className="btn-secondary" onClick={onDisableBrowserNotifications} disabled={isUpdatingNotifications}>
                    {isUpdatingNotifications ? "Disconnecting..." : "Disconnect This Browser"}
                  </button>
                )}
              </div>
              <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 14, fontSize: 13, color: "var(--color-dark-text)" }}>
                <span>Event reminders</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences?.eventReminders !== false}
                  onChange={(event) => onSaveNotificationPreferences?.({ eventReminders: event.target.checked })}
                  disabled={isUpdatingNotifications}
                />
              </label>
              <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, fontSize: 13, color: "var(--color-dark-text)" }}>
                <span>Payment reminders</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences?.paymentReminders !== false}
                  onChange={(event) => onSaveNotificationPreferences?.({ paymentReminders: event.target.checked })}
                  disabled={isUpdatingNotifications}
                />
              </label>
              {notificationError ? (
                <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 12 }}>
                  {notificationError}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!isDemo && activePlan && (
          <div style={{
            marginBottom: 20, paddingBottom: 20,
            borderBottom: "1px solid rgba(212,175,55,0.15)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: "var(--color-gold)", textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 10,
            }}>
              Active Plan Reminders
            </div>
            <div style={{
              borderRadius: 14,
              padding: "14px 16px",
              background: "rgba(139,26,26,0.05)",
              border: "1px solid rgba(139,26,26,0.12)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-crimson)" }}>
                {(activePlan?.bride || "Bride")} &amp; {(activePlan?.groom || "Groom")}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 6, lineHeight: 1.5 }}>
                Real scheduled reminders are part of Premium and Studio.
              </div>

              {canConfigureScheduledReminders ? (
                <>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 14, fontSize: 13, color: "var(--color-dark-text)" }}>
                    <span>Enable scheduled reminders for this plan</span>
                    <input
                      type="checkbox"
                      checked={Boolean(reminderSettings.enabled)}
                      onChange={(event) => onUpdateReminderSettings?.({ enabled: event.target.checked })}
                    />
                  </label>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, fontSize: 13, color: "var(--color-dark-text)" }}>
                    <span>Event reminder: 1 day before</span>
                    <input
                      type="checkbox"
                      checked={reminderSettings.eventDayBefore !== false}
                      onChange={(event) => onUpdateReminderSettings?.({ eventDayBefore: event.target.checked })}
                      disabled={!reminderSettings.enabled}
                    />
                  </label>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, fontSize: 13, color: "var(--color-dark-text)" }}>
                    <span>Event reminder: 3 hours before</span>
                    <input
                      type="checkbox"
                      checked={reminderSettings.eventHoursBefore !== false}
                      onChange={(event) => onUpdateReminderSettings?.({ eventHoursBefore: event.target.checked })}
                      disabled={!reminderSettings.enabled}
                    />
                  </label>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, fontSize: 13, color: "var(--color-dark-text)" }}>
                    <span>Payment reminder: 3 days before</span>
                    <input
                      type="checkbox"
                      checked={reminderSettings.paymentThreeDaysBefore !== false}
                      onChange={(event) => onUpdateReminderSettings?.({ paymentThreeDaysBefore: event.target.checked })}
                      disabled={!reminderSettings.enabled}
                    />
                  </label>
                  <label style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 10, fontSize: 13, color: "var(--color-dark-text)" }}>
                    <span>Payment reminder: day of due date</span>
                    <input
                      type="checkbox"
                      checked={reminderSettings.paymentDayOf !== false}
                      onChange={(event) => onUpdateReminderSettings?.({ paymentDayOf: event.target.checked })}
                      disabled={!reminderSettings.enabled}
                    />
                  </label>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "var(--color-light-text)", marginTop: 14, lineHeight: 1.5 }}>
                    {isPaidPlan
                      ? "You can receive reminders on this plan, but only editors and owners can change the schedule."
                      : "Upgrade this workspace owner to Premium to unlock real scheduled reminders for events and budget payments."}
                  </div>
                  {tier === "starter" ? (
                    <a
                      className="btn-primary"
                      href={PRICING_URL}
                      style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 12 }}
                    >
                      Unlock Premium Reminders
                    </a>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}

        {isDemo && (
          <button className="btn-primary" onClick={onStartOnboarding} style={{ marginBottom: 10 }}>
            Login / Sign Up
          </button>
        )}

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
