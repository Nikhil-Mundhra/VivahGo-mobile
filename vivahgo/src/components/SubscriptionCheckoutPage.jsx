import { useCallback, useEffect, useMemo, useRef, useState } from "react";

let razorpayScriptPromise;
const QUOTE_CACHE_TTL_MS = 60000;

const PLAN_LABELS = {
  premium: "Premium",
  studio: "Studio",
};

const PLAN_PERKS = {
  premium: [
    "Multiple wedding workspaces",
    "Collaborator permissions",
    "Priority planner sync",
  ],
  studio: [
    "Everything in Premium",
    "Client-ready workspaces",
    "Team collaboration",
    "Admin visibility across plans",
  ],
};

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

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

export default function SubscriptionCheckoutPage({
  token,
  initialPlan,
  initialBillingCycle,
  initialCouponCode,
  fetchQuote,
  createSession,
  confirmPayment,
  onBack,
  onSuccess,
  onError,
}) {
  const [plan, setPlan] = useState(initialPlan || "premium");
  const [billingCycle, setBillingCycle] = useState(initialBillingCycle === "yearly" ? "yearly" : "monthly");
  const [couponDraft, setCouponDraft] = useState((initialCouponCode || "").toUpperCase());
  const [appliedCouponCode, setAppliedCouponCode] = useState((initialCouponCode || "").toUpperCase());
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quote, setQuote] = useState(null);
  const onErrorRef = useRef(onError);
  const quoteCacheRef = useRef(new Map());

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const refreshQuote = useCallback(async ({ force = false } = {}) => {
    const quoteKey = `${plan}:${billingCycle}:${appliedCouponCode || ""}`;
    const now = Date.now();
    const cachedQuote = quoteCacheRef.current.get(quoteKey);
    if (!force && cachedQuote && now - cachedQuote.timestamp < QUOTE_CACHE_TTL_MS) {
      setQuoteError("");
      setQuote(cachedQuote.value);
      setIsLoadingQuote(false);
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError("");

    try {
      const response = await fetchQuote(token, plan, billingCycle, appliedCouponCode);
      quoteCacheRef.current.set(quoteKey, { value: response, timestamp: now });
      setQuote(response);
    } catch (error) {
      const message = error?.message || "Could not calculate price right now.";
      setQuoteError(message);
      onErrorRef.current?.(message);
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [appliedCouponCode, billingCycle, fetchQuote, plan, token]);

  useEffect(() => {
    refreshQuote();
  }, [refreshQuote]);

  const handlePay = useCallback(async () => {
    setIsPaying(true);
    setQuoteError("");

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
        throw new Error("Could not load Razorpay checkout.");
      }

      const checkoutData = await createSession(token, plan, billingCycle, appliedCouponCode);

      const checkoutInstance = new window.Razorpay({
        key: checkoutData.keyId,
        order_id: checkoutData.orderId,
        amount: checkoutData.amount,
        currency: checkoutData.currency,
        name: checkoutData.name || "VivahGo",
        description: checkoutData.description || `${PLAN_LABELS[plan] || "Premium"} plan`,
        image: "/Thumbnail.png",
        prefill: checkoutData.prefill,
        notes: checkoutData.notes,
        theme: { color: "#bb4d28" },
        modal: {
          ondismiss: () => setIsPaying(false),
        },
        handler: async (response) => {
          try {
            await confirmPayment(token, {
              plan,
              billingCycle,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            onSuccess?.();
          } catch (error) {
            const message = error?.message || "Payment verification failed.";
            setQuoteError(message);
            onError?.(message);
          } finally {
            setIsPaying(false);
          }
        },
      });

      checkoutInstance.open();
    } catch (error) {
      const message = error?.message || "Could not start checkout.";
      setQuoteError(message);
      onError?.(message);
      setIsPaying(false);
    }
  }, [appliedCouponCode, billingCycle, confirmPayment, createSession, onError, onSuccess, plan, token]);

  const planLabel = PLAN_LABELS[plan] || "Premium";
  const amountLabel = useMemo(() => formatAmount(quote?.amount, quote?.currency), [quote]);
  const baseAmountLabel = useMemo(() => formatAmount(quote?.baseAmount, quote?.currency), [quote]);

  return (
    <main className="marketing-checkout-page-shell">
      <section className="marketing-checkout-page-card">
        <button type="button" className="marketing-checkout-page-back" onClick={onBack}>
          ← Back to pricing
        </button>

        <p className="marketing-checkout-kicker">Finalize Plan</p>
        <h1>{planLabel} plan checkout</h1>

        <div className="marketing-checkout-page-toggle-row">
          <div className="marketing-checkout-plan-toggle" role="group" aria-label="Checkout plan type">
            <button type="button" className={`marketing-checkout-plan-option${plan === "premium" ? " marketing-checkout-plan-option-active" : ""}`} onClick={() => setPlan("premium")} disabled={isLoadingQuote || isPaying}>Premium</button>
            <button type="button" className={`marketing-checkout-plan-option${plan === "studio" ? " marketing-checkout-plan-option-active" : ""}`} onClick={() => setPlan("studio")} disabled={isLoadingQuote || isPaying}>Studio</button>
          </div>
          <div className="marketing-checkout-cycle-toggle" role="group" aria-label="Checkout billing cycle">
            <button type="button" className={`marketing-checkout-cycle-option${billingCycle === "monthly" ? " marketing-checkout-cycle-option-active" : ""}`} onClick={() => setBillingCycle("monthly")} disabled={isLoadingQuote || isPaying}>Monthly</button>
            <button type="button" className={`marketing-checkout-cycle-option${billingCycle === "yearly" ? " marketing-checkout-cycle-option-active" : ""}`} onClick={() => setBillingCycle("yearly")} disabled={isLoadingQuote || isPaying}>Yearly</button>
          </div>
        </div>

        <ul className="marketing-checkout-page-perks">
          {(PLAN_PERKS[plan] || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="marketing-checkout-coupon-panel">
          <label className="marketing-checkout-coupon-label" htmlFor="checkout-page-coupon">Coupon code</label>
          <div className="marketing-checkout-coupon-row">
            <input
              id="checkout-page-coupon"
              className="marketing-checkout-coupon-input"
              type="text"
              value={couponDraft}
              onChange={(event) => setCouponDraft(event.target.value.toUpperCase())}
              disabled={isLoadingQuote || isPaying}
              placeholder="Enter coupon"
            />
            <button type="button" className="marketing-price-action marketing-price-action-featured" onClick={() => setAppliedCouponCode(couponDraft.trim().toUpperCase())} disabled={isLoadingQuote || isPaying || !couponDraft.trim()}>
              Apply
            </button>
          </div>
          {appliedCouponCode && quote?.appliedCoupon && (
            <div className="marketing-checkout-coupon-applied">
              <span>{quote.appliedCoupon.code} applied ({quote.appliedCoupon.discountPercent}% off)</span>
              <button type="button" onClick={() => { setCouponDraft(""); setAppliedCouponCode(""); }} disabled={isLoadingQuote || isPaying}>
                Remove
              </button>
            </div>
          )}
        </div>

        {isLoadingQuote ? (
          <div className="marketing-checkout-loading-block">
            <div className="marketing-checkout-spinner" aria-hidden="true" />
            <p>Calculating your price...</p>
          </div>
        ) : (
          <div className="marketing-checkout-loading-block">
            {quote?.appliedCoupon && amountLabel && baseAmountLabel ? (
              <div className="marketing-checkout-price-summary">
                <span>Original: {baseAmountLabel}</span>
                <strong>Discounted: {amountLabel}</strong>
              </div>
            ) : null}
            <p>{amountLabel ? `Amount due: ${amountLabel}` : "Amount unavailable."}</p>
            {quoteError && <p className="marketing-login-error">{quoteError}</p>}
            <div className="marketing-checkout-actions">
              <button type="button" className="marketing-price-action marketing-price-action-featured" onClick={handlePay} disabled={isPaying || isLoadingQuote || !quote} style={isPaying ? { opacity: 0.7, cursor: "not-allowed" } : undefined}>
                {isPaying ? "Opening..." : "Pay with Razorpay"}
              </button>
              <button type="button" className="marketing-price-action marketing-price-action-ghost" onClick={() => refreshQuote({ force: true })} disabled={isLoadingQuote || isPaying}>
                Refresh Price
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
