import { useEffect, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import { readAuthSession } from "../../../authStorage";
import { usePageSeo } from "../../../seo.js";
import { getMarketingUrl } from "../../../siteUrls.js";

const privacySections = [
  {
    title: "1. Scope",
    paragraphs: [
      "This Privacy Policy applies to personal information collected through VivahGo's website, mobile application, wedding planning tools, public wedding website features, RSVP tools, vendor platform, subscriptions, customer support, feedback forms, and career application pages.",
    ],
  },
  {
    title: "2. Information We Collect",
    paragraphs: [
      "We may collect the following categories of information:",
    ],
    subSections: [
      {
        title: "a. Information you provide directly",
        paragraphs: [
          "Information you submit when using VivahGo, including:",
        ],
        bullets: [
          "name, email address, phone number, and profile information",
          "login and account details",
          "wedding planning information, including dates, events, budgets, tasks, guest lists, notes, vendor preferences, and related planner content",
          "content submitted to public wedding pages or RSVP flows",
          "communications with us, including support requests, feedback, and grievance submissions",
          "billing or transaction-related details you provide during paid subscriptions or service bookings",
          "vendor registration details, business details, portfolio information, verification documents, and contact details",
          "job application details, resume, portfolio, and related career submission materials",
        ],
      },
      {
        title: "b. Information received through authentication providers",
        paragraphs: [
          "If you sign in through Google or another third-party identity provider, we may receive basic account information such as your name, email address, profile image, and authentication identifiers needed to create, verify, and manage your account.",
        ],
      },
      {
        title: "c. Information collected automatically",
        paragraphs: [
          "When you use VivahGo, we may automatically collect certain technical and usage information, such as:",
        ],
        bullets: [
          "IP address",
          "browser type, device type, operating system, and app version",
          "pages viewed, features used, clicks, session events, and approximate usage patterns",
          "referring URLs and general diagnostic information",
          "cookies, local storage data, and similar technologies used for authentication, preferences, analytics, and security",
        ],
      },
      {
        title: "d. Information relating to guests, collaborators, and third parties",
        paragraphs: [
          "You may provide us with personal information relating to other individuals, such as guests, collaborators, vendors, or family members. This may include names, contact information, RSVP responses, event-related details, and similar information.",
          "You are responsible for ensuring that you have the authority, notice, or consent required to share such information with us.",
        ],
      },
    ],
  },
  {
    title: "3. How We Use Information",
    paragraphs: [
      "We may use personal information for the following purposes:",
    ],
    bullets: [
      "to create, maintain, and secure user accounts",
      "to provide wedding planning tools, dashboards, collaboration features, public wedding pages, and RSVP tools",
      "to operate vendor onboarding, vendor listings, vendor communication, and related marketplace features",
      "to process subscriptions, bookings, quotes, and payment-related workflows",
      "to communicate with you regarding your account, bookings, support matters, updates, reminders, and service-related notices",
      "to personalize and improve the platform, user experience, and feature offerings",
      "to detect, prevent, investigate, and respond to fraud, abuse, misuse, security incidents, or unlawful conduct",
      "to maintain backups, logs, and technical records needed for platform operations",
      "to comply with legal obligations, regulatory requests, dispute handling, and enforcement of our terms",
      "to evaluate job applications and manage recruitment processes",
      "to analyze product performance, usage trends, and service reliability",
    ],
  },
  {
    title: "4. Legal Basis and Permission to Process",
    paragraphs: [
      "By using VivahGo and submitting information through the platform, you consent to the collection and processing of your information for the purposes described in this Privacy Policy, subject to applicable law.",
      "Where relevant, we may also process information where necessary for:",
    ],
    bullets: [
      "performance of a contract or requested service",
      "compliance with legal obligations",
      "fraud prevention, security, and platform integrity",
      "legitimate business and operational purposes, to the extent permitted by law",
    ],
  },
  {
    title: "5. Cookies and Similar Technologies",
    paragraphs: [
      "We may use cookies, SDKs, local storage, and similar technologies to:",
    ],
    bullets: [
      "keep you signed in",
      "remember preferences and settings",
      "maintain session integrity",
      "understand usage and improve platform performance",
      "support analytics and diagnostics",
      "enhance security and fraud prevention",
    ],
    closing:
      "You may be able to control certain cookie settings through your browser or device settings. However, disabling some technologies may affect platform functionality.",
  },
  {
    title: "6. How We Share Information",
    paragraphs: [
      "We do not sell your personal information.",
      "We may share personal information in the following circumstances:",
    ],
    subSections: [
      {
        title: "a. Service providers",
        paragraphs: [
          "We may share information with trusted third-party service providers who help us operate the platform, including providers of:",
        ],
        bullets: [
          "cloud hosting and infrastructure",
          "database and storage services",
          "authentication",
          "payment processing",
          "analytics and diagnostics",
          "communications and email delivery",
          "customer support tools",
          "document and media storage",
        ],
        closing:
          "Such providers are permitted to use the information only as necessary to provide services to us, subject to contractual and operational safeguards.",
      },
    ],
  },
  {
    title: "7. What Data Is Visible Publicly",
    paragraphs: [
      "VivahGo may allow users to create public-facing wedding websites and vendor profiles. Information made available through these features may be visible to invited guests, platform users, search engines, or members of the public, depending on the feature settings and how the content is shared.",
    ],
    subSections: [
      {
        title: "Wedding Websites",
        paragraphs: [
          "Wedding websites on VivahGo are customizable. Any information that a user chooses to publish or display on a wedding website is shared voluntarily by that user.",
          "This may include, depending on the user's choices:",
        ],
        bullets: [
          "names",
          "event details",
          "dates and timings",
          "venue names and locations",
          "descriptions and messages",
          "photographs, videos, and other media",
          "schedules, calendars, and itinerary information",
          "RSVP-related information made visible by the website owner",
        ],
        closing:
          "Users are solely responsible for deciding what content to make public on their wedding website and should exercise care before publishing personal, sensitive, or location-based information.",
      },
      {
        title: "a. Vendor Profiles and Vendor Content",
        paragraphs: [
          "Information and media uploaded by vendors for the purpose of creating or maintaining their public-facing vendor presence may be publicly visible on VivahGo.",
          "This may include:",
        ],
        bullets: [
          "business or brand name",
          "service categories",
          "service descriptions",
          "business contact details, where enabled",
          "city, service areas, and related business information",
          "portfolio images, videos, and promotional media",
          "pricing, packages, offers, and availability information, where provided",
          "other profile information intended for public listing or promotion",
        ],
        closing:
          "Unless expressly stated otherwise, vendor-submitted content intended for profile display, listing, discovery, or promotion will be treated as public.",
      },
      {
        title: "b. Non-Public Documents and Sensitive Materials",
        paragraphs: [
          "Certain materials submitted to VivahGo are not intended for public display and will not be displayed publicly unless expressly stated otherwise.",
          "This may include:",
        ],
        bullets: [
          "identity cards",
          "verification documents",
          "compliance documents",
          "private account records",
          "internal moderation or verification materials",
        ],
        closing:
          "Users and vendors should ensure that they upload sensitive documents only through designated non-public submission flows where such documents are specifically requested.",
      },
      {
        title: "c. Vendors, partners, and service fulfilment",
        paragraphs: [
          "Where you request, book, inquire about, or engage wedding-related services through VivahGo, we may share relevant information with vendors, partners, or service providers to facilitate communication, proposals, bookings, fulfilment, support, payment handling, or dispute assistance.",
        ],
      },
      {
        title: "d. Public and invited sharing",
        paragraphs: [
          "If you use public wedding pages, RSVP links, or collaboration features, information you choose to publish or share may be visible to invited guests, collaborators, vendors, or members of the public with access to the relevant link or page.",
        ],
      },
      {
        title: "e. Legal and compliance reasons",
        paragraphs: [
          "We may disclose information where required to do so by law or where reasonably necessary to:",
        ],
        bullets: [
          "comply with legal process, court orders, or regulatory requests",
          "enforce our terms and policies",
          "protect our rights, users, systems, or operations",
          "investigate fraud, security incidents, or misuse",
          "pursue or defend legal claims",
        ],
      },
      {
        title: "f. Business transfers",
        paragraphs: [
          "If VivahGo is involved in a merger, acquisition, investment transaction, reorganization, asset sale, or similar corporate transaction, personal information may be transferred as part of that process, subject to applicable law.",
        ],
      },
    ],
  },
  {
    title: "8. Payments and Financial Data",
    paragraphs: [
      "Payments on VivahGo may be processed through third-party payment gateways or payment service providers. We do not store full card details unless expressly stated otherwise.",
      "We may receive and retain limited transaction information, such as:",
    ],
    bullets: [
      "payer name",
      "billing contact details",
      "payment status",
      "amount paid",
      "order or transaction identifiers",
      "subscription and invoice records",
    ],
    closing:
      "Off-platform payments made directly to vendors are governed primarily by the arrangements between you and the relevant vendor, though VivahGo may retain limited records where such transactions are linked to platform activity, support, dispute resolution, compliance, or commission tracking.",
  },
  {
    title: "9. Vendor and Verification Information",
    paragraphs: [
      "If you register as a vendor, we may collect business and verification information, including business name, services offered, contact details, portfolio content, identity or business proof, and other verification documents.",
      "We may use this information to:",
    ],
    bullets: [
      "create and manage your vendor profile",
      "review eligibility or verification status",
      "moderate or curate vendor listings",
      "investigate complaints or disputes",
      "comply with legal, operational, and fraud-prevention requirements",
    ],
    closing:
      "Verification or review by VivahGo does not guarantee vendor quality or future performance.",
  },
  {
    title: "10. Data Retention",
    paragraphs: [
      "We retain personal information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including to:",
    ],
    bullets: [
      "provide the services",
      "maintain account history and platform operations",
      "comply with legal, tax, accounting, and regulatory obligations",
      "resolve disputes",
      "enforce agreements",
      "prevent fraud and misuse",
      "maintain security and backup records",
    ],
    closing:
      "Retention periods may vary depending on the type of information and the purpose for which it was collected.",
  },
  {
    title: "11. Account Deletion and Your Choices",
    paragraphs: [
      "You may access, update, or modify certain information through your account or platform settings.",
      "You may also request deletion of your account and associated data in accordance with VivahGo's account deletion process. VivahGo provides account deletion instructions at:",
      "https://vivahgo.com/data-deletion-instructions",
      "Please note that even after a deletion request, we may retain certain information where necessary for:",
    ],
    bullets: [
      "legal or regulatory compliance",
      "tax or accounting requirements",
      "fraud prevention and security",
      "dispute resolution",
      "enforcement of agreements",
      "backup restoration cycles and operational integrity",
    ],
  },
  {
    title: "12. Data Security",
    paragraphs: [
      "We use reasonable technical, administrative, and organizational safeguards designed to protect personal information against unauthorized access, disclosure, alteration, misuse, or destruction.",
      "However, no internet-based service or storage system can be guaranteed to be completely secure. You use the platform at your own risk, and you should also take steps to protect your devices, login credentials, and records.",
    ],
  },
  {
    title: "13. Children's Privacy",
    paragraphs: [
      "VivahGo is not intended for use by children who are not legally capable of entering into a binding arrangement under applicable law without parental or guardian supervision. We do not knowingly collect personal information from children in violation of applicable law.",
      "If you believe that personal information of a child has been provided to us improperly, please contact us so that we can review and take appropriate action.",
    ],
  },
  {
    title: "14. Third-Party Links and Services",
    paragraphs: [
      "VivahGo may contain links to third-party websites, services, social logins, payment systems, maps, or partner tools. Our Privacy Policy does not apply to the privacy practices of such third parties. We encourage you to review their privacy policies before sharing information with them.",
    ],
  },
  {
    title: "15. International and Cross-Service Processing",
    paragraphs: [
      "Your information may be processed and stored using third-party service providers and infrastructure that may operate in different jurisdictions. By using VivahGo, you acknowledge that information may be transferred to and processed in locations where our service providers operate, subject to reasonable contractual and operational safeguards.",
    ],
  },
  {
    title: "16. Changes to This Privacy Policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. The updated version will be posted on the platform with a revised effective date. Your continued use of VivahGo after such update will constitute your acceptance of the revised Privacy Policy, to the extent permitted by law.",
      "Where required or appropriate, we may provide additional notice of material changes.",
    ],
  },
  {
    title: "17. Contact and Grievance",
    paragraphs: [
      "If you have questions, concerns, requests, or grievances regarding this Privacy Policy or the way your information is handled, you may contact:",
      "VivahGo Planners (operating as VivahGo)",
      "Email: support@vivahgo.com",
      "Address: 79, West Mukherjee Nagar, Kingsway Camp, New Delhi - 110009",
      "Grievance Officer: Nikhil Mundhra",
      "Email: grievance@vivahgo.com",
      "The Grievance Officer shall acknowledge complaints within 48 hours and endeavour to resolve them within 30 days, in accordance with applicable law.",
    ],
  },
];

