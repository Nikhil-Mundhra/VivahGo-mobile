import { useEffect, useState } from "react";
import { fetchGuestRsvpDetails, submitGuestRsvp } from "../api.js";
import { usePageSeo } from "../../../seo.js";

function clampAttendingGuestCount(value, invitedGuestCount, fallback = 1) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return Math.min(invitedGuestCount, Math.max(1, fallback));
  }

  return Math.min(invitedGuestCount, Math.max(1, parsed));
}

function buildGroupMemberFields(count, existingMembers = []) {
  const totalFields = Math.max(0, count - 1);
  return Array.from({ length: totalFields }, (_, index) => String(existingMembers[index] || ""));
}

function normalizeGroupMembersForSubmit(groupMembers, count) {
  return buildGroupMemberFields(count, groupMembers)
    .map((member) => member.trim())
    .filter(Boolean);
}

export default function GuestRsvpPage({ rsvpToken = "" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedRsvp, setSelectedRsvp] = useState("yes");
  const [attendingGuestCountInput, setAttendingGuestCountInput] = useState("1");
  const [groupMembers, setGroupMembers] = useState([]);
  const [showGroupMembersForm, setShowGroupMembersForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const guest = data?.guest || {};
  const wedding = data?.wedding || {};
  const plan = data?.plan || {};
  const coupleNames = [wedding.bride || plan.bride || "", wedding.groom || plan.groom || ""].filter(Boolean).join(" & ") || "Wedding Celebration";
  const seoDescription = data
    ? `RSVP for ${coupleNames}${wedding.date || plan.date ? ` on ${wedding.date || plan.date}` : ""}${wedding.venue || plan.venue ? ` at ${wedding.venue || plan.venue}` : ""}.`
    : "Confirm your wedding invitation and update your RSVP.";

  usePageSeo({
    title: data ? `${coupleNames} | RSVP` : "VivahGo RSVP | Confirm Your Invitation",
    description: seoDescription,
    path: rsvpToken ? `/rsvp/${rsvpToken}` : "/rsvp",
    noindex: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await fetchGuestRsvpDetails(rsvpToken);
        if (cancelled) {
          return;
        }

        setData(result);
        setSelectedRsvp(result?.guest?.rsvp === "no" ? "no" : "yes");
        const invitedGuestCount = Math.max(1, Number(result?.guest?.invitedGuestCount) || 1);
        const nextAttendingGuestCount = Math.max(1, Number(result?.guest?.attendingGuestCount) || invitedGuestCount);
        setAttendingGuestCountInput(String(nextAttendingGuestCount));
        setGroupMembers(buildGroupMemberFields(nextAttendingGuestCount, result?.guest?.groupMembers));
        setShowGroupMembersForm(Array.isArray(result?.guest?.groupMembers) && result.guest.groupMembers.some(Boolean));
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load this RSVP page.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (rsvpToken) {
      load();
    } else {
      setError("This RSVP link is invalid.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [rsvpToken]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!data?.guest) {
      return;
    }

    const invitedGuestCount = Math.max(1, Number(data?.guest?.invitedGuestCount) || 1);
    const resolvedAttendingGuestCount = clampAttendingGuestCount(
      attendingGuestCountInput,
      invitedGuestCount,
      Number(data?.guest?.attendingGuestCount) || invitedGuestCount
    );

    try {
      setSaving(true);
      setError("");
      const result = await submitGuestRsvp(rsvpToken, {
        rsvp: selectedRsvp,
        attendingGuestCount: selectedRsvp === "yes" ? resolvedAttendingGuestCount : 0,
        groupMembers: selectedRsvp === "yes" ? normalizeGroupMembersForSubmit(groupMembers, resolvedAttendingGuestCount) : [],
      });
      setData(current => current ? {
        ...current,
        guest: {
          ...current.guest,
          ...result.guest,
        },
      } : current);
      setAttendingGuestCountInput(String(result?.guest?.attendingGuestCount || resolvedAttendingGuestCount));
      setGroupMembers(buildGroupMemberFields(
        Math.max(1, Number(result?.guest?.attendingGuestCount) || resolvedAttendingGuestCount),
        result?.guest?.groupMembers
      ));
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Could not save your RSVP.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={styles.centered}>Loading your invitation...</div>;
  }

  if (error && !data) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <section style={styles.simpleCard}>
            <p style={styles.brandPill}>VivahGo RSVP</p>
            <h1 style={styles.emptyTitle}>RSVP Unavailable</h1>
            <p style={styles.emptyText}>{error}</p>
          </section>
        </div>
      </div>
    );
  }

  const events = Array.isArray(data?.events) ? data.events : [];
  const invitedGuestCount = Math.max(1, Number(guest.invitedGuestCount) || 1);
  const resolvedAttendingGuestCount = clampAttendingGuestCount(
    attendingGuestCountInput,
    invitedGuestCount,
    Number(guest.attendingGuestCount) || invitedGuestCount
  );

  function handleAttendingGuestCountChange(event) {
    const nextValue = event.target.value.replace(/[^0-9]/g, "");
    setAttendingGuestCountInput(nextValue);

    if (!nextValue) {
      setGroupMembers([]);
      setShowGroupMembersForm(false);
      return;
    }

    const nextCount = clampAttendingGuestCount(nextValue, invitedGuestCount, resolvedAttendingGuestCount);
    setGroupMembers((current) => buildGroupMemberFields(nextCount, current));
    if (nextCount <= 1) {
      setShowGroupMembersForm(false);
    }
  }

  function handleAttendingGuestCountBlur() {
    const nextCount = clampAttendingGuestCount(attendingGuestCountInput, invitedGuestCount, resolvedAttendingGuestCount);
    setAttendingGuestCountInput(String(nextCount));
    setGroupMembers((current) => buildGroupMemberFields(nextCount, current));
    if (nextCount <= 1) {
      setShowGroupMembersForm(false);
    }
  }

  function handleGroupMemberChange(index, value) {
    setGroupMembers((current) => current.map((member, memberIndex) => memberIndex === index ? value : member));
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundOrbLeft} aria-hidden="true" />
      <div style={styles.backgroundOrbRight} aria-hidden="true" />

      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroInner}>
            <p style={styles.brandPill}>Powered by VivahGo</p>
            <p style={styles.kicker}>Wedding RSVP</p>
            <h1 style={styles.heroTitle}>{coupleNames}</h1>
            <p style={styles.heroSummary}>
              A clean invitation experience for {guest.name || "your party"} to confirm attendance in just a moment.
            </p>
            <div style={styles.heroMetaRow}>
              {(wedding.date || plan.date) ? <div style={styles.heroMetaCard}>Date: {wedding.date || plan.date}</div> : null}
              {(wedding.venue || plan.venue) ? <div style={styles.heroMetaCard}>Venue: {wedding.venue || plan.venue}</div> : null}
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionKicker}>Guest Details</p>
              <h2 style={styles.sectionTitle}>Confirm your invitation</h2>
            </div>
          </div>

          <div style={styles.guestSummaryGrid}>
            <div style={styles.guestSummaryCard}>
              <div style={styles.label}>Invited Guest</div>
              <div style={styles.guestName}>{guest.name || "Guest"}</div>
            </div>
            <div style={styles.guestSummaryCard}>
              <div style={styles.label}>Invitation Size</div>
              <div style={styles.guestName}>Up to {invitedGuestCount} guest{invitedGuestCount > 1 ? "s" : ""}</div>
            </div>
          </div>

          {submitted ? (
            <div style={styles.successBox}>
              <div style={styles.successTitle}>Your RSVP has been saved.</div>
              <p style={styles.successText}>
                {selectedRsvp === "yes"
                  ? `Confirmed for ${Math.max(1, Number(data?.guest?.attendingGuestCount) || 1)} guest${Number(data?.guest?.attendingGuestCount) === 1 ? "" : "s"}.`
                  : "Marked as not attending."}
              </p>
              <p style={styles.successHint}>This RSVP link has now expired for security.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.choiceRow}>
                <button
                  type="button"
                  onClick={() => setSelectedRsvp("yes")}
                  style={{ ...styles.choiceButton, ...(selectedRsvp === "yes" ? styles.choiceButtonActive : null) }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRsvp("no")}
                  style={{ ...styles.choiceButton, ...(selectedRsvp === "no" ? styles.choiceButtonDecline : null) }}
                >
                  Decline
                </button>
              </div>

              {selectedRsvp === "yes" ? (
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>How many from your group will attend?</span>
                  <input
                    type="number"
                    min="1"
                    max={String(invitedGuestCount)}
                    value={attendingGuestCountInput}
                    onChange={handleAttendingGuestCountChange}
                    onBlur={handleAttendingGuestCountBlur}
                    style={styles.input}
                    inputMode="numeric"
                  />
                </label>
              ) : null}

              {selectedRsvp === "yes" && resolvedAttendingGuestCount > 1 ? (
                <div style={styles.disclosure}>
                  <button
                    type="button"
                    onClick={() => setShowGroupMembersForm((current) => !current)}
                    aria-expanded={showGroupMembersForm}
                    style={styles.disclosureButton}
                  >
                    <span>{showGroupMembersForm ? "▾" : "▸"}</span>
                    <span>{showGroupMembersForm ? "Hide Names Of Those Attending" : "Add names of those attending"}</span>
                  </button>
                  {showGroupMembersForm ? (
                    <div style={styles.groupMembersList}>
                      {groupMembers.map((member, index) => (
                        <label key={`rsvp-group-member-${index}`} style={styles.field}>
                          <span style={styles.fieldLabel}>Guest {index + 2}</span>
                          <input
                            type="text"
                            value={member}
                            onChange={(event) => handleGroupMemberChange(index, event.target.value)}
                            style={styles.input}
                            placeholder={`Guest ${index + 2} name`}
                          />
                        </label>
                      ))}
                      <p style={styles.helperText}>
                        Add names for the rest of your attending group if you would like them included on this RSVP.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? <p style={styles.error}>{error}</p> : null}

              <button type="submit" disabled={saving} style={styles.submitButton}>
                {saving ? "Saving..." : "Submit RSVP"}
              </button>
            </form>
          )}
        </section>

        {events.length > 0 ? (
          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.sectionKicker}>Wedding Schedule</p>
                <h2 style={styles.sectionTitle}>Shared event details</h2>
              </div>
            </div>

            <div style={styles.eventList}>
              {events.map((event) => (
                <div key={event.id || `${event.name}-${event.date}`} style={styles.eventCard}>
                  <div style={styles.eventName}>{event.emoji ? `${event.emoji} ` : ""}{event.name || "Event"}</div>
                  <div style={styles.eventMeta}>{[event.date, event.time].filter(Boolean).join(" · ") || "Date to be announced"}</div>
                  {event.venue ? <div style={styles.eventMeta}>{event.venue}</div> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer style={styles.footer}>
          <div style={styles.footerBrand}>VivahGo</div>
          <p style={styles.footerText}>Wedding planning, guest management, and event coordination in one clean workspace.</p>
        </footer>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fbf4ea 0%, #f6e9d8 52%, #f1dfca 100%)",
    color: "#2d1a15",
    fontFamily: "'Manrope', sans-serif",
    padding: "24px 16px 48px",
    position: "relative",
    overflow: "hidden",
  },
  backgroundOrbLeft: {
    position: "absolute",
    width: 320,
    height: 320,
    top: -120,
    left: -90,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(246, 215, 122, 0.34) 0%, rgba(246, 215, 122, 0) 72%)",
    pointerEvents: "none",
  },
  backgroundOrbRight: {
    position: "absolute",
    width: 260,
    height: 260,
    right: -60,
    top: 120,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(187, 77, 40, 0.16) 0%, rgba(187, 77, 40, 0) 72%)",
    pointerEvents: "none",
  },
  shell: {
    width: "min(760px, 100%)",
    margin: "0 auto",
    display: "grid",
    gap: 20,
    position: "relative",
    zIndex: 1,
  },
  hero: {
    borderRadius: 32,
    padding: 1,
    background: "linear-gradient(135deg, rgba(246, 215, 122, 0.7) 0%, rgba(125, 37, 18, 0.18) 100%)",
    boxShadow: "0 26px 62px rgba(94, 42, 22, 0.16)",
  },
  heroInner: {
    borderRadius: 31,
    padding: "36px 24px 30px",
    textAlign: "center",
    background: "linear-gradient(160deg, #7d2512 0%, #bb4d28 100%)",
    color: "#fff8f0",
  },
  brandPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    padding: "0 14px",
    margin: 0,
    borderRadius: 999,
    background: "rgba(255, 248, 240, 0.12)",
    border: "1px solid rgba(255, 240, 224, 0.22)",
    color: "#f8e6c1",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  kicker: {
    margin: "16px 0 0",
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    fontSize: 12,
    fontWeight: 800,
    color: "#f6d77a",
  },
  heroTitle: {
    margin: "14px 0 12px",
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
    lineHeight: 1.04,
    color: "inherit",
  },
  heroSummary: {
    margin: "0 auto",
    maxWidth: 560,
    lineHeight: 1.65,
    color: "rgba(255, 248, 240, 0.92)",
    fontSize: 16,
  },
  heroMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  heroMetaCard: {
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255, 248, 240, 0.1)",
    border: "1px solid rgba(255, 240, 224, 0.16)",
    color: "#fff4e8",
    fontSize: 14,
    lineHeight: 1.45,
  },
  card: {
    background: "rgba(255, 250, 244, 0.96)",
    border: "1px solid rgba(87, 50, 38, 0.1)",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 42px rgba(94, 42, 22, 0.07)",
  },
  simpleCard: {
    background: "rgba(255, 250, 244, 0.96)",
    border: "1px solid rgba(87, 50, 38, 0.1)",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 18px 42px rgba(94, 42, 22, 0.07)",
    textAlign: "center",
  },
  emptyTitle: {
    margin: "14px 0 10px",
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(2rem, 4vw, 3rem)",
    lineHeight: 1.08,
    color: "#2d1a15",
  },
  emptyText: {
    margin: 0,
    lineHeight: 1.65,
    color: "#5a3f36",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
    textAlign: "center",
    justifyContent: "center",
  },
  sectionKicker: {
    margin: 0,
    color: "#7d2512",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  sectionTitle: {
    margin: "8px 0 0",
    fontFamily: "'Playfair Display', serif",
    fontSize: 30,
    lineHeight: 1.08,
    color: "#2d1a15",
  },
  guestSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  guestSummaryCard: {
    borderRadius: 20,
    padding: 18,
    background: "#fffdf9",
    border: "1px solid rgba(87, 50, 38, 0.08)",
  },
  label: {
    display: "block",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#7d2512",
    fontWeight: 800,
    marginBottom: 8,
  },
  guestName: {
    fontSize: 19,
    fontWeight: 700,
    color: "#2d1a15",
    lineHeight: 1.35,
  },
  form: {
    display: "grid",
    gap: 18,
  },
  choiceRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  choiceButton: {
    minHeight: 54,
    borderRadius: 18,
    border: "1px solid rgba(87, 50, 38, 0.16)",
    background: "#fff8f0",
    color: "#7d2512",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
  },
  choiceButtonActive: {
    background: "linear-gradient(135deg, #bb4d28 0%, #7d2512 100%)",
    color: "#fff8f0",
    boxShadow: "0 14px 28px rgba(125, 37, 18, 0.2)",
  },
  choiceButtonDecline: {
    background: "rgba(125, 37, 18, 0.06)",
    borderColor: "rgba(125, 37, 18, 0.2)",
    color: "#7d2512",
  },
  field: {
    display: "grid",
    gap: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: "#5a3f36",
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    border: "1px solid rgba(87, 50, 38, 0.14)",
    padding: "0 16px",
    fontSize: 16,
    color: "#2d1a15",
    background: "#fffdf9",
  },
  disclosure: {
    display: "grid",
    gap: 12,
  },
  disclosureButton: {
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#7d2512",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    justifySelf: "flex-start",
  },
  groupMembersList: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    background: "rgba(125, 37, 18, 0.04)",
    border: "1px solid rgba(125, 37, 18, 0.1)",
  },
  helperText: {
    margin: 0,
    color: "#6b4a40",
    fontSize: 13,
    lineHeight: 1.6,
  },
  submitButton: {
    minHeight: 54,
    border: 0,
    borderRadius: 999,
    background: "linear-gradient(135deg, #bb4d28 0%, #7d2512 100%)",
    color: "#fff8f0",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 18px 30px rgba(136, 49, 22, 0.18)",
  },
  successBox: {
    background: "linear-gradient(180deg, rgba(46, 125, 50, 0.08) 0%, rgba(46, 125, 50, 0.04) 100%)",
    border: "1px solid rgba(46, 125, 50, 0.16)",
    color: "#215d27",
    borderRadius: 22,
    padding: 20,
  },
  successTitle: {
    fontWeight: 800,
    marginBottom: 8,
    fontSize: 18,
  },
  successText: {
    margin: 0,
    lineHeight: 1.6,
  },
  successHint: {
    margin: "10px 0 0",
    fontSize: 13,
    color: "#4d7a50",
  },
  error: {
    margin: 0,
    color: "#b3261e",
    fontWeight: 600,
  },
  eventList: {
    display: "grid",
    gap: 12,
  },
  eventCard: {
    borderRadius: 20,
    background: "#fffdf9",
    border: "1px solid rgba(87, 50, 38, 0.08)",
    padding: 16,
  },
  eventName: {
    fontWeight: 800,
    marginBottom: 6,
    color: "#2d1a15",
  },
  eventMeta: {
    color: "#5a3f36",
    lineHeight: 1.5,
  },
  footer: {
    textAlign: "center",
    padding: "4px 8px 0",
  },
  footerBrand: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    color: "#7d2512",
    marginBottom: 6,
  },
  footerText: {
    margin: 0,
    color: "#6b4a40",
    lineHeight: 1.6,
    fontSize: 14,
  },
  centered: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(180deg, #fbf4ea 0%, #f6e9d8 48%, #f1dfca 100%)",
    color: "#2d1a15",
    fontFamily: "'Manrope', sans-serif",
    fontSize: 18,
  },
};
