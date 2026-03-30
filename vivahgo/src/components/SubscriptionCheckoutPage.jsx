import { useCallback, useEffect, useMemo, useRef, useState } from "react";

let razorpayScriptPromise;
const QUOTE_CACHE_TTL_MS = 60000;

const PLAN_LABELS = {
  premium: "Premium",
  studio: "Studio",
};

const PLAN_PERKS = {
  premium: [
    "Unlimited wedding workspaces",
    "Personalized wedding website",
    "Real scheduled reminders",
    "Advanced workspace management",
  ],
  studio: [
    "Everything in Premium",
    "Client-ready workspaces",
    "Create custom templates",
    "Request for upto 2 custom features",
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
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDisplayDate(value) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getBillingDocumentMeta(receipt) {
  const isPaymentDue = receipt?.status === "payment_due";
  return {
    title: isPaymentDue ? "Bill" : "Receipt",
    statusLabel: isPaymentDue ? "Payment due" : "Paid",
    statusClassName: isPaymentDue
      ? "marketing-checkout-document-status-due"
      : "marketing-checkout-document-status-paid",
    totalLabel: isPaymentDue ? "Payment due" : "Amount paid",
    note: isPaymentDue
      ? "This bill reflects a full coupon adjustment, so Razorpay was skipped and no charge was collected."
      : "This receipt confirms the payment captured for your subscription.",
  };
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
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
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
    setGeneratedReceipt(null);

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

  useEffect(() => {
    setGeneratedReceipt(null);
  }, [plan, billingCycle, appliedCouponCode]);

  const handlePay = useCallback(async () => {
    setIsPaying(true);
    setQuoteError("");

    try {
      if (quote?.amount === 0) {
        const result = await confirmPayment(token, {
          plan,
          billingCycle,
          couponCode: appliedCouponCode,
        });
        setGeneratedReceipt(result?.receipt || null);
        onSuccess?.(result);
        setIsPaying(false);
        return;
      }

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
            const result = await confirmPayment(token, {
              plan,
              billingCycle,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              couponCode: appliedCouponCode,
            });
            onSuccess?.(result);
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
  }, [appliedCouponCode, billingCycle, confirmPayment, createSession, onError, onSuccess, plan, quote?.amount, token]);

  const planLabel = PLAN_LABELS[plan] || "Premium";
  const amountLabel = useMemo(() => formatAmount(quote?.amount, quote?.currency), [quote]);
  const baseAmountLabel = useMemo(() => formatAmount(quote?.baseAmount, quote?.currency), [quote]);
  const generatedReceiptMeta = useMemo(() => getBillingDocumentMeta(generatedReceipt), [generatedReceipt]);
  const hasGeneratedFreeBill = quote?.amount === 0 && Boolean(generatedReceipt?.receiptNumber);

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
          {appliedCouponCode && quote?.appliedCoupon ? (
            <div className="marketing-checkout-coupon-applied">
              <span>{quote.appliedCoupon.code} applied ({quote.appliedCoupon.discountPercent}% off)</span>
              <button type="button" onClick={() => { setCouponDraft(""); setAppliedCouponCode(""); }} disabled={isLoadingQuote || isPaying}>
                Remove
              </button>
            </div>
          ) : (
            <>
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
            </>
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
            <p>{amountLabel ? `${quote?.amount === 0 ? "Payment due" : "Amount due"}: ${amountLabel}` : "Amount unavailable."}</p>
            {quote?.amount === 0 ? (
              <p>Your coupon covers the full charge. We'll generate the bill instantly, show it here, and skip Razorpay.</p>
            ) : null}
            {generatedReceipt ? (
              <section className="marketing-checkout-document" aria-label="Generated bill">
                <div className="marketing-checkout-document-header">
                  <div>
                    <p className="marketing-checkout-document-kicker">VivahGo {generatedReceiptMeta.title}</p>
                    <h2>{generatedReceiptMeta.title} {generatedReceipt.receiptNumber}</h2>
                  </div>
                  <span className={`marketing-checkout-document-status ${generatedReceiptMeta.statusClassName}`}>
                    {generatedReceiptMeta.statusLabel}
                  </span>
                </div>

                <div className="marketing-checkout-document-grid">
                  <div>
                    <span>Issued on</span>
                    <strong>{formatDisplayDate(generatedReceipt.issuedAt)}</strong>
                  </div>
                  <div>
                    <span>Bill to</span>
                    <strong>{generatedReceipt.email || "Current account"}</strong>
                  </div>
                  <div>
                    <span>Plan</span>
                    <strong>{planLabel}</strong>
                  </div>
                  <div>
                    <span>Billing cycle</span>
                    <strong>{generatedReceipt.billingCycle === "yearly" ? "Yearly" : "Monthly"}</strong>
                  </div>
                </div>

                <div className="marketing-checkout-document-lines" role="table" aria-label="Bill summary">
                  <div className="marketing-checkout-document-line marketing-checkout-document-line-head" role="row">
                    <span role="columnheader">Description</span>
                    <span role="columnheader">Amount</span>
                  </div>
                  <div className="marketing-checkout-document-line" role="row">
                    <span role="cell">{planLabel} subscription</span>
                    <span role="cell">{formatAmount(generatedReceipt.baseAmount, generatedReceipt.currency)}</span>
                  </div>
                  <div className="marketing-checkout-document-line" role="row">
                    <span role="cell">
                      Coupon discount{generatedReceipt.couponCode ? ` (${generatedReceipt.couponCode})` : ""}
                    </span>
                    <span role="cell">-{formatAmount(generatedReceipt.baseAmount - generatedReceipt.amount, generatedReceipt.currency)}</span>
                  </div>
                  <div className="marketing-checkout-document-line marketing-checkout-document-line-total" role="row">
                    <span role="cell">{generatedReceiptMeta.totalLabel}</span>
                    <strong role="cell">{formatAmount(generatedReceipt.amount, generatedReceipt.currency)}</strong>
                  </div>
                </div>

                <div className="marketing-checkout-document-footer">
                  <p>{generatedReceiptMeta.note}</p>
                  <p>Access period through {formatDisplayDate(generatedReceipt.currentPeriodEnd)}.</p>
                </div>
              </section>
            ) : null}
            {quoteError && <p className="marketing-login-error">{quoteError}</p>}
            <div className="marketing-checkout-actions">
              <button type="button" className="marketing-price-action marketing-price-action-featured" onClick={handlePay} disabled={isPaying || isLoadingQuote || !quote || hasGeneratedFreeBill} style={isPaying || hasGeneratedFreeBill ? { opacity: 0.7, cursor: "not-allowed" } : undefined}>
                {isPaying ? (quote?.amount === 0 ? "Generating..." : "Opening...") : hasGeneratedFreeBill ? "Bill Generated" : (quote?.amount === 0 ? "Generate Bill" : "Pay with Razorpay")}
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
