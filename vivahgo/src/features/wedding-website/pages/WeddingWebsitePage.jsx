import { useEffect, useState } from "react";
import { EVENT_COLORS } from "../../../constants";
import { fetchPublicWeddingWebsite } from "../api.js";
import { readAuthSession } from "../../../authStorage";
import { daysUntil } from "../../../shared/lib/core.js";
import { usePageSeo } from "../../../seo.js";
import { getPlannerUrl } from "../../../siteUrls.js";

const DEMO_PLANNER_STORAGE_KEY = "vivahgo.demoPlanner";
const PLANNER_HOME_URL = getPlannerUrl("/");

function getStoredPlannerData() {
  try {
    const session = readAuthSession();
    if (session?.planner) return session.planner;
    const demo = JSON.parse(localStorage.getItem(DEMO_PLANNER_STORAGE_KEY) || "null");
    if (demo) return demo;
  } catch {
    // ignore
  }
  return null;
}

function getActivePlan(planner) {
  if (!planner) return null;
  const marriages = planner.marriages || [];
  if (!marriages.length) return null;
  const activePlanId = planner.activePlanId || marriages[0]?.id;
  return marriages.find(m => m.id === activePlanId) || marriages[0];
}

function getActiveCollection(planner, key) {
  if (!planner) return [];
  const activePlanId = (planner.marriages || [])[0]
    ? (planner.activePlanId || planner.marriages[0].id)
    : null;
  return (planner[key] || []).filter(item => !activePlanId || item?.planId === activePlanId);
}

const WEBSITE_THEME_STYLES = {
  "royal-maroon": {
    pageBackground: "linear-gradient(160deg, #FFF8E7 0%, #FEFAF0 50%, #F5ECD7 100%)",
    heroBackground: "linear-gradient(160deg, #6B0F0F 0%, #8B1A1A 60%, #A0200A 100%)",
    accent: "#D4AF37",
    accentSoft: "#F5ECD7",
    textMuted: "#8B6060",
  },
  "garden-sage": {
    pageBackground: "linear-gradient(160deg, #F3F7F0 0%, #FBF7EF 52%, #E2EBDD 100%)",
    heroBackground: "linear-gradient(160deg, #3D5A4B 0%, #557A61 55%, #7B9B76 100%)",
    accent: "#D9A441",
    accentSoft: "#E8F0E3",
    textMuted: "#5F6F66",
  },
  "midnight-navy": {
    pageBackground: "linear-gradient(160deg, #F5F7FB 0%, #F9F1EB 50%, #E7ECF5 100%)",
    heroBackground: "linear-gradient(160deg, #132238 0%, #223A57 55%, #34506F 100%)",
    accent: "#E3B261",
    accentSoft: "#E7ECF5",
    textMuted: "#607089",
  },
};

