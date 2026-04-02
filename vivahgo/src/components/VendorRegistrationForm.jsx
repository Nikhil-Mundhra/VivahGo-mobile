import { useEffect, useState } from 'react';
import { registerVendor } from '../api';
import { BUNDLED_SERVICE_OPTIONS, VENDOR_SUBTYPE_OPTIONS, VENDOR_TYPES } from '../constants';
import { formatCoverageLocation, getLocationCities, getLocationCountries, getLocationStates } from '../locationOptions';

const REGISTRATION_VENDOR_TYPES = VENDOR_TYPES.filter(type => type !== 'All');
const VENDOR_SUPPORT_WHATSAPP_NUMBER = '918383874103';
const VENDOR_REGISTRATION_DRAFT_KEY = 'vivahgo.vendorRegistrationDraft';
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 150000001;
const BUDGET_STEP = 10000;
const MID_BUDGET_THRESHOLD = 200000;
const MID_BUDGET_STEP = 20000;
const HIGH_BUDGET_THRESHOLD = 500000;
const HIGH_BUDGET_STEP = 50000;
const LARGE_BUDGET_THRESHOLD = 1500000;
const LARGE_BUDGET_STEP = 100000;
const XL_BUDGET_THRESHOLD = 5000000;
const XL_BUDGET_STEP = 500000;
const XXL_BUDGET_THRESHOLD = 10000000;
const XXL_BUDGET_STEP = 1000000;
const ULTRA_BUDGET_THRESHOLD = 20000000;
const ULTRA_BUDGET_STEP = 5000000;
const MEGA_BUDGET_THRESHOLD = 60000000;
const MEGA_BUDGET_STEP = 10000000;
const INITIAL_FORM = {
  businessName: '',
  type: REGISTRATION_VENDOR_TYPES[0],
  subType: '',
  bundledServices: [],
  country: '',
  state: '',
  description: '',
  city: '',
  googleMapsLink: '',
  coverageAreas: [],
  phone: '',
  website: '',
  budgetRange: {
    min: 100000,
    max: 300000,
  },
};

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function clampBudgetValue(rawValue) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.min(MAX_BUDGET_LIMIT, Math.max(MIN_BUDGET_LIMIT, Math.round(numericValue)));
}

function buildBudgetSliderPoints() {
  const values = [];

  for (let value = MIN_BUDGET_LIMIT; value <= MID_BUDGET_THRESHOLD; value += BUDGET_STEP) {
    values.push(value);
  }
  for (let value = MID_BUDGET_THRESHOLD + MID_BUDGET_STEP; value <= HIGH_BUDGET_THRESHOLD; value += MID_BUDGET_STEP) {
    values.push(value);
  }
  for (let value = HIGH_BUDGET_THRESHOLD + HIGH_BUDGET_STEP; value <= LARGE_BUDGET_THRESHOLD; value += HIGH_BUDGET_STEP) {
    values.push(value);
  }
  for (let value = LARGE_BUDGET_THRESHOLD + LARGE_BUDGET_STEP; value <= XL_BUDGET_THRESHOLD; value += LARGE_BUDGET_STEP) {
    values.push(value);
  }
  for (let value = XL_BUDGET_THRESHOLD + XL_BUDGET_STEP; value <= XXL_BUDGET_THRESHOLD; value += XL_BUDGET_STEP) {
    values.push(value);
  }
  for (let value = XXL_BUDGET_THRESHOLD + XXL_BUDGET_STEP; value <= ULTRA_BUDGET_THRESHOLD; value += XXL_BUDGET_STEP) {
    values.push(value);
  }
  for (let value = ULTRA_BUDGET_THRESHOLD + ULTRA_BUDGET_STEP; value <= MEGA_BUDGET_THRESHOLD; value += ULTRA_BUDGET_STEP) {
    values.push(value);
  }
  for (let value = MEGA_BUDGET_THRESHOLD + MEGA_BUDGET_STEP; value <= MAX_BUDGET_LIMIT; value += MEGA_BUDGET_STEP) {
    values.push(value);
  }

  return values;
}

