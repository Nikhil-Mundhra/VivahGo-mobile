export default function MarriagePlanSelector({
  marriages = [],
  activePlanId,
  onSwitchPlan,
  onCreatePlan,
  onDeletePlan,
  onConfigurePlan,
  onClose,
}) {
  const handleDeletePlan = (e, planId) => {
    e.stopPropagation();
    if (marriages.length <= 1) {
      alert("You must have at least one marriage plan");
      return;
    }
    if (confirm(`Delete "${marriages.find(m => m.id === planId)?.bride} & ${marriages.find(m => m.id === planId)?.groom}"?`)) {
      onDeletePlan(planId);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          background: "white",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "24px 20px",
          animation: "slideUp 0.3s ease",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--color-crimson)",
            margin: "0 0 8px 0",
          }}>
            Your Marriage Plans
          </h2>
          <p style={{
            fontSize: 13,
            color: "var(--color-light-text)",
            margin: 0,
          }}>
            Manage and switch between plans
          </p>
        </div>

        {/* Marriage plans list */}
        <div style={{ marginBottom: 24 }}>
          {marriages.map((plan) => (
            <div
              key={plan.id}
              onClick={() => {
                onSwitchPlan(plan.id);
                onClose();
              }}
              style={{
                padding: "16px",
                marginBottom: 12,
                cursor: "pointer",
                background: plan.id === activePlanId ? "rgba(212, 175, 55, 0.1)" : "rgba(212, 175, 55, 0.03)",
                border: plan.id === activePlanId ? "2px solid var(--color-gold)" : "2px solid rgba(212, 175, 55, 0.2)",
                borderRadius: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--color-crimson)",
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {plan.bride} & {plan.groom}
                </div>
                <div style={{
                  fontSize: 12,
                  color: "var(--color-light-text)",
                }}>
                  {plan.date ? `📅 ${plan.date}` : "Not scheduled"}
                </div>
                {plan.id === activePlanId && (
                  <div style={{
                    fontSize: 11,
                    color: "var(--color-gold)",
                    marginTop: 4,
                    fontWeight: 700,
                  }}>
                    Active plan
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigurePlan(plan.id);
                    onClose();
                  }}
                  style={{
                    background: "rgba(212, 175, 55, 0.1)",
                    border: "1px solid var(--color-gold)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    color: "var(--color-gold)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(212, 175, 55, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(212, 175, 55, 0.1)";
                  }}
                >
                  Configure
                </button>

                {marriages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleDeletePlan(e, plan.id)}
                    style={{
                      background: "rgba(139, 0, 0, 0.1)",
                      border: "1px solid rgba(139, 0, 0, 0.3)",
                      borderRadius: 6,
                      padding: "6px 12px",
                      color: "var(--color-deep-red)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(139, 0, 0, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(139, 0, 0, 0.1)";
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => {
              onCreatePlan();
              onClose();
            }}
            style={{
              flex: 1,
              padding: "14px 20px",
              background: "linear-gradient(135deg, var(--color-gold), rgba(212, 175, 55, 0.8))",
              border: "none",
              borderRadius: 10,
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            Create New Plan
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "14px 20px",
              background: "rgba(212, 175, 55, 0.1)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              borderRadius: 10,
              color: "var(--color-gold)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(212, 175, 55, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(212, 175, 55, 0.1)";
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
