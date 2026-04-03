import { formatVendorBudgetRange, getVendorPriceLevel } from '../lib/vendorFormatting.js';

function buildLockedLeads(vendor) {
  const city = vendor?.city || 'your city';
  const type = vendor?.type || 'vendor';

  return [
    {
      id: 'lead_1',
      couple: 'Rhea & Kunal',
      event: 'February wedding',
      location: city,
      request: `Looking for a premium ${type.toLowerCase()} with strong reviews.`,
      contact: 'rhea*****@gmail.com • +91 98*** ***21',
    },
    {
      id: 'lead_2',
      couple: 'Aarav & Meera',
      event: 'Sangeet celebration',
      location: city,
      request: `Need shortlist options and pricing clarity for ${type.toLowerCase()} services.`,
      contact: 'aarav*****@outlook.com • +91 90*** ***44',
    },
    {
      id: 'lead_3',
      couple: 'Mitali & Dev',
      event: 'Destination function',
      location: city,
      request: `Comparing portfolios before booking a ${type.toLowerCase()} team.`,
      contact: 'mitali*****@gmail.com • +91 88*** ***13',
    },
  ];
}

function buildPortfolioTasks(vendor) {
  const tasks = [];
  const mediaCount = Array.isArray(vendor?.media) ? vendor.media.filter(item => item?.isVisible !== false).length : 0;

  if (!vendor?.description?.trim()) {
    tasks.push('Add a strong business description so couples understand your style quickly.');
  }
  if (!vendor?.subType?.trim()) {
    tasks.push('Choose a subcategory to improve how you appear in vendor filters.');
  }
  if (!vendor?.googleMapsLink?.trim()) {
    tasks.push('Add your primary Google Maps link so your service location feels trustworthy.');
  }
  if (!Array.isArray(vendor?.coverageAreas) || vendor.coverageAreas.length === 0) {
    tasks.push('Add extra coverage areas if you serve more than one city.');
  }
  if (mediaCount === 0) {
    tasks.push('Upload portfolio media so your listing can stand out in the directory.');
  } else if (mediaCount < 4) {
    tasks.push('Add at least 4 visible portfolio items to make your profile feel complete.');
  }
  if (!vendor?.phone?.trim() && !vendor?.website?.trim()) {
    tasks.push('Add a contact method like phone or website so interested couples can trust the listing.');
  }

  if (tasks.length === 0) {
    tasks.push('Your portfolio looks strong. Refresh media regularly to keep the listing current.');
  }

  return tasks.slice(0, 4);
}

function getCompletionScore(vendor) {
  const checks = [
    Boolean(vendor?.businessName?.trim()),
    Boolean(vendor?.type?.trim()),
    Boolean(vendor?.subType?.trim()),
    Boolean(vendor?.description?.trim()),
    Boolean(vendor?.city?.trim()),
    Boolean(vendor?.googleMapsLink?.trim()),
    Boolean(vendor?.phone?.trim() || vendor?.website?.trim()),
    Boolean(Array.isArray(vendor?.coverageAreas) && vendor.coverageAreas.length > 0),
    Boolean(Array.isArray(vendor?.media) && vendor.media.some(item => item?.isVisible !== false)),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export default function VendorPortalDashboard({ vendor }) {
  const visibleMedia = Array.isArray(vendor?.media) ? vendor.media.filter(item => item?.isVisible !== false) : [];
  const completionScore = getCompletionScore(vendor);
  const lockedLeads = buildLockedLeads(vendor);
  const tasks = buildPortfolioTasks(vendor);
  const priceLevel = getVendorPriceLevel(vendor);

  const analytics = [
    {
      label: 'Profile completion',
      value: `${completionScore}%`,
      sub: completionScore >= 80 ? 'Looking strong' : 'More detail will help conversions',
    },
    {
      label: 'Portfolio items',
      value: String(visibleMedia.length),
      sub: visibleMedia.length ? 'Shown in live preview' : 'Nothing published yet',
    },
    {
      label: 'Price tier',
      value: '₹'.repeat(priceLevel),
      sub: formatVendorBudgetRange(vendor) || 'Price range missing',
    },
    {
      label: 'Locked leads',
      value: String(lockedLeads.length),
      sub: 'Frontend preview data',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="vendor-portal-hero-card">
        <div>
          <div className="vendor-portal-eyebrow">Vendor Dashboard</div>
          <h2 className="vendor-portal-hero-title">Your portfolio command center</h2>
          <p className="vendor-portal-hero-copy">
            Track how complete your listing looks, review incoming lead previews, and finish the next tasks that improve visibility.
          </p>
        </div>
      </div>

      <div className="vendor-portal-analytics-grid">
        {analytics.map(item => (
          <div key={item.label} className="vendor-portal-analytics-card">
            <div className="vendor-portal-analytics-label">{item.label}</div>
            <div className="vendor-portal-analytics-value">{item.value}</div>
            <div className="vendor-portal-analytics-sub">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="vendor-portal-dashboard-grid">
        <div className="vendor-portal-panel">
          <div className="vendor-portal-panel-head">
            <div>
              <div className="vendor-portal-panel-title">Potential Leads</div>
              <div className="vendor-portal-panel-copy">Enquiries for you</div>
            </div>
            <div className="vendor-portal-lock-badge">Locked</div>
          </div>
          <div className="vendor-portal-stack">
            {lockedLeads.map(lead => (
              <div key={lead.id} className="vendor-portal-lead-card">
                <div className="vendor-portal-lead-top">
                  <div>
                    <div className="vendor-portal-lead-name">{lead.couple}</div>
                    <div className="vendor-portal-lead-meta">{lead.event} · {lead.location}</div>
                  </div>
                  <div className="vendor-portal-lead-status">Lead</div>
                </div>
                <div className="vendor-portal-lead-request">{lead.request}</div>
                <div className="vendor-portal-lead-contact">{lead.contact}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="vendor-portal-panel">
          <div className="vendor-portal-panel-head">
            <div>
              <div className="vendor-portal-panel-title">Next Tasks</div>
              <div className="vendor-portal-panel-copy">Complete these to strengthen the directory listing.</div>
            </div>
          </div>
          <div className="vendor-portal-stack">
            {tasks.map(task => (
              <div key={task} className="vendor-portal-task-card">
                <div className="vendor-portal-task-dot" />
                <div className="vendor-portal-task-copy">{task}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