function findNearestBudgetPointIndex(value, points) {
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  points.forEach((point, index) => {
    const distance = Math.abs(point - value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

const BUDGET_SLIDER_POINTS = buildBudgetSliderPoints();

function readVendorRegistrationDraft() {
  if (typeof window === 'undefined') {
    return INITIAL_FORM;
  }

  try {
    const rawDraft = window.localStorage.getItem(VENDOR_REGISTRATION_DRAFT_KEY);
    if (!rawDraft) {
      return INITIAL_FORM;
    }

    const parsedDraft = JSON.parse(rawDraft);
    return {
      ...INITIAL_FORM,
      ...parsedDraft,
      bundledServices: Array.isArray(parsedDraft?.bundledServices) ? parsedDraft.bundledServices : [],
      coverageAreas: Array.isArray(parsedDraft?.coverageAreas) ? parsedDraft.coverageAreas : [],
      budgetRange: {
        ...INITIAL_FORM.budgetRange,
        ...(parsedDraft?.budgetRange || {}),
      },
    };
  } catch {
    return INITIAL_FORM;
  }
}

export default function VendorRegistrationForm({ token, onRegistered }) {
  const [form, setForm] = useState(() => readVendorRegistrationDraft());
  const [coverageDraft, setCoverageDraft] = useState({ country: '', state: '', city: '' });
  const [showCoverageForm, setShowCoverageForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [maxBudgetInput, setMaxBudgetInput] = useState('300000');

  const primaryStates = getLocationStates(form.country);
  const primaryCities = getLocationCities(form.country, form.state);
  const coverageStates = getLocationStates(coverageDraft.country);
  const coverageCities = getLocationCities(coverageDraft.country, coverageDraft.state);
  const registrationHighlights = [
    'Free registration and profile publishing on VivahGo.',
    'A cleaner listing with pricing, coverage, and portfolio-ready details.',
    'A faster path into your dashboard, live preview, and media manager.',
  ];
  const sectionSummary = [
    { label: 'Category', value: form.type || 'Choose one' },
    { label: 'Coverage areas', value: String(form.coverageAreas.length + (form.city ? 1 : 0)) },
    { label: 'Extra services', value: String(form.bundledServices.length) },
  ];
  const supportMessage = encodeURIComponent(
    `Hi VivahGo team, \nI need help with vendor registration. \nI am on the "Register your business" step and need support completing my profile.\n${form.businessName ? `Business name: ${form.businessName}.\n` : ''}${form.type ? `Category: ${form.type}.\n` : ''}`
  );
  const vendorSupportWhatsappUrl = `https://wa.me/${VENDOR_SUPPORT_WHATSAPP_NUMBER}?text=${supportMessage}`;
  const minBudgetSliderIndex = findNearestBudgetPointIndex(form.budgetRange.min, BUDGET_SLIDER_POINTS);
  const maxBudgetSliderIndex = findNearestBudgetPointIndex(form.budgetRange.max, BUDGET_SLIDER_POINTS);

  useEffect(() => {
    setMaxBudgetInput(String(form.budgetRange.max));
  }, [form.budgetRange.max]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(VENDOR_REGISTRATION_DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => {
      if (name === 'type') {
        const nextSubtypeOptions = VENDOR_SUBTYPE_OPTIONS[value] || [];
        return {
          ...prev,
          type: value,
          subType: nextSubtypeOptions.includes(prev.subType) ? prev.subType : '',
        };
      }

      if (name === 'country') {
        return { ...prev, country: value, state: '', city: '' };
      }

      if (name === 'state') {
        return { ...prev, state: value, city: '' };
      }

      return { ...prev, [name]: value };
    });
  }

  function updateCoverageDraft(field, value) {
    setCoverageDraft(prev => {
      if (field === 'country') {
        return { country: value, state: '', city: '' };
      }
      if (field === 'state') {
        return { ...prev, state: value, city: '' };
      }
      return { ...prev, [field]: value };
    });
  }

  function addCoverageArea() {
    if (!coverageDraft.country || !coverageDraft.state || !coverageDraft.city) {
      return;
    }

    const nextArea = {
      country: coverageDraft.country,
      state: coverageDraft.state,
      city: coverageDraft.city,
    };

    setForm(prev => {
      const exists = prev.coverageAreas.some(area => (
        area.country === nextArea.country &&
        area.state === nextArea.state &&
        area.city === nextArea.city
      ));

      if (exists) {
        return prev;
      }

      return {
        ...prev,
        coverageAreas: [...prev.coverageAreas, nextArea],
      };
    });

    setCoverageDraft({ country: '', state: '', city: '' });
  }

  function removeCoverageArea(target) {
    setForm(prev => ({
      ...prev,
      coverageAreas: prev.coverageAreas.filter(area => !(
        area.country === target.country &&
        area.state === target.state &&
        area.city === target.city
      )),
    }));
  }

  function toggleBundledService(service) {
    setForm(prev => ({
      ...prev,
      bundledServices: prev.bundledServices.includes(service)
        ? prev.bundledServices.filter(item => item !== service)
        : [...prev.bundledServices, service],
    }));
  }

  function updateBudgetRange(field, rawValue) {
    const value = clampBudgetValue(rawValue);
    if (!Number.isFinite(value)) {
      return;
    }

    setForm(prev => {
      if (field === 'min') {
        const nextMin = Math.min(value, prev.budgetRange.max);
        return {
          ...prev,
          budgetRange: {
            min: nextMin,
            max: Math.max(prev.budgetRange.max, nextMin),
          },
        };
      }

      const nextMax = Math.max(value, prev.budgetRange.min);
      return {
        ...prev,
        budgetRange: {
          min: Math.min(prev.budgetRange.min, nextMax),
          max: nextMax,
        },
      };
    });
  }

  function handleBudgetSliderChange(field, rawIndex) {
    const index = Number(rawIndex);
    const value = BUDGET_SLIDER_POINTS[index];
    if (!Number.isFinite(value)) {
      return;
    }
    updateBudgetRange(field, value);
  }

  function handleMaxBudgetInputChange(rawValue) {
    const sanitizedValue = rawValue.replace(/[^\d]/g, '');
    setMaxBudgetInput(sanitizedValue);

    if (!sanitizedValue) {
      return;
    }

    updateBudgetRange('max', sanitizedValue);
  }

  function handleMaxBudgetInputBlur() {
    const nextValue = clampBudgetValue(maxBudgetInput || form.budgetRange.max);
    if (!Number.isFinite(nextValue)) {
      setMaxBudgetInput(String(form.budgetRange.max));
      return;
    }

    updateBudgetRange('max', nextValue);
    setMaxBudgetInput(String(nextValue));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.businessName.trim()) {
      setError('Business name is required.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerVendor(token, form);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(VENDOR_REGISTRATION_DRAFT_KEY);
      }
      onRegistered(data.vendor);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const fieldClassName = "vendor-registration-field";

  return (
    <div className="vendor-registration-shell">
      <aside className="vendor-registration-rail">
        <div className="vendor-registration-card vendor-registration-card-intro">
          <div className="vendor-registration-eyebrow">VivahGo Vendor Network</div>
          <h1 className="vendor-registration-title">Register your business</h1>
          <p className="vendor-registration-copy">
            This is the setup step between sign-in and your full vendor workspace. Add the core details once, then continue into your dashboard, live preview, and portfolio tools.
          </p>

          <div className="vendor-registration-summary-grid">
            {sectionSummary.map(item => (
              <div key={item.label} className="vendor-registration-summary-card">
                <div className="vendor-registration-summary-label">{item.label}</div>
                <div className="vendor-registration-summary-value">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="vendor-registration-checklist">
            {registrationHighlights.map(item => (
              <div key={item} className="vendor-registration-checklist-item">
                <span className="vendor-registration-checkmark" aria-hidden="true">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <a
            href={vendorSupportWhatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="vendor-registration-help-btn"
          >
            Need help? Chat on WhatsApp
          </a>
        </div>
      </aside>

      <div className="vendor-registration-main">
        <form onSubmit={handleSubmit} className="vendor-registration-form">
          <section className="vendor-registration-card vendor-registration-section-card">
            <div className="vendor-registration-section-head">
              <div>
                <div className="vendor-registration-section-kicker">Section 1</div>
                <h2 className="vendor-registration-section-heading">Business basics</h2>
              </div>
              <p className="vendor-registration-section-copy">
                Help couples understand who you are, what you offer, and where you fit best.
              </p>
            </div>

            <div className="vendor-registration-form-grid vendor-registration-form-grid-2">
              <div className="vendor-registration-field-wrap">
                <label className="vendor-registration-label" htmlFor="businessName">
                  Business Name *
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="e.g. Royal Catering Co."
                  className={fieldClassName}
                  required
                />
              </div>

              <div className="vendor-registration-field-wrap">
                <label className="vendor-registration-label" htmlFor="type">
                  Category *
                </label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className={fieldClassName}
                >
                  {REGISTRATION_VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {Array.isArray(VENDOR_SUBTYPE_OPTIONS[form.type]) && VENDOR_SUBTYPE_OPTIONS[form.type].length > 0 && (
              <div className="vendor-registration-field-wrap">
                <label className="vendor-registration-label" htmlFor="subType">
                  Subcategory
                </label>
                <select
                  id="subType"
                  name="subType"
                  value={form.subType}
                  onChange={handleChange}
                  className={fieldClassName}
                >
                  <option value="">Select a subcategory</option>
                  {VENDOR_SUBTYPE_OPTIONS[form.type].map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="vendor-registration-field-wrap">
              <label className="vendor-registration-label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your services, style, specialties, and what couples usually book you for."
                rows={4}
                className={`${fieldClassName} vendor-registration-textarea`}
              />
            </div>
          </section>

          <section className="vendor-registration-card vendor-registration-section-card">
            <div className="vendor-registration-section-head">
              <div>
                <div className="vendor-registration-section-kicker">Section 2</div>
                <h2 className="vendor-registration-section-heading">Pricing and service scope</h2>
              </div>
              <p className="vendor-registration-section-copy">
                Give couples an early sense of budget fit and the services they can expect from you.
              </p>
            </div>

            <div className="vendor-registration-location-block">
              <div className="vendor-registration-section-title">Pricing Structure</div>
              <p className="vendor-registration-block-copy">Set a realistic range so couples can compare your services more confidently.</p>
              <div className="vendor-registration-price-grid">
                <div className="vendor-registration-price-card">
                  <div className="vendor-registration-price-label">Minimum Price</div>
                  <div className="vendor-registration-price-value">{formatInr(form.budgetRange.min)}</div>
                </div>
                <div className="vendor-registration-price-card">
                  <label className="vendor-registration-price-label" htmlFor="vendor-registration-max-price-input">Maximum Price</label>
                  <input
                    id="vendor-registration-max-price-input"
                    type="text"
                    inputMode="numeric"
                    value={maxBudgetInput ? formatInr(maxBudgetInput) : ''}
                    onChange={event => handleMaxBudgetInputChange(event.target.value)}
                    onBlur={handleMaxBudgetInputBlur}
                    className="vendor-registration-price-input"
                    aria-label="Maximum Price"
                  />
                </div>
              </div>
              <div className="vendor-registration-slider-stack">
                <label className="vendor-registration-slider-label">
                  <span>Minimum Price</span>
                  <input
                    type="range"
                    min={0}
                    max={BUDGET_SLIDER_POINTS.length - 1}
                    step={1}
                    value={minBudgetSliderIndex}
                    onChange={event => handleBudgetSliderChange('min', event.target.value)}
                    className="vendor-registration-range"
                  />
                </label>
                <label className="vendor-registration-slider-label">
                  <span>Maximum Price</span>
                  <input
                    type="range"
                    min={0}
                    max={BUDGET_SLIDER_POINTS.length - 1}
                    step={1}
                    value={maxBudgetSliderIndex}
                    onChange={event => handleBudgetSliderChange('max', event.target.value)}
                    className="vendor-registration-range"
                  />
                </label>
              </div>
            </div>

            <div className="vendor-registration-location-block">
              <div className="vendor-registration-section-title">Also Offers</div>
              <p className="vendor-registration-block-copy">Select any bundled services that strengthen your listing.</p>
              <div className="vendor-registration-chip-list">
                {BUNDLED_SERVICE_OPTIONS.filter(option => option !== form.type).map(option => (
                  <button
                    key={option}
                    type="button"
                    className={`vendor-registration-chip${form.bundledServices.includes(option) ? ' active' : ''}`}
                    onClick={() => toggleBundledService(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="vendor-registration-card vendor-registration-section-card">
            <div className="vendor-registration-section-head">
              <div>
                <div className="vendor-registration-section-kicker">Section 3</div>
                <h2 className="vendor-registration-section-heading">Where you work</h2>
              </div>
              <p className="vendor-registration-section-copy">
                Add your primary service location first, then include extra areas if you travel for bookings.
              </p>
            </div>

            <div className="vendor-registration-location-block">
              <div className="vendor-registration-section-title">Primary Service Location</div>
              <div className="vendor-registration-grid vendor-registration-grid-3">
                <select
                  id="country"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  className={fieldClassName}
                >
                  <option value="">Select country</option>
                  {getLocationCountries().map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select
                  id="state"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className={fieldClassName}
                  disabled={!primaryStates.length}
                >
                  <option value="">Select state</option>
                  {primaryStates.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select
                  id="city"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className={fieldClassName}
                  disabled={!primaryCities.length}
                >
                  <option value="">Select city</option>
                  {primaryCities.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="vendor-registration-field-wrap vendor-registration-field-wrap-spaced">
                <label className="vendor-registration-label" htmlFor="googleMapsLink">
                  Google Maps Link
                </label>
                <input
                  id="googleMapsLink"
                  name="googleMapsLink"
                  type="url"
                  value={form.googleMapsLink}
                  onChange={handleChange}
                  placeholder="Paste your main service location Google Maps link"
                  className={fieldClassName}
                />
              </div>
            </div>

            <div className="vendor-registration-location-block">
              <button
                type="button"
                className="vendor-registration-section-toggle"
                onClick={() => setShowCoverageForm(current => !current)}
                aria-expanded={showCoverageForm}
              >
                <span className="vendor-registration-section-title">Additional Coverage Areas</span>
                <span>{showCoverageForm ? 'Hide' : 'Add More'}</span>
              </button>
              {showCoverageForm && (
                <>
                  <div className="vendor-registration-grid vendor-registration-grid-3">
                    <select
                      value={coverageDraft.country}
                      onChange={event => updateCoverageDraft('country', event.target.value)}
                      className={fieldClassName}
                    >
                      <option value="">Select country</option>
                      {getLocationCountries().map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <select
                      value={coverageDraft.state}
                      onChange={event => updateCoverageDraft('state', event.target.value)}
                      className={fieldClassName}
                      disabled={!coverageStates.length}
                    >
                      <option value="">Select state</option>
                      {coverageStates.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <select
                      value={coverageDraft.city}
                      onChange={event => updateCoverageDraft('city', event.target.value)}
                      className={fieldClassName}
                      disabled={!coverageCities.length}
                    >
                      <option value="">Select city</option>
                      {coverageCities.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  <button type="button" className="vendor-registration-add-btn" onClick={addCoverageArea}>
                    Add Coverage Area
                  </button>
                </>
              )}
              {form.coverageAreas.length > 0 && (
                <div className="vendor-registration-chip-list">
                  {form.coverageAreas.map(area => (
                    <button
                      key={formatCoverageLocation(area)}
                      type="button"
                      className="vendor-registration-chip"
                      onClick={() => removeCoverageArea(area)}
                    >
                      {formatCoverageLocation(area)} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="vendor-registration-card vendor-registration-section-card">
            <div className="vendor-registration-section-head">
              <div>
                <div className="vendor-registration-section-kicker">Section 4</div>
                <h2 className="vendor-registration-section-heading">Contact and finish</h2>
              </div>
              <p className="vendor-registration-section-copy">
                Add a direct way for couples to trust and reach your business, then create your profile.
              </p>
            </div>

            <div className="vendor-registration-form-grid vendor-registration-form-grid-2">
              <div className="vendor-registration-field-wrap">
                <label className="vendor-registration-label" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 99999 00000"
                  className={fieldClassName}
                />
              </div>

              <div className="vendor-registration-field-wrap">
                <label className="vendor-registration-label" htmlFor="website">
                  Website
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://yoursite.com"
                  className={fieldClassName}
                />
              </div>
            </div>

            {error && (
              <p className="vendor-registration-error" role="alert">{error}</p>
            )}

            <div className="vendor-registration-submit-wrap">
              <p className="vendor-registration-submit-copy">
                You can continue refining your profile, media, and business details after this step.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="vendor-registration-submit"
              >
                {loading ? 'Registering…' : 'Create Vendor Profile'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
