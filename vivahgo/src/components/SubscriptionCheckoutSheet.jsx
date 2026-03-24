import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const QUOTE_CACHE_TTL_MS = 60000;

function formatAmount(amount, currency) {
  if (!amount) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default function SubscriptionCheckoutSheet({
  token,
  plan,
  planName,
  billingCycle,
  onPlanChange,
  onBillingCycleChange,
  onLoadingStart,
  onReady,
  onClose,
  onError,
  onProceed,
  fetchQuote,
}) {
  const [isPreparing, setIsPreparing] = useState(true);
  const [isProceeding, setIsProceeding] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteData, setQuoteData] = useState(null);
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const onLoadingStartRef = useRef(onLoadingStart);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const quoteCacheRef = useRef(new Map());

  useEffect(() => {
    onLoadingStartRef.current = onLoadingStart;
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onLoadingStart, onReady, onError]);

  const prepareQuote = useCallback(async (active = () => true, force = false) => {
    const quoteKey = `${plan}:${billingCycle}:${appliedCouponCode || ""}`;
    const now = Date.now();
    const cachedQuote = quoteCacheRef.current.get(quoteKey);
    if (!force && cachedQuote && now - cachedQuote.timestamp < QUOTE_CACHE_TTL_MS) {
      setQuoteError("");
      setQuoteData(cachedQuote.value);
      setIsPreparing(false);
      onReadyRef.current?.();
      return;
    }

    setQuoteError("");
    setIsPreparing(true);
    onLoadingStartRef.current?.();

    try {
      const nextQuote = await fetchQuote(token, plan, billingCycle, appliedCouponCode);

      if (!active()) {
        return;
      }

      quoteCacheRef.current.set(quoteKey, { value: nextQuote, timestamp: now });
      setQuoteData(nextQuote);
    } catch (error) {
      const message = error?.message || "Could not calculate your price.";
      if (active()) {
        setQuoteError(message);
        onErrorRef.current?.(message);
      }
    } finally {
      if (active()) {
        setIsPreparing(false);
        onReadyRef.current?.();
      }
    }
  }, [appliedCouponCode, billingCycle, fetchQuote, plan, token]);

  useEffect(() => {
    let active = true;
    prepareQuote(() => active);

    return () => {
      active = false;
    };
  }, [prepareQuote]);

  const handleProceed = useCallback(() => {
    if (!quoteData) {
      setQuoteError("Checkout quote is unavailable. Please refresh and try again.");
      return;
    }

    setIsProceeding(true);
    setQuoteError("");
    onProceed?.({
      plan,
      billingCycle,
      couponCode: appliedCouponCode,
    });
  }, [appliedCouponCode, billingCycle, onProceed, plan, quoteData]);

  const amountLabel = useMemo(() => formatAmount(quoteData?.amount, quoteData?.currency), [quoteData]);
  const baseAmountLabel = useMemo(() => formatAmount(quoteData?.baseAmount, quoteData?.currency), [quoteData]);

  const handleApplyCoupon = useCallback(() => {
    const normalizedCode = couponDraft.trim().toUpperCase();
    setAppliedCouponCode(normalizedCode);
  }, [couponDraft]);

  const handleRemoveCoupon = useCallback(() => {
    setCouponDraft("");
    setAppliedCouponCode("");
  }, []);

  return (
    <div className="marketing-checkout-overlay" role="presentation">
      <div className="marketing-checkout-sheet marketing-checkout-sheet-compact" role="dialog" aria-modal="true" aria-label="Preparing Razorpay checkout">
        <div className="marketing-checkout-sheet-handle" />
        <button type="button" className="marketing-checkout-close" aria-label="Close checkout" onClick={onClose}>
          x
        </button>

        <header className="marketing-checkout-header">
          <p className="marketing-checkout-kicker">Review Checkout</p>
          <h2>Complete payment for {planName}</h2>
          <div className="marketing-checkout-plan-toggle" role="group" aria-label="Checkout plan type">
            <button
              type="button"
              className={`marketing-checkout-plan-option${plan === "premium" ? " marketing-checkout-plan-option-active" : ""}`}
              onClick={() => onPlanChange?.("premium", "Premium")}
              disabled={isPreparing || isProceeding}
            >
              Premium
            </button>
            <button
              type="button"
              className={`marketing-checkout-plan-option${plan === "studio" ? " marketing-checkout-plan-option-active" : ""}`}
              onClick={() => onPlanChange?.("studio", "Studio")}
              disabled={isPreparing || isProceeding}
            >
              Studio
            </button>
          </div>
          <div className="marketing-checkout-cycle-toggle" role="group" aria-label="Checkout billing cycle">
            <button
              type="button"
              className={`marketing-checkout-cycle-option${billingCycle === "monthly" ? " marketing-checkout-cycle-option-active" : ""}`}
              onClick={() => onBillingCycleChange?.("monthly")}
              disabled={isPreparing || isProceeding}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`marketing-checkout-cycle-option${billingCycle === "yearly" ? " marketing-checkout-cycle-option-active" : ""}`}
              onClick={() => onBillingCycleChange?.("yearly")}
              disabled={isPreparing || isProceeding}
            >
              Yearly
            </button>
          </div>
        </header>

        <div className="marketing-checkout-coupon-panel">
          <label className="marketing-checkout-coupon-label" htmlFor="checkout-coupon-code">Coupon code</label>
          <div className="marketing-checkout-coupon-row">
            <input
              id="checkout-coupon-code"
              className="marketing-checkout-coupon-input"
              type="text"
              value={couponDraft}
              onChange={(event) => setCouponDraft(event.target.value.toUpperCase())}
              placeholder="Enter coupon"
              disabled={isPreparing || isProceeding}
            />
            <button
              type="button"
              className="marketing-price-action marketing-price-action-featured"
              onClick={handleApplyCoupon}
              disabled={isPreparing || isProceeding || !couponDraft.trim()}
            >
              Apply
            </button>
          </div>
          {appliedCouponCode && quoteData?.appliedCoupon && (
            <div className="marketing-checkout-coupon-applied">
              <span>
                {quoteData.appliedCoupon.code} applied for {quoteData.appliedCoupon.discountPercent}% off
              </span>
              <button type="button" onClick={handleRemoveCoupon} disabled={isPreparing || isProceeding}>
                Remove
              </button>
            </div>
          )}
        </div>

        {isPreparing ? (
          <div className="marketing-checkout-loading-block">
            <div className="marketing-checkout-spinner" aria-hidden="true" />
            <p>Calculating checkout amount...</p>
          </div>
        ) : quoteError ? (
          <div className="marketing-checkout-error-block">
            <p>{quoteError}</p>
            <div className="marketing-checkout-actions">
              <button type="button" className="marketing-price-action marketing-price-action-featured" onClick={() => prepareQuote(() => true, true)}>
                Retry
              </button>
              <button type="button" className="marketing-price-action marketing-price-action-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="marketing-checkout-loading-block">
            {quoteData?.appliedCoupon && baseAmountLabel && amountLabel ? (
              <div className="marketing-checkout-price-summary">
                <span>Original: {baseAmountLabel}</span>
                <strong>Discounted: {amountLabel}</strong>
              </div>
            ) : null}
            <p>{amountLabel ? `Amount due: ${amountLabel}` : "Amount unavailable."}</p>
            <p>Pay now will continue to a secure checkout page.</p>
            <div className="marketing-checkout-actions">
              <button
                type="button"
                className="marketing-price-action marketing-price-action-featured"
                onClick={handleProceed}
                disabled={isProceeding || !quoteData}
                style={isProceeding ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
              >
                {isProceeding ? "Continuing..." : "Pay Now"}
              </button>
              <button type="button" className="marketing-price-action marketing-price-action-ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
