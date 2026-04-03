import { useEffect, useState } from 'react';
import { updateVendorProfile } from '../api.js';
import { BUNDLED_SERVICE_OPTIONS, VENDOR_SUBTYPE_OPTIONS, VENDOR_TYPES } from '../../../constants';
import { formatCoverageLocation, getLocationCities, getLocationCountries, getLocationStates } from '../../../locationOptions';
import VendorPricingStructureFields from './VendorPricingStructureFields';
import { normalizeVendorBudgetRange } from '../../../vendorPricing';

const REGISTRATION_VENDOR_TYPES = VENDOR_TYPES.filter(type => type !== 'All');
const LEGACY_VENDOR_TYPE_ALIASES = {
  Bride: 'Bridal & Pre-Bridal',
  Groom: 'Groom Services',
};

function normalizeVendorType(type) {
  return LEGACY_VENDOR_TYPE_ALIASES[type] || type;
}

function normalizeUrlValue(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function isValidUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildInitialForm(vendor) {
  const budgetRange = normalizeVendorBudgetRange(vendor?.budgetRange);
  const hasDefaultCapacity = vendor?.availabilitySettings?.hasDefaultCapacity !== false;
  const defaultMaxCapacity = Number(vendor?.availabilitySettings?.defaultMaxCapacity);

  return {
    businessName: vendor?.businessName || '',
    type: normalizeVendorType(vendor?.type) || REGISTRATION_VENDOR_TYPES[0],
    subType: vendor?.subType || '',
    bundledServices: Array.isArray(vendor?.bundledServices) ? vendor.bundledServices : [],
    description: vendor?.description || '',
    country: vendor?.country || '',
    state: vendor?.state || '',
    city: vendor?.city || '',
    googleMapsLink: vendor?.googleMapsLink || '',
    coverageAreas: Array.isArray(vendor?.coverageAreas) ? vendor.coverageAreas : [],
    phone: vendor?.phone || '',
    website: vendor?.website || '',
    budgetRange,
    hasDefaultCapacity,
    defaultMaxCapacity: Number.isInteger(defaultMaxCapacity) && defaultMaxCapacity > 0 ? defaultMaxCapacity : 1,
  };
}

export default function VendorBusinessProfileEditor({ token, vendor, onVendorUpdated, onPreviewChange }) {
  const [form, setForm] = useState(() => buildInitialForm(vendor));
  const [coverageDraft, setCoverageDraft] = useState({ country: '', state: '', city: '' });
  const [showCoverageForm, setShowCoverageForm] = useState(() => Array.isArray(vendor?.coverageAreas) && vendor.coverageAreas.length > 0);
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
    setShowCoverageForm(Array.isArray(vendor?.coverageAreas) && vendor.coverageAreas.length > 0);
  }, [vendor]);

  useEffect(() => {
    onPreviewChange?.({
      ...vendor,
      ...form,
      businessName: form.businessName,
      bundledServices: form.bundledServices,
      coverageAreas: form.coverageAreas,
      budgetRange: form.budgetRange,
      availabilitySettings: {
        ...(vendor?.availabilitySettings || {}),
        hasDefaultCapacity: form.hasDefaultCapacity,
        defaultMaxCapacity: form.defaultMaxCapacity,
      },
    });
  }, [form, onPreviewChange, vendor]);

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

  function normalizeUrlField(field) {
    setForm(current => ({
      ...current,
      [field]: normalizeUrlValue(current[field]),
    }));
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

  function updateDefaultMaxCapacity(rawValue) {
    const value = Number(rawValue);
    if (!Number.isInteger(value)) {
      return;
    }

    setForm(current => ({
      ...current,
      defaultMaxCapacity: Math.max(1, Math.min(99, value)),
    }));
  }

  function toggleDefaultCapacity(enabled) {
    setForm(current => ({
      ...current,
      hasDefaultCapacity: enabled,
      defaultMaxCapacity: enabled ? Math.max(1, current.defaultMaxCapacity || 1) : current.defaultMaxCapacity,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    const normalizedWebsite = normalizeUrlValue(form.website);
    const normalizedMapsLink = normalizeUrlValue(form.googleMapsLink);

    if (!form.businessName.trim()) {
      setError('Business name is required.');
      setSaving(false);
      return;
    }

    if (!isValidUrl(normalizedWebsite)) {
      setError('Enter a valid website URL.');
      setSaving(false);
      return;
    }

    if (!isValidUrl(normalizedMapsLink)) {
      setError('Enter a valid Google Maps URL.');
      setSaving(false);
      return;
    }

    if (form.hasDefaultCapacity && (!Number.isInteger(form.defaultMaxCapacity) || form.defaultMaxCapacity < 1 || form.defaultMaxCapacity > 99)) {
      setError('Enter a default capacity between 1 and 99.');
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...form,
        website: normalizedWebsite,
        googleMapsLink: normalizedMapsLink,
        availabilitySettings: {
          hasDefaultCapacity: form.hasDefaultCapacity,
          defaultMaxCapacity: form.hasDefaultCapacity ? form.defaultMaxCapacity : 0,
          dateOverrides: Array.isArray(vendor?.availabilitySettings?.dateOverrides) ? vendor.availabilitySettings.dateOverrides : [],
        },
      };
      const data = await updateVendorProfile(token, payload);
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
          <input
            id="businessName"
            type="text"
            autoComplete="organization"
            placeholder="e.g. Royal Catering Co."
            value={form.businessName}
            onChange={event => updateForm('businessName', event.target.value)}
            className="vendor-registration-field"
          />
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
        <textarea
          id="description"
          value={form.description}
          onChange={event => updateForm('description', event.target.value)}
          className="vendor-registration-field vendor-registration-textarea"
          rows={4}
          placeholder="Describe your services, specialties, and what makes your business stand out."
        />
      </div>

      <VendorPricingStructureFields
        idPrefix="vendor-business-profile"
        budgetRange={form.budgetRange}
        onChange={budgetRange => setForm(current => ({ ...current, budgetRange }))}
      />

      <div className="vendor-registration-location-block">
        <div className="vendor-registration-section-title">Your Default Capacity / Day</div>
        <p className="text-xs text-gray-500">Find more from Availability</p>
        <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-gray-900">Capacity mode</span>
            <button
              type="button"
              onClick={() => toggleDefaultCapacity(!form.hasDefaultCapacity)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                form.hasDefaultCapacity
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {form.hasDefaultCapacity ? 'Use a default capacity' : 'Set custom each time'}
            </button>
          </div>

          {form.hasDefaultCapacity && (
            <div className="mt-4 max-w-xs">
              <label className="vendor-registration-label" htmlFor="defaultMaxCapacity">Default bookings per day</label>
              <input
                id="defaultMaxCapacity"
                type="number"
                min="1"
                max="99"
                value={form.defaultMaxCapacity}
                onChange={event => updateDefaultMaxCapacity(event.target.value)}
                className="vendor-registration-field"
              />
            </div>
          )}
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
        <div className="mt-3">
          <label className="vendor-registration-label" htmlFor="googleMapsLink">Google Maps Link</label>
          <input
            id="googleMapsLink"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={form.googleMapsLink}
            onChange={event => updateForm('googleMapsLink', event.target.value)}
            onBlur={() => normalizeUrlField('googleMapsLink')}
            className="vendor-registration-field"
            placeholder="Paste your main service location Google Maps link"
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
          </>
        )}
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
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. +91 99999 00000"
            value={form.phone}
            onChange={event => updateForm('phone', event.target.value)}
            className="vendor-registration-field"
          />
        </div>
        <div>
          <label className="vendor-registration-label" htmlFor="website">Website</label>
          <input
            id="website"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yourbusiness.com"
            value={form.website}
            onChange={event => updateForm('website', event.target.value)}
            onBlur={() => normalizeUrlField('website')}
            className="vendor-registration-field"
          />
        </div>
      </div>

      {error && <p className="vendor-registration-error">{error}</p>}

      <button type="submit" className="vendor-registration-submit" disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Business Details'}
      </button>
    </form>
  );
}
