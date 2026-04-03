import { useEffect, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import { readAuthSession } from "../../../authStorage";
import { usePageSeo } from "../../../seo.js";
import { getMarketingUrl } from "../../../siteUrls.js";

export default function TermsPage() {
  const [session, setSession] = useState(() => readAuthSession());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  usePageSeo({
    title: "VivahGo Terms and Conditions",
    description: "Read the terms and conditions for using VivahGo.",
    canonicalUrl: getMarketingUrl("/terms"),
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
            <h1>Terms and Conditions</h1>
            <p>Effective date: March 22, 2026</p>
          </div>

          <div className="legal-content" style={{ maxWidth: 860, margin: "0 auto" }}>
            <div className="legal-section">
              <h2 className="legal-section-title">1. Using VivahGo</h2>
              <p className="legal-text">
                You may use VivahGo for personal wedding planning purposes. You are responsible for the accuracy of
                information you enter, including events, guests, budgets, and vendor details.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">2. Account Access</h2>
              <p className="legal-text">
                If you sign in with Google, you agree to use an account you are authorized to access. Keep your device
                and account secure to protect your planner information.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">3. Data and Backups</h2>
              <p className="legal-text">
                We try to keep your planning data available and accurate, but we cannot guarantee uninterrupted service
                or perfect backup behavior in all circumstances.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">4. Vendor and Cost Information</h2>
              <p className="legal-text">
                Vendor listings, prices, and estimates in the app may change and should be independently verified before
                making bookings or payments.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">5. Limitation of Liability</h2>
              <p className="legal-text">
                VivahGo is provided on an as-is basis. To the maximum extent allowed by law, VivahGo is not liable for
                indirect or consequential losses related to app use.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">6. Updates to Terms</h2>
              <p className="legal-text">
                We may update these terms over time. Continued use of the app after updates means you accept the revised
                terms.
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
