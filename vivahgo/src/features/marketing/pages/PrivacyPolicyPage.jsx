import { useEffect, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import { readAuthSession } from "../../../authStorage";
import { usePageSeo } from "../../../seo.js";
import { getMarketingUrl } from "../../../siteUrls.js";

export default function PrivacyPolicyPage() {
  const [session, setSession] = useState(() => readAuthSession());
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  usePageSeo({
    title: "VivahGo Privacy Policy",
    description: "Read how VivahGo collects, uses, and protects your information.",
    canonicalUrl: getMarketingUrl("/privacy-policy"),
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
            <h1>Privacy Policy</h1>
            <p>Effective date: April 2, 2026</p>
          </div>

          <div className="legal-content" style={{ maxWidth: 860, margin: "0 auto" }}>
            <div className="legal-section">
              <h2 className="legal-section-title">1. Information We Collect</h2>
              <p className="legal-text">
                We collect information you provide directly, such as account profile details and wedding planning data
                like events, guests, budgets, and vendor entries.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">2. How We Use Information</h2>
              <p className="legal-text">
                We use your information to operate and improve VivahGo, provide requested features, support your account,
                and maintain service reliability and security.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">3. Authentication Data</h2>
              <p className="legal-text">
                If you sign in through Google or another identity provider, we receive basic profile details required for
                login and account management.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">4. Data Sharing</h2>
              <p className="legal-text">
                We do not sell your personal information. We may share data with trusted service providers that help us
                run VivahGo, subject to contractual confidentiality and security obligations.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">5. Data Retention and Security</h2>
              <p className="legal-text">
                We apply reasonable safeguards to protect your data and retain information only for as long as needed to
                provide the service, comply with legal obligations, and resolve disputes.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">6. Your Choices</h2>
              <p className="legal-text">
                You can update planning details inside the app and request account deletion through account settings.
                Deletion requests are processed in accordance with applicable law.
              </p>
            </div>

            <div className="legal-section">
              <h2 className="legal-section-title">7. Changes to This Policy</h2>
              <p className="legal-text">
                We may update this privacy policy periodically. Continued use of VivahGo after updates indicates your
                acceptance of the revised policy.
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
