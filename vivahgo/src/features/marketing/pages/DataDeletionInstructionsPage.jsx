import { useEffect, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import { readAuthSession } from "../../../authStorage";
import { usePageSeo } from "../../../seo.js";
import { getMarketingUrl } from "../../../siteUrls.js";

export default function DataDeletionInstructionsPage() {
  const [session, setSession] = useState(() => readAuthSession());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  usePageSeo({
    title: "VivahGo Data Deletion Instructions",
    description: "Learn how to request deletion of your VivahGo account and associated personal data.",
    canonicalUrl: getMarketingUrl("/data-deletion-instructions"),
  });

  useEffect(() => {
    const syncSession = () => {
      setSession(readAuthSession());
    };

    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

  return (
    <div className="marketing-home-shell">
      <MarketingSiteHeader activePage="home" session={session} onContactUs={() => setShowFeedbackModal(true)} />

      <main className="marketing-main">
        <section className="marketing-section marketing-pricing-page-intro">
          <div className="marketing-section-heading">
            <p className="marketing-section-kicker">Legal</p>
            <h1>Data Deletion Instructions</h1>
            <p>Effective date: April 2, 2026</p>
          </div>

          <div className="legal-content" style={{ maxWidth: 860, margin: "0 auto" }}>
            <div className="legal-section">
              <h2 className="legal-section-title">How to Request Deletion</h2>
              <p className="legal-text">
                You can request deletion of your VivahGo account and related planner data by using the Delete Account
                option inside account settings while signed in.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">In-App Path</h2>
              <p className="legal-text">
                Sign in to VivahGo, open account settings, and choose Delete Account. Confirm the action when prompted.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">What Data Is Deleted</h2>
              <p className="legal-text">
                Deletion removes your account profile and associated wedding planning records connected to your account,
                including weddings, events, budgets, guests, vendors, tasks, and related workspace content.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">Timeline</h2>
              <p className="legal-text">
                We process deletion requests as soon as possible. Some operational backups may take additional time to be
                fully overwritten according to retention and recovery schedules.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">Need Help</h2>
              <p className="legal-text">
                If you cannot access your account, use the Feedback option in the footer and include your registered
                email address so we can help with a verified deletion request.
              </p>
            </div>
          </div>
        </section>
      </main>

      <LegalFooter className="marketing-legal-footer" hasBottomNav={false} onOpenFeedback={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
