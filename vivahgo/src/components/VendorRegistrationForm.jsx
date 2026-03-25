import { useState } from 'react';
import { registerVendor } from '../api';
import { BUNDLED_SERVICE_OPTIONS, VENDOR_SUBTYPE_OPTIONS, VENDOR_TYPES } from '../constants';
import { formatCoverageLocation, getLocationCities, getLocationCountries, getLocationStates } from '../locationOptions';

const REGISTRATION_VENDOR_TYPES = VENDOR_TYPES.filter(type => type !== 'All');
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 5000000;
const BUDGET_STEP = 10000;

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function VendorRegistrationForm({ token, onRegistered }) {
  const [form, setForm] = useState({
    businessName: '',
    type: REGISTRATION_VENDOR_TYPES[0],
    subType: '',
    bundledServices: [],
    country: '',
    state: '',
    description: '',
    city: '',
    coverageAreas: [],
    phone: '',
    website: '',
    budgetRange: {
      min: 100000,
      max: 300000,
    },
  });
  const [coverageDraft, setCoverageDraft] = useState({ country: '', state: '', city: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const primaryStates = getLocationStates(form.country);
  const primaryCities = getLocationCities(form.country, form.state);
  const coverageStates = getLocationStates(coverageDraft.country);
  const coverageCities = getLocationCities(coverageDraft.country, coverageDraft.state);

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
    const value = Number(rawValue);
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
      onRegistered(data.vendor);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const fieldClassName = "vendor-registration-field";

  return (
    <div className="vendor-registration-card max-w-lg mx-auto">
      <div className="vendor-registration-eyebrow">VivahGo Vendor Network</div>
      <h1 className="vendor-registration-title">Register Your Business</h1>
      <p className="vendor-registration-copy">
        Create your vendor profile to appear in the VivahGo vendor directory.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
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

        <div>
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

        {Array.isArray(VENDOR_SUBTYPE_OPTIONS[form.type]) && VENDOR_SUBTYPE_OPTIONS[form.type].length > 0 && (
          <div>
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

        <div>
          <label className="vendor-registration-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Describe your services…"
            rows={3}
            className={`${fieldClassName} vendor-registration-textarea`}
          />
        </div>

        <div className="vendor-registration-location-block">
          <div className="vendor-registration-section-title">Pricing Structure</div>
          <p className="text-xs text-gray-500">Set your service budget range so couples can find your business in budget filters.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500">Minimum</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatInr(form.budgetRange.min)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.15em] text-gray-500">Maximum</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{formatInr(form.budgetRange.max)}</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Min Budget</span>
              <input
                type="range"
                min={MIN_BUDGET_LIMIT}
                max={MAX_BUDGET_LIMIT}
                step={BUDGET_STEP}
                value={form.budgetRange.min}
                onChange={event => updateBudgetRange('min', event.target.value)}
                className="w-full"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Max Budget</span>
              <input
                type="range"
                min={MIN_BUDGET_LIMIT}
                max={MAX_BUDGET_LIMIT}
                step={BUDGET_STEP}
                value={form.budgetRange.max}
                onChange={event => updateBudgetRange('max', event.target.value)}
                className="w-full"
              />
            </label>
          </div>
        </div>

        <div className="vendor-registration-location-block">
          <div className="vendor-registration-section-title">Also Offers</div>
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
        </div>

        <div>
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

        <div className="vendor-registration-location-block">
          <div className="vendor-registration-section-title">Additional Coverage Areas</div>
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

        <div>
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

        {error && (
          <p className="vendor-registration-error" role="alert">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="vendor-registration-submit"
        >
          {loading ? 'Registering…' : 'Create Vendor Profile'}
        </button>
      </form>
    </div>
  );
}
