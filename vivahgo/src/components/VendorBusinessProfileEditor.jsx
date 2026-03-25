import { useEffect, useState } from 'react';
import { updateVendorProfile } from '../api';
import { BUNDLED_SERVICE_OPTIONS, VENDOR_SUBTYPE_OPTIONS, VENDOR_TYPES } from '../constants';
import { formatCoverageLocation, getLocationCities, getLocationCountries, getLocationStates } from '../locationOptions';

const REGISTRATION_VENDOR_TYPES = VENDOR_TYPES.filter(type => type !== 'All');
const MIN_BUDGET_LIMIT = 10000;
const MAX_BUDGET_LIMIT = 5000000;
const BUDGET_STEP = 10000;

function normalizeBudgetRange(range) {
  const min = Number(range?.min);
  const max = Number(range?.max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: MIN_BUDGET_LIMIT, max: 300000 };
  }

  const safeMin = Math.max(MIN_BUDGET_LIMIT, Math.min(Math.round(min / BUDGET_STEP) * BUDGET_STEP, MAX_BUDGET_LIMIT));
  const safeMax = Math.max(safeMin, Math.min(Math.round(max / BUDGET_STEP) * BUDGET_STEP, MAX_BUDGET_LIMIT));
  return { min: safeMin, max: safeMax };
}

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function buildInitialForm(vendor) {
  const budgetRange = normalizeBudgetRange(vendor?.budgetRange);

  return {
    businessName: vendor?.businessName || '',
    type: vendor?.type || REGISTRATION_VENDOR_TYPES[0],
    subType: vendor?.subType || '',
    bundledServices: Array.isArray(vendor?.bundledServices) ? vendor.bundledServices : [],
    description: vendor?.description || '',
    country: vendor?.country || '',
    state: vendor?.state || '',
    city: vendor?.city || '',
    coverageAreas: Array.isArray(vendor?.coverageAreas) ? vendor.coverageAreas : [],
    phone: vendor?.phone || '',
    website: vendor?.website || '',
    budgetRange,
  };
}

