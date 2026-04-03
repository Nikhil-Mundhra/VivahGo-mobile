import { useState } from 'react';
import {
  clampVendorBudgetValue,
  findNearestVendorBudgetPointIndex,
  formatVendorBudgetInr,
  normalizeVendorBudgetRange,
  updateVendorBudgetRange,
  VENDOR_BUDGET_SLIDER_POINTS,
} from '../../../vendorPricing';

export default function VendorPricingStructureFields({
  budgetRange,
  idPrefix = 'vendor-pricing',
  onChange,
}) {
  const normalizedBudgetRange = normalizeVendorBudgetRange(budgetRange);
  const [maxBudgetInput, setMaxBudgetInput] = useState('');
  const [isEditingMaxBudget, setIsEditingMaxBudget] = useState(false);

  const minBudgetSliderIndex = findNearestVendorBudgetPointIndex(
    normalizedBudgetRange.min,
    VENDOR_BUDGET_SLIDER_POINTS
  );
  const maxBudgetSliderIndex = findNearestVendorBudgetPointIndex(
    normalizedBudgetRange.max,
    VENDOR_BUDGET_SLIDER_POINTS
  );

  function updateRange(field, rawValue) {
    const nextBudgetRange = updateVendorBudgetRange(normalizedBudgetRange, field, rawValue);
    if (!nextBudgetRange) {
      return;
    }

    onChange?.(nextBudgetRange);
  }

  function handleBudgetSliderChange(field, rawIndex) {
    const index = Number(rawIndex);
    const value = VENDOR_BUDGET_SLIDER_POINTS[index];
    if (!Number.isFinite(value)) {
      return;
    }

    updateRange(field, value);
  }

  function handleMaxBudgetInputChange(rawValue) {
    const sanitizedValue = rawValue.replace(/[^\d]/g, '');
    setIsEditingMaxBudget(true);
    setMaxBudgetInput(sanitizedValue);

    if (!sanitizedValue) {
      return;
    }

    updateRange('max', sanitizedValue);
  }

  function handleMaxBudgetInputBlur() {
    const nextValue = clampVendorBudgetValue(maxBudgetInput || normalizedBudgetRange.max);
    if (!Number.isFinite(nextValue)) {
      setIsEditingMaxBudget(false);
      setMaxBudgetInput('');
      return;
    }

    updateRange('max', nextValue);
    setIsEditingMaxBudget(false);
    setMaxBudgetInput('');
  }

  const maxBudgetInputValue = isEditingMaxBudget
    ? (maxBudgetInput ? formatVendorBudgetInr(maxBudgetInput) : '')
    : formatVendorBudgetInr(normalizedBudgetRange.max);

  return (
    <div className="vendor-registration-location-block">
      <div className="vendor-registration-section-title">Pricing Structure</div>
      <p className="vendor-registration-block-copy">Set a realistic range so couples can compare your services more confidently.</p>
      <div className="vendor-registration-price-grid">
        <div className="vendor-registration-price-card">
          <div className="vendor-registration-price-label">Minimum Price</div>
          <div className="vendor-registration-price-value">{formatVendorBudgetInr(normalizedBudgetRange.min)}</div>
        </div>
        <div className="vendor-registration-price-card">
          <label className="vendor-registration-price-label" htmlFor={`${idPrefix}-max-price-input`}>Maximum Price</label>
          <input
            id={`${idPrefix}-max-price-input`}
            type="text"
            inputMode="numeric"
            value={maxBudgetInputValue}
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
            max={VENDOR_BUDGET_SLIDER_POINTS.length - 1}
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
            max={VENDOR_BUDGET_SLIDER_POINTS.length - 1}
            step={1}
            value={maxBudgetSliderIndex}
            onChange={event => handleBudgetSliderChange('max', event.target.value)}
            className="vendor-registration-range"
          />
        </label>
      </div>
    </div>
  );
}
