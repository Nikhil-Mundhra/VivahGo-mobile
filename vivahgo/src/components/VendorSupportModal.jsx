import { useMemo, useState } from 'react';

const WHATSAPP_SUPPORT_NUMBER = '918383874103';

const COMMON_CONCERNS = [
  { value: 'profile-update', label: 'Profile update issue' },
  { value: 'availability-help', label: 'Availability / calendar help' },
  { value: 'media-upload', label: 'Media upload problem' },
  { value: 'approval-status', label: 'Approval status question' },
  { value: 'account-access', label: 'Account access / login issue' },
  { value: 'billing', label: 'Billing or subscription question' },
  { value: 'other', label: 'Other' },
];

function buildWhatsappUrl(message) {
  return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`;
}

export default function VendorSupportModal({ session, vendor, onClose }) {
  const [form, setForm] = useState({
    concern: COMMON_CONCERNS[0].value,
    details: '',
  });
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const vendorName = vendor?.businessName || 'Not provided';
  const vendorCategory = [vendor?.type, vendor?.subType].filter(Boolean).join(' / ') || 'Not provided';
  const vendorLocation = [vendor?.city, vendor?.state, vendor?.country].filter(Boolean).join(', ') || 'Not provided';
  const userName = session?.user?.name || [session?.user?.given_name, session?.user?.family_name].filter(Boolean).join(' ') || 'Not provided';
  const userEmail = session?.user?.email || 'Not provided';
  const concernLabel = useMemo(
    () => COMMON_CONCERNS.find((item) => item.value === form.concern)?.label || 'Other',
    [form.concern]
  );

  function handleChange(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) {
      setError('');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.details.trim()) {
      setError('Please share a few details about the concern.');
      return;
    }

    const message = [
      '*VivahGo Vendor Support Request*',
      '',
      `*Concern:* ${concernLabel}`,
      `*Vendor:* ${vendorName}`,
      `*Category:* ${vendorCategory}`,
      `*Location:* ${vendorLocation}`,
      `*Contact Name:* ${userName}`,
      `*Email:* ${userEmail}`,
      '',
      '*Details:*',
      form.details.trim(),
    ].join('\n');

    const nextUrl = buildWhatsappUrl(message);
    setWhatsappUrl(nextUrl);
    window.open(nextUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal legal-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Contact Support</div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <div className="input-label">Common concern</div>
            <select
              className="input-field"
              value={form.concern}
              onChange={(event) => handleChange('concern', event.target.value)}
            >
              {COMMON_CONCERNS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <div className="input-label">What’s going on?</div>
            <textarea
              className="input-field feedback-textarea"
              value={form.details}
              onChange={(event) => handleChange('details', event.target.value)}
              placeholder="Tell support what happened, what you expected, and anything urgent."
            />
          </div>

          {error && <div className="feedback-error">{error}</div>}

          {whatsappUrl && (
            <div className="feedback-success">
              WhatsApp link ready:{' '}
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="text-rose-700 underline">
                Open support chat
              </a>
            </div>
          )}

          <button className="btn-primary" type="submit">
            Send via WhatsApp
          </button>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