export default function VendorBusinessProfileEditor({ token, vendor, onVendorUpdated }) {
  const [form, setForm] = useState(() => buildInitialForm(vendor));
  const [coverageDraft, setCoverageDraft] = useState({ country: '', state: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const subtypeOptions = VENDOR_SUBTYPE_OPTIONS[form.type] || [];
  const primaryStates = getLocationStates(form.country);
  const primaryCities = getLocationCities(form.country, form.state);
  const coverageStates = getLocationStates(coverageDraft.country);
  const coverageCities = getLocationCities(coverageDraft.country, coverageDraft.state);

  useEffect(() => {
    setForm(buildInitialForm(vendor));
  }, [vendor]);

  function updateForm(field, value) {
    setForm(current => {
      if (field === 'type') {
        const nextSubtypeOptions = VENDOR_SUBTYPE_OPTIONS[value] || [];
        return {
          ...current,
          type: value,
          subType: nextSubtypeOptions.includes(current.subType) ? current.subType : '',
        };
      }

      if (field === 'country') {
        return { ...current, country: value, state: '', city: '' };
      }

      if (field === 'state') {
        return { ...current, state: value, city: '' };
      }

      return { ...current, [field]: value };
    });
  }

  function updateCoverageDraft(field, value) {
    setCoverageDraft(current => {
      if (field === 'country') {
        return { country: value, state: '', city: '' };
      }
      if (field === 'state') {
        return { ...current, state: value, city: '' };
      }
      return { ...current, [field]: value };
    });
  }

  function addCoverageArea() {
    if (!coverageDraft.country || !coverageDraft.state || !coverageDraft.city) {
      return;
    }

    const nextArea = { ...coverageDraft };
    setForm(current => {
      const exists = current.coverageAreas.some(area => (
        area.country === nextArea.country &&
        area.state === nextArea.state &&
        area.city === nextArea.city
      ));

      if (exists) {
        return current;
      }

      return {
        ...current,
        coverageAreas: [...current.coverageAreas, nextArea],
      };
    });
    setCoverageDraft({ country: '', state: '', city: '' });
  }

  function removeCoverageArea(target) {
    setForm(current => ({
      ...current,
      coverageAreas: current.coverageAreas.filter(area => !(
        area.country === target.country &&
        area.state === target.state &&
        area.city === target.city
      )),
    }));
  }

  function toggleBundledService(service) {
    setForm(current => ({
      ...current,
      bundledServices: current.bundledServices.includes(service)
        ? current.bundledServices.filter(item => item !== service)
        : [...current.bundledServices, service],
    }));
  }

  function updateBudgetRange(field, rawValue) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return;
    }

    setForm(current => {
      const currentRange = normalizeBudgetRange(current.budgetRange);

      if (field === 'min') {
        const nextMin = Math.min(value, currentRange.max);
        return {
          ...current,
          budgetRange: {
            min: nextMin,
            max: Math.max(currentRange.max, nextMin),
          },
        };
      }

      const nextMax = Math.max(value, currentRange.min);
      return {
        ...current,
        budgetRange: {
          min: Math.min(currentRange.min, nextMax),
          max: nextMax,
        },
      };
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const data = await updateVendorProfile(token, form);
      onVendorUpdated?.(data.vendor);
      setForm(buildInitialForm(data.vendor));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="vendor-registration-label" htmlFor="businessName">Business Name</label>
          <input id="businessName" value={form.businessName} onChange={event => updateForm('businessName', event.target.value)} className="vendor-registration-field" />
        </div>
        <div>
          <label className="vendor-registration-label" htmlFor="type">Category</label>
          <select id="type" value={form.type} onChange={event => updateForm('type', event.target.value)} className="vendor-registration-field">
            {REGISTRATION_VENDOR_TYPES.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      {subtypeOptions.length > 0 && (
        <div>
          <label className="vendor-registration-label" htmlFor="subType">Subcategory</label>
          <select id="subType" value={form.subType} onChange={event => updateForm('subType', event.target.value)} className="vendor-registration-field">
            <option value="">Select a subcategory</option>
            {subtypeOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="vendor-registration-label" htmlFor="description">Description</label>
        <textarea id="description" value={form.description} onChange={event => updateForm('description', event.target.value)} className="vendor-registration-field vendor-registration-textarea" rows={4} />
      </div>

      <div className="vendor-registration-location-block">
        <div className="vendor-registration-section-title">Pricing Structure</div>
        <p className="text-xs text-gray-500">Set your service budget range so couples can filter and compare accurately.</p>
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
          <select value={form.country} onChange={event => updateForm('country', event.target.value)} className="vendor-registration-field">
            <option value="">Select country</option>
            {getLocationCountries().map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={form.state} onChange={event => updateForm('state', event.target.value)} className="vendor-registration-field" disabled={!primaryStates.length}>
            <option value="">Select state</option>
            {primaryStates.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={form.city} onChange={event => updateForm('city', event.target.value)} className="vendor-registration-field" disabled={!primaryCities.length}>
            <option value="">Select city</option>
            {primaryCities.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <div className="vendor-registration-location-block">
        <div className="vendor-registration-section-title">Additional Coverage Areas</div>
        <div className="vendor-registration-grid vendor-registration-grid-3">
          <select value={coverageDraft.country} onChange={event => updateCoverageDraft('country', event.target.value)} className="vendor-registration-field">
            <option value="">Select country</option>
            {getLocationCountries().map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={coverageDraft.state} onChange={event => updateCoverageDraft('state', event.target.value)} className="vendor-registration-field" disabled={!coverageStates.length}>
            <option value="">Select state</option>
            {coverageStates.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={coverageDraft.city} onChange={event => updateCoverageDraft('city', event.target.value)} className="vendor-registration-field" disabled={!coverageCities.length}>
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
              <button key={formatCoverageLocation(area)} type="button" className="vendor-registration-chip" onClick={() => removeCoverageArea(area)}>
                {formatCoverageLocation(area)} ×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="vendor-registration-label" htmlFor="phone">Phone</label>
          <input id="phone" value={form.phone} onChange={event => updateForm('phone', event.target.value)} className="vendor-registration-field" />
        </div>
        <div>
          <label className="vendor-registration-label" htmlFor="website">Website</label>
          <input id="website" value={form.website} onChange={event => updateForm('website', event.target.value)} className="vendor-registration-field" />
        </div>
      </div>

      {error && <p className="vendor-registration-error">{error}</p>}

      <button type="submit" className="vendor-registration-submit" disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Business Details'}
      </button>
    </form>
  );
}