export default function WeddingWebsitePage({ websiteSlug = "" }) {
  const [plannerData, setPlannerData] = useState(() => (websiteSlug ? null : getStoredPlannerData()));
  const [loaded, setLoaded] = useState(() => !websiteSlug);
  const isPublicWebsite = Boolean(websiteSlug);
  const activePlan = isPublicWebsite ? plannerData?.plan || null : getActivePlan(plannerData);
  const wedding = plannerData?.wedding || {};
  const brideName = wedding.bride || activePlan?.bride || "";
  const groomName = wedding.groom || activePlan?.groom || "";
  const weddingDate = wedding.date || activePlan?.date || "";
  const weddingVenue = wedding.venue || activePlan?.venue || "";
  const coupleDisplay = brideName && groomName
    ? `${brideName} & ${groomName}`
    : brideName || groomName || "Our Wedding";
  const seoTitle = !loaded
    ? (isPublicWebsite ? "VivahGo Wedding Website" : "VivahGo Wedding Website Preview")
    : !plannerData
      ? (isPublicWebsite ? "Wedding Website Not Found | VivahGo" : "VivahGo Wedding Website Preview")
      : `${coupleDisplay} | Wedding Website`;
  const seoDescription = !plannerData
    ? "A public wedding website powered by VivahGo."
    : `${coupleDisplay}${weddingDate ? ` are celebrating on ${weddingDate}` : ""}${weddingVenue ? ` at ${weddingVenue}` : ""}. View the schedule and wedding details on VivahGo.`;

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    path: isPublicWebsite ? `/${websiteSlug}` : "/wedding",
    noindex: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadWebsite() {
      if (!websiteSlug) {
        setPlannerData(getStoredPlannerData());
        setLoaded(true);
        return;
      }

      try {
        setLoaded(false);
        const data = await fetchPublicWeddingWebsite(websiteSlug);
        if (!cancelled) {
          setPlannerData(data);
        }
      } catch {
        if (!cancelled) {
          setPlannerData(null);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    loadWebsite();
    return () => {
      cancelled = true;
    };
  }, [websiteSlug]);

  if (!loaded) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (!plannerData) {
    return (
      <div style={styles.page}>
        <div style={styles.emptyHero}>
          <div style={styles.emptyEmoji}>💍</div>
          <h1 style={styles.emptyTitle}>{websiteSlug ? "Wedding Website Not Found" : "Your Wedding Website"}</h1>
          <p style={styles.emptyText}>
            {websiteSlug
              ? "This public wedding page could not be found. Please check the link or ask the couple for the latest website URL."
              : "Open this page from the VivahGo app on your device to preview your wedding website with your events, venues, and schedule."}
          </p>
          <a href={PLANNER_HOME_URL} style={styles.appLink}>Open VivahGo →</a>
        </div>
      </div>
    );
  }

  const websiteSettings = {
    showCountdown: activePlan?.websiteSettings?.showCountdown !== false,
    showCalendar: activePlan?.websiteSettings?.showCalendar !== false,
    theme: activePlan?.websiteSettings?.theme || "royal-maroon",
    heroTagline: activePlan?.websiteSettings?.heroTagline || "You are invited to celebrate",
    welcomeMessage: activePlan?.websiteSettings?.welcomeMessage || "",
    scheduleTitle: activePlan?.websiteSettings?.scheduleTitle || "Wedding Calendar",
  };
  const themeStyles = WEBSITE_THEME_STYLES[websiteSettings.theme] || WEBSITE_THEME_STYLES["royal-maroon"];
  const events = (isPublicWebsite ? plannerData.events || [] : getActiveCollection(plannerData, "events"))
    .filter(e => e?.isPublicWebsiteVisible !== false)
    .filter(e => e.date || e.venue)
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

  const countdownDays = weddingDate ? daysUntil(weddingDate) : null;

  return (
    <div style={{ ...styles.page, background: themeStyles.pageBackground }}>
      {/* Hero */}
      <div style={{ ...styles.hero, background: themeStyles.heroBackground }}>
        <div style={{ ...styles.heroMandala, color: themeStyles.accent }} aria-hidden="true">✿</div>
        <div style={styles.heroInner}>
          <div style={styles.heroLabel}>{websiteSettings.heroTagline}</div>
          <h1 style={styles.heroCouple}>{coupleDisplay}</h1>
          {weddingDate && <div style={styles.heroDate}>📅 {weddingDate}</div>}
          {weddingVenue && <div style={styles.heroVenue}>📍 {weddingVenue}</div>}
          {websiteSettings.welcomeMessage ? (
            <p style={{ ...styles.heroWelcome, borderColor: `${themeStyles.accent}55`, background: "rgba(255,255,255,0.08)" }}>
              {websiteSettings.welcomeMessage}
            </p>
          ) : null}
        </div>
        <div style={styles.heroDivider}>✦ ✦ ✦</div>
      </div>

      {websiteSettings.showCountdown && countdownDays !== null && (
        <div style={styles.countdownWrap}>
          <div style={styles.countdownCard}>
            <div>
              <div style={{ ...styles.countdownKicker, color: themeStyles.textMuted }}>Countdown</div>
              <div style={styles.countdownTitle}>Until the celebration begins</div>
            </div>
            <div style={{ ...styles.countdownValue, color: themeStyles.accent }}>{Math.max(countdownDays, 0)}</div>
            <div style={{ ...styles.countdownDaysLabel, color: themeStyles.textMuted }}>days</div>
          </div>
        </div>
      )}

      {/* Events Calendar */}
      {websiteSettings.showCalendar && (
        <div style={styles.section}>
          <div style={{ ...styles.sectionTitle, color: themeStyles.accent }}>{websiteSettings.scheduleTitle}</div>
          {events.length === 0 ? (
            <div style={styles.emptyEvents}>
              <p>No public events have been shared yet. Check back soon!</p>
            </div>
          ) : (
            <div style={styles.eventList}>
              {events.map((ev, idx) => {
                const colorPair = EVENT_COLORS[ev.colorIdx % EVENT_COLORS.length] || EVENT_COLORS[0];
                return (
                  <div key={ev.id || idx} style={styles.eventCard}>
                    <div style={{...styles.eventColorBar, background: `linear-gradient(180deg, ${colorPair[0]}, ${colorPair[1]})`}}/>
                    <div style={styles.eventBody}>
                      <div style={styles.eventHeader}>
                        <span style={styles.eventEmoji}>{ev.emoji || "✨"}</span>
                        <span style={styles.eventName}>{ev.name}</span>
                        <span style={{...styles.eventStatusBadge, background: ev.status === "confirmed" ? "#E8F5E9" : ev.status === "completed" ? "#EDE7F6" : "#FFF8E1", color: ev.status === "confirmed" ? "#2E7D32" : ev.status === "completed" ? "#4527A0" : "#F57F17"}}>
                          {ev.status === "confirmed" ? "Confirmed" : ev.status === "completed" ? "Completed" : "Upcoming"}
                        </span>
                      </div>
                      {ev.date && (
                        <div style={styles.eventDetail}>
                          <span style={styles.eventDetailIcon}>📅</span>
                          {ev.date}{ev.time ? ` · ${ev.time}` : ""}
                        </div>
                      )}
                      {ev.venue && (
                        <div style={styles.eventDetail}>
                          <span style={styles.eventDetailIcon}>📍</span>
                          {ev.venue}
                        </div>
                      )}
                      {ev.note && (
                        <div style={styles.eventNote}>{ev.note}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <div style={{ ...styles.footerBrand, color: themeStyles.textMuted }}>Created with VivahGo 💍</div>
        <a href={PLANNER_HOME_URL} style={styles.footerLink}>{isPublicWebsite ? "Create your own wedding workspace at VivahGo" : "Plan your wedding with VivahGo Planner"}</a>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #FFF8E7 0%, #FEFAF0 50%, #F5ECD7 100%)",
    fontFamily: "'Jost', 'Segoe UI', sans-serif",
    color: "#2C1010",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    fontSize: 18,
    color: "#8B6060",
  },
  hero: {
    background: "linear-gradient(160deg, #6B0F0F 0%, #8B1A1A 60%, #A0200A 100%)",
    padding: "60px 24px 40px",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
  },
  heroMandala: {
    position: "absolute",
    top: -20,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 200,
    opacity: 0.05,
    color: "#D4AF37",
    lineHeight: 1,
    pointerEvents: "none",
  },
  heroInner: {
    position: "relative",
    zIndex: 1,
  },
  heroWelcome: {
    margin: "18px auto 0",
    maxWidth: 640,
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.3)",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 1.6,
    fontSize: 15,
  },
  heroLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
    fontWeight: 500,
  },
  heroCouple: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "clamp(32px, 8vw, 52px)",
    fontWeight: 700,
    color: "#FFFFFF",
    margin: 0,
    lineHeight: 1.2,
    marginBottom: 20,
  },
  heroDate: {
    fontSize: 16,
    color: "#F0D060",
    fontWeight: 500,
    marginBottom: 8,
  },
  heroVenue: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontWeight: 400,
  },
  heroDivider: {
    marginTop: 32,
    fontSize: 14,
    color: "rgba(212,175,55,0.6)",
    letterSpacing: 6,
  },
  section: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "40px 20px 24px",
  },
  countdownWrap: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "22px 20px 0",
  },
  countdownCard: {
    background: "linear-gradient(135deg, #8B1A1A 0%, #6B0F0F 100%)",
    borderRadius: 22,
    padding: "20px 22px",
    boxShadow: "0 10px 28px rgba(107,15,15,0.16)",
    color: "#FFFFFF",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "center",
  },
  countdownKicker: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.62)",
  },
  countdownTitle: {
    marginTop: 4,
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 30,
    color: "#F0D060",
    lineHeight: 1,
    fontWeight: 700,
  },
  countdownValue: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 56,
    lineHeight: 0.9,
    color: "#F0D060",
    fontWeight: 700,
    gridRow: "1 / span 2",
    alignSelf: "center",
  },
  countdownDaysLabel: {
    gridColumn: 2,
    fontSize: 12,
    color: "rgba(255,255,255,0.68)",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginTop: -8,
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 26,
    fontWeight: 700,
    color: "#8B1A1A",
    textAlign: "center",
    marginBottom: 24,
  },
  eventList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  eventCard: {
    background: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(139,26,26,0.08)",
    border: "1px solid rgba(212,175,55,0.15)",
    display: "flex",
    flexDirection: "row",
  },
  eventColorBar: {
    width: 6,
    flexShrink: 0,
  },
  eventBody: {
    padding: "16px 18px",
    flex: 1,
  },
  eventHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  eventEmoji: {
    fontSize: 22,
  },
  eventName: {
    fontSize: 17,
    fontWeight: 600,
    color: "#2C1010",
    flex: 1,
  },
  eventStatusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 20,
    letterSpacing: 0.3,
  },
  eventDetail: {
    fontSize: 13.5,
    color: "#5C3030",
    marginBottom: 5,
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    lineHeight: 1.4,
  },
  eventDetailIcon: {
    fontSize: 14,
    flexShrink: 0,
    marginTop: 1,
  },
  eventNote: {
    marginTop: 8,
    fontSize: 12.5,
    color: "#8B6060",
    fontStyle: "italic",
    background: "rgba(212,175,55,0.06)",
    padding: "7px 10px",
    borderRadius: 8,
    lineHeight: 1.4,
  },
  emptyEvents: {
    textAlign: "center",
    padding: "32px 20px",
    color: "#8B6060",
    fontSize: 14,
    background: "#FFFFFF",
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.15)",
  },
  footer: {
    textAlign: "center",
    padding: "32px 20px",
    borderTop: "1px solid rgba(212,175,55,0.2)",
    marginTop: 20,
  },
  footerBrand: {
    fontSize: 15,
    fontWeight: 600,
    color: "#8B1A1A",
    marginBottom: 6,
  },
  footerLink: {
    fontSize: 12.5,
    color: "#8B6060",
    textDecoration: "none",
  },
  emptyHero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "80vh",
    padding: "40px 24px",
    textAlign: "center",
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 32,
    fontWeight: 700,
    color: "#8B1A1A",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: "#5C3030",
    maxWidth: 340,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  appLink: {
    display: "inline-block",
    background: "linear-gradient(135deg, #8B1A1A, #6B0F0F)",
    color: "#FFFFFF",
    textDecoration: "none",
    padding: "12px 28px",
    borderRadius: 14,
    fontSize: 15,
    fontWeight: 600,
  },
};
