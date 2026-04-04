import { useEffect, useState } from "react";
import "../../../styles.css";
import "../../../marketing-home.css";
import FeedbackModal from "../../../components/FeedbackModal";
import LegalFooter from "../../../components/LegalFooter";
import MarketingSiteHeader from "../../../components/MarketingSiteHeader.jsx";
import { readAuthSession } from "../../../authStorage";
import { usePageSeo } from "../../../seo.js";
import { getMarketingUrl } from "../../../siteUrls.js";

const termsSections = [
  {
    title: "1. About VivahGo",
    paragraphs: [
      "VivahGo is a digital wedding planning and wedding services platform intended to assist users with planning and managing wedding-related activities. Depending on the features made available from time to time, VivahGo may offer tools and services including:",
    ],
    bullets: [
      "wedding planning dashboards and workspaces",
      "event, budget, guest, task, and vendor management tools",
      "collaborative planning access for invited users",
      "public wedding website creation and sharing",
      "RSVP collection and guest response tools",
      "vendor registration, vendor profiles, and vendor directory listings",
      "subscription-based premium features",
      "feedback, customer support, and career application features",
    ],
    closing:
      "VivahGo operates as a wedding planning and wedding services platform for Indian weddings. VivahGo may provide digital planning tools and may also offer, coordinate, curate, facilitate, or arrange access to wedding-related services, including venue, photography, catering, decoration, transport, makeup, and related services, either directly or through its vendor network, partner network, or other third-party service providers. The exact nature of VivahGo's role in any service, whether as platform provider, coordinator, aggregator, introducer, or contracting party, will depend on the specific service, package, and transaction.",
  },
  {
    title: "2. Eligibility",
    paragraphs: [
      "You may use VivahGo only if you are legally capable of entering into a binding contract under applicable law. If you are using VivahGo on behalf of another person, family, business, or entity, you represent that you are authorised to do so.",
      "If you are under the age required to enter into a binding contract under applicable law, you may use VivahGo only under the supervision and consent of a parent or legal guardian.",
    ],
  },
  {
    title: "3. Account Registration and Access",
    paragraphs: [
      "To use certain features, you may be required to sign in or create an account, including through third-party authentication providers such as Google.",
      "You agree that:",
    ],
    bullets: [
      "the information you provide will be true, accurate, and current",
      "you will use only an account you are authorized to use",
      "you are responsible for maintaining the confidentiality of your login credentials and device access",
      "you are responsible for all activity that takes place through your account unless caused by our negligence or wilful misconduct",
    ],
    closing:
      "You must notify us promptly if you believe your account has been accessed without authorization.",
  },
  {
    title: "4. Your Use of the Platform",
    paragraphs: [
      "You may use VivahGo only for lawful purposes and in accordance with these Terms. You agree not to:",
    ],
    bullets: [
      "use the platform in any manner that violates applicable law",
      "upload false, misleading, defamatory, infringing, obscene, or unlawful content",
      "impersonate any person or misrepresent your identity or affiliation",
      "interfere with or disrupt the platform, servers, or networks",
      "attempt unauthorized access to accounts, data, or systems",
      "scrape, copy, reverse engineer, or exploit the platform except as permitted by law",
      "use VivahGo to spam guests, vendors, users, or third parties",
      "upload malware, harmful code, or any material intended to damage or impair the platform",
    ],
    closing:
      "We may suspend, restrict, or terminate access where we reasonably believe there has been a breach of these Terms, misuse of the platform, fraud, abuse, security risk, or legal necessity.",
  },
  {
    title: "5. Planner Data and User Content",
    paragraphs: [
      "You may input, upload, store, or share information on VivahGo, including wedding details, event schedules, budgets, guest lists, task lists, notes, images, documents, RSVP responses, and vendor information (\"User Content\").",
      "You retain ownership of your User Content. However, by uploading or using such content on VivahGo, you grant us a non-exclusive, limited, revocable, royalty-free license to host, store, process, reproduce, and display that content solely for the purpose of operating, maintaining, improving, securing, and providing the platform to you.",
      "You are solely responsible for:",
    ],
    bullets: [
      "the legality, accuracy, and completeness of your User Content",
      "obtaining all permissions and consents required for guest data, collaborator access, images, documents, and other uploaded material",
      "verifying important planning information before relying on it for wedding decisions",
    ],
    closing: "We do not guarantee that stored data will always be error-free, complete, or continuously available.",
  },
  {
    title: "6. Guest Information, RSVP Tools, and Public Wedding Pages",
    paragraphs: [
      "VivahGo may allow you to create public wedding pages, RSVP links, and guest-facing pages. You understand and agree that:",
    ],
    bullets: [
      "any content you intentionally publish through public links may be accessible to people who receive or discover those links",
      "you are responsible for deciding what information is made public",
      "you must obtain any permissions or consents required to share names, event details, photos, or related guest information",
      "guest responses submitted through RSVP tools depend on the accuracy of the information and settings maintained by you",
    ],
    closing:
      "VivahGo is not responsible for guest non-response, late response, mistaken response, message delivery issues outside our control, or decisions taken by you based on guest-submitted information.",
  },
  {
    title: "7. Collaborators and Shared Access",
    paragraphs: [
      "VivahGo may permit shared workspace access with roles such as owner, editor, or viewer. If you invite collaborators, you acknowledge that:",
    ],
    bullets: [
      "invited collaborators may view or modify information depending on the permissions granted",
      "you are responsible for selecting appropriate permissions and removing access when necessary",
      "VivahGo is not liable for changes made by collaborators whom you or another authorized user invited into the workspace",
    ],
  },
  {
    title: "8. Vendors, Listings, and Directory",
    paragraphs: [
      "VivahGo may provide vendor-facing features including registration, profile management, media uploads, verification document uploads, and inclusion in a public or semi-public vendor directory.",
    ],
    subSections: [
      {
        title: "For users browsing vendors",
        paragraphs: [
          "Vendor profiles, service descriptions, prices, quotes, availability, ratings, photographs, and claims may be provided by vendors or based on third-party inputs. Such information may change without notice and should be independently verified before making any booking, payment, or commitment.",
          "Vendor listings on VivahGo may be:",
        ],
        bullets: [
          "paid or sponsored",
          "curated or manually reviewed",
          "subject to verification processes",
          "ranked or displayed based on a combination of relevance, user preferences, commercial arrangements, performance metrics, or internal algorithms",
        ],
        closing:
          "While VivahGo may take reasonable steps to review or verify vendors, such review or verification does not constitute a guarantee, certification, or assurance of quality, legality, safety, or performance. VivahGo may enable users to engage vendors either through VivahGo-managed bookings or through direct vendor interactions. Where services are booked through VivahGo-managed flows, VivahGo may play an active role in coordinating, packaging, or facilitating the service. Where users engage vendors independently or outside VivahGo, VivahGo acts only as a discovery or introduction platform and is not responsible for the transaction. The level of VivahGo's involvement may vary depending on the specific service, and will be reflected in the booking flow, proposal, or communication at the time of engagement.",
      },
      {
        title: "For vendors using the platform",
        paragraphs: [
          "If you register or list as a vendor, you represent and warrant that:",
        ],
        bullets: [
          "all information submitted by you is true, accurate, current, and not misleading",
          "you hold all permits, licences, registrations, and approvals required for your business and services",
          "your portfolio content, trademarks, logos, and media do not infringe third-party rights",
          "any verification documents uploaded by you are genuine and lawfully submitted",
        ],
        closing:
          "VivahGo may review, reject, suspend, remove, or moderate vendor profiles, media, documents, or listings at its discretion, including where information appears false, incomplete, non-compliant, harmful, or inappropriate. VivahGo's review or approval of a vendor profile does not amount to a legal certification, guarantee, endorsement, or assurance of service quality.",
      },
    ],
  },
  {
    title: "9. Subscriptions, Pricing, and Payments",
    paragraphs: [
      "Certain features of VivahGo may be offered on a paid subscription or paid-feature basis. Pricing, plan features, billing cycles, and payment terms may be displayed on the platform at the time of purchase.",
      "By purchasing a subscription or paid feature, you agree that:",
    ],
    bullets: [
      "you authorize the applicable payment processor to charge the amount shown at checkout",
      "taxes, levies, and charges may apply as required by law",
      "subscription benefits apply only for the duration and scope stated in the selected plan",
      "promotional offers, coupon codes, or discounts may be subject to additional conditions and may be changed or withdrawn",
    ],
    closing:
      "Unless otherwise expressly stated at the time of purchase or required by applicable law, fees paid are non-refundable. VivahGo may modify pricing, plans, or features prospectively. Any such change will not affect a current paid term already purchased unless clearly disclosed and permitted by applicable law. Payment processing is handled by third-party providers. VivahGo is not responsible for bank failures, payment gateway downtime, settlement delays, or errors caused by third-party payment systems.",
  },
  {
    title: "10. Bookings, Payments, and Transactions",
    paragraphs: [
      "VivahGo may enable users to discover, request, book, or obtain wedding-related services through the platform. Payments for such services may occur either: (a) on-platform, where payment is processed through VivahGo or its authorized payment partners, or (b) off-platform, where payment is made directly between the user and the vendor or service provider.",
    ],
    subSections: [
      {
        title: "On-platform payments",
        paragraphs: ["Where a payment is made through VivahGo:"],
        bullets: [
          "VivahGo may act as an intermediary, facilitator, or service provider depending on the nature of the transaction. The exact role of VivahGo will be reflected in the booking flow, invoice, or service confirmation.",
          "payments are processed through third-party payment gateways",
          "VivahGo may collect, hold, transfer, or settle payments to vendors in accordance with agreed terms",
          "applicable pricing, inclusions, timelines, and deliverables will be as specified at the time of booking or in the relevant proposal or confirmation",
        ],
      },
      {
        title: "Off-platform payments",
        paragraphs: ["Where a user chooses to transact directly with a vendor outside VivahGo:"],
        bullets: [
          "the transaction is solely between the user and the vendor",
          "VivahGo is not a party to such transaction",
          "VivahGo does not control payment terms, refunds, cancellations, or service execution",
        ],
        closing:
          "Users are advised to exercise due diligence before making any off-platform payments. Users are encouraged to keep all bookings and communications within the VivahGo platform where possible, as VivahGo may have limited visibility or ability to assist in disputes arising from off-platform interactions.",
      },
    ],
  },
  {
    title: "11. Refunds and Cancellations",
    paragraphs: [
      "Refunds, cancellations, and rescheduling terms may vary depending on:",
    ],
    bullets: [
      "the type of service",
      "whether the booking was made on-platform or off-platform",
      "vendor-specific policies",
      "timing of cancellation",
    ],
    closing:
      "For on-platform bookings, applicable refund or cancellation terms will be communicated at the time of booking or in the service confirmation. For off-platform bookings, refund and cancellation policies are determined solely by the vendor, and VivahGo is not responsible for enforcing or guaranteeing such terms.",
  },
  {
    title: "12. Trial, Demo, and Beta Features",
    paragraphs: [
      "VivahGo may offer demo mode, trial access, preview tools, or beta features. Such features are provided for testing, evaluation, or early access and may contain errors, limitations, or incomplete functionality. We may modify or remove such features at any time without liability.",
    ],
  },
  {
    title: "13. Third-Party Services",
    paragraphs: [
      "VivahGo may integrate with or rely on third-party services, including authentication providers, cloud hosting, payment processors, analytics providers, storage providers, map providers, communications services, and other tools.",
      "Your use of such third-party services may also be governed by their respective terms and privacy policies. VivahGo is not responsible for the acts, omissions, availability, security, or policies of third-party services.",
    ],
  },
  {
    title: "14. Intellectual Property",
    paragraphs: [
      "All rights, title, and interest in and to VivahGo, including its software, interface, design, trademarks, logos, branding, text, graphics, workflows, and platform content, are owned by or licensed to VivahGo, except for User Content and third-party content.",
      "You receive a limited, non-exclusive, non-transferable, revocable right to access and use the platform for its intended purpose in accordance with these Terms. You may not copy, distribute, modify, create derivative works from, commercially exploit, reverse engineer, or otherwise use VivahGo except as expressly permitted by law or by us in writing.",
    ],
  },
  {
    title: "15. Privacy",
    paragraphs: [
      "Your use of VivahGo is also subject to our Privacy Policy, which explains how we collect, use, store, and disclose personal information. By using the platform, you acknowledge that you have read and understood the Privacy Policy.",
      "Where you upload or input personal data relating to guests, collaborators, vendors, applicants, or other individuals, you are responsible for ensuring that you have the necessary authority, notice, or consent required under applicable law.",
    ],
  },
  {
    title: "16. Data Storage, Availability, and Security",
    paragraphs: [
      "We use reasonable technical and organizational measures to protect platform data. However, no digital system can be guaranteed to be completely secure, uninterrupted, or error-free.",
      "Accordingly:",
    ],
    bullets: [
      "we do not guarantee uninterrupted availability of the platform",
      "we do not guarantee that data loss, corruption, delay, unauthorized access, or service outages will never occur",
      "you should maintain your own copies of critical planning records, contracts, payment proofs, and vendor confirmations",
    ],
  },
  {
    title: "17. Feedback and Suggestions",
    paragraphs: [
      "If you submit suggestions, ideas, reviews, comments, or feedback regarding VivahGo, you grant us a non-exclusive, worldwide, perpetual, irrevocable, royalty-free right to use, modify, adapt, publish, and incorporate such feedback for improving our products and services, without compensation to you.",
    ],
  },
  {
    title: "18. Career Applications and Uploaded Documents",
    paragraphs: [
      "If you submit a job application, resume, portfolio, or related material through VivahGo, you confirm that the information submitted is accurate and lawfully provided. Submission of an application does not create any employment relationship, guarantee an interview, or guarantee employment.",
      "We may retain and review application materials in accordance with our privacy practices and legal obligations.",
    ],
  },
  {
    title: "19. Suspension and Termination",
    paragraphs: [
      "We may suspend or terminate your access to all or part of VivahGo, with or without notice, where reasonably necessary for security, maintenance, legal compliance, abuse prevention, fraud prevention, or breach of these Terms.",
      "You may stop using the platform at any time. Users may request deletion of their account and associated data in accordance with the data deletion process made available on the platform. Certain information may be retained as required for legal, regulatory, fraud prevention, dispute resolution, or operational purposes.",
      "Details of the data deletion process are available at: https://vivahgo.com/data-deletion-instructions",
    ],
  },
  {
    title: "20. Disclaimer of Warranties",
    paragraphs: [
      "To the fullest extent permitted by law, VivahGo is provided on an \"as is\" and \"as available\" basis.",
      "We do not warrant that:",
    ],
    bullets: [
      "the platform will always be available, uninterrupted, secure, or error-free",
      "the platform will meet every requirement or expectation of every user",
      "any vendor, collaborator, guest, or third party will act in accordance with information shown on the platform",
      "any estimates, recommendations, timelines, budgets, analytics, or platform outputs will be accurate, complete, or suitable for your specific needs",
    ],
    closing: "You use the platform at your own discretion and risk.",
  },
  {
    title: "21. Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by applicable law, VivahGo, its founders, officers, employees, affiliates, licensors, and service providers shall not be liable for any indirect, incidental, special, exemplary, punitive, or consequential damages, including loss of profits, loss of data, loss of goodwill, business interruption, wedding disruption, vendor non-performance, guest-related losses, or substitute service costs arising out of or relating to your use of, or inability to use, the platform.",
      "VivahGo shall not be liable for disputes, losses, delays, or service failures arising from off-platform transactions or direct dealings between users and vendors.",
      "To the extent permitted by law, VivahGo's aggregate liability for any claim arising out of or relating to the platform or these Terms shall not exceed the amount actually paid by you to VivahGo for the relevant paid service in the twelve months immediately preceding the event giving rise to the claim, or INR 5,000, whichever is lower.",
      "Nothing in these Terms shall exclude or limit liability that cannot be excluded under applicable law.",
    ],
  },
  {
    title: "22. Indemnity",
    paragraphs: [
      "You agree to indemnify, defend, and hold harmless VivahGo and its affiliates, officers, employees, and service providers from and against claims, losses, liabilities, damages, costs, and expenses, including reasonable legal fees, arising out of or relating to:",
    ],
    bullets: [
      "your misuse of the platform",
      "your User Content",
      "your breach of these Terms",
      "your violation of any law or third-party right",
      "your dealings with vendors, guests, collaborators, or other third parties through or outside the platform",
    ],
  },
  {
    title: "23. Governing Law and Jurisdiction",
    paragraphs: [
      "These Terms shall be governed by and construed in accordance with the laws of India.",
      "Subject to the dispute resolution clause below, the courts at New Delhi, India shall have exclusive jurisdiction over disputes arising out of or in connection with these Terms.",
    ],
  },
  {
    title: "24. Dispute Resolution",
    paragraphs: [
      "In the event of any dispute, controversy, or claim arising out of or relating to these Terms or the use of VivahGo, the parties shall first attempt to resolve the matter amicably through good-faith discussions.",
      "If the dispute is not resolved within 30 days of written notice, VivahGo may require the dispute to be referred to arbitration in accordance with the Arbitration and Conciliation Act, 1996. The seat and venue of arbitration shall be New Delhi, India. The arbitration shall be conducted by a sole arbitrator appointed in accordance with applicable law. The proceedings shall be conducted in English.",
      "Nothing in this clause prevents either party from seeking interim or injunctive relief from a court of competent jurisdiction.",
    ],
  },
  {
    title: "25. Changes to These Terms",
    paragraphs: [
      "We may update these Terms from time to time. Updated Terms will be posted on the platform with a revised effective date. Your continued use of VivahGo after such update constitutes your acceptance of the revised Terms, to the extent permitted by law.",
      "If a change materially affects your rights or obligations, we may provide additional notice where appropriate.",
    ],
  },
  {
    title: "26. Severability",
    paragraphs: [
      "If any provision of these Terms is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect.",
    ],
  },
  {
    title: "27. Waiver",
    paragraphs: [
      "Any failure or delay by VivahGo in enforcing any provision of these Terms shall not operate as a waiver of that provision or any other provision.",
    ],
  },
  {
    title: "28. Contact and Grievance",
    paragraphs: [
      "For questions, concerns, legal notices, or grievances relating to these Terms or the platform, you may contact:",
      "VivahGo Planners (operating as VivahGo)",
      "Email: support@vivahgo.com",
      "Address: 79, West Mukherjee Nagar, Kingsway Camp, New Delhi - 110009",
      "Grievance Officer: Nikhil Mundhra",
      "Email: grievance@vivahgo.com",
    ],
  },
];

function TermsSection({ section }) {
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
            <p>Effective date: April 2, 2026</p>
          </div>

          <div className="legal-content" style={{ maxWidth: 860, margin: "0 auto" }}>
            <p className="legal-text">
              These Terms and Conditions ("Terms") govern your access to and use of the website, mobile application,
              and related services made available by VivahGo Planners (operating under the brand name "VivahGo")
              ("VivahGo", "we", "us", or "our").
            </p>
            <p className="legal-text">
              By accessing or using VivahGo, you agree to be bound by these Terms. If you do not agree, please do not
              use the platform.
            </p>

            {termsSections.map((section) => (
              <TermsSection key={section.title} section={section} />
            ))}
          </div>
        </section>
      </main>

      <LegalFooter className="marketing-legal-footer" hasBottomNav={false} onOpenFeedback={() => setShowFeedbackModal(true)} />
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