function PrivacySection({ section }) {
  return (
    <div className="legal-section">
      <h2 className="legal-section-title">{section.title}</h2>
      {section.paragraphs?.map((paragraph) => (
        <p className="legal-text" key={paragraph}>
          {paragraph}
        </p>
      ))}
      {section.bullets ? (
        <ul className="legal-text" style={{ paddingLeft: 20, margin: "0 0 1rem" }}>
          {section.bullets.map((item) => (
            <li key={item} style={{ marginBottom: 8 }}>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {section.closing ? <p className="legal-text">{section.closing}</p> : null}
      {section.subSections?.map((subSection) => (
        <div className="legal-section" key={subSection.title} style={{ marginTop: 20 }}>
          <h3 className="legal-section-title">{subSection.title}</h3>
          {subSection.paragraphs?.map((paragraph) => (
            <p className="legal-text" key={paragraph}>
              {paragraph}
            </p>
          ))}
          {subSection.bullets ? (
            <ul className="legal-text" style={{ paddingLeft: 20, margin: "0 0 1rem" }}>
              {subSection.bullets.map((item) => (
                <li key={item} style={{ marginBottom: 8 }}>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          {subSection.closing ? <p className="legal-text">{subSection.closing}</p> : null}
        </div>
      ))}
    </div>
  );
}

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
            <p className="legal-text">
              This Privacy Policy explains how VivahGo Planners (operating under the brand name "VivahGo")
              ("VivahGo", "we", "us", or "our") collects, uses, stores, shares, and protects your personal
              information when you access or use our website, mobile application, and related services.
            </p>
            <p className="legal-text">
              By using VivahGo, you agree to the collection and use of information in accordance with this Privacy
              Policy.
            </p>

            {privacySections.map((section) => (
              <PrivacySection key={section.title} section={section} />
            ))}
          </div>
        </section>
      </main>

      <LegalFooter className="marketing-legal-footer" hasBottomNav={false} onOpenFeedback={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
