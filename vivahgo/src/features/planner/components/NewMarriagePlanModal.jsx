import { useState } from "react";
import { MARRIAGE_TEMPLATES } from "../../../plannerDefaults.js";

export default function NewMarriagePlanModal({ onClose, onCreate }) {
  const [step, setStep] = useState("template"); // 'template' or 'details'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    bride: "",
    groom: "",
    date: "",
    venue: "",
    guests: "",
    budget: "",
  });

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    setStep("details");
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    if (!formData.bride.trim() || !formData.groom.trim()) {
      alert("Please enter both bride and groom names");
      return;
    }

    onCreate({
      ...formData,
      template: selectedTemplate || "blank",
    });
  };

  // Step 1: Choose template
  if (step === "template") {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 2000,
      }}>
        <div style={{
          width: "100%",
          background: "white",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "24px 20px",
          animation: "slideUp 0.3s ease",
        }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--color-crimson)",
              margin: "0 0 8px 0",
            }}>
              Plan Your New Marriage
            </h2>
            <p style={{
              fontSize: 13,
              color: "var(--color-light-text)",
              margin: 0,
            }}>
              Choose a template or start fresh
            </p>
          </div>

          {/* Template grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}>
            {Object.values(MARRIAGE_TEMPLATES).map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateSelect(template.id)}
                style={{
                  padding: 16,
                  border: "2px solid rgba(212, 175, 55, 0.2)",
                  borderRadius: 12,
                  background: "white",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-gold)";
                  e.currentTarget.style.background = "rgba(212, 175, 55, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(212, 175, 55, 0.2)";
                  e.currentTarget.style.background = "white";
                }}
              >
                <div style={{ fontSize: 28 }}>{template.emoji}</div>
                <div style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: "var(--color-crimson)",
                }}>
                  {template.name}
                </div>
                <div style={{
                  fontSize: 10,
                  color: "var(--color-light-text)",
                }}>
                  {template.description}
                </div>
                <div style={{
                  fontSize: 10,
                  color: "var(--color-mid-text)",
                  fontWeight: 600,
                }}>
                  {template.culture}
                </div>
                {template.eventCount > 0 && (
                  <div style={{
                    fontSize: 10,
                    color: "var(--color-crimson)",
                    lineHeight: 1.35,
                  }}>
                    {template.eventCount} events: {template.highlights.join(" • ")}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: 12,
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: 8,
              background: "white",
              color: "var(--color-light-text)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Enter details
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "flex-end",
      zIndex: 2000,
    }}>
      <div style={{
        width: "100%",
        background: "white",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: "24px 20px",
        maxHeight: "90vh",
        overflowY: "auto",
        animation: "slideUp 0.3s ease",
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--color-crimson)",
            margin: "0 0 8px 0",
          }}>
            Marriage Details
          </h2>
          <p style={{
            fontSize: 13,
            color: "var(--color-light-text)",
            margin: 0,
          }}>
            {MARRIAGE_TEMPLATES[selectedTemplate]?.name || "Basic Information"}
          </p>
        </div>

        {/* Form inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-crimson)",
              marginBottom: 6,
            }}>
              Bride's Name
            </label>
            <input
              type="text"
              placeholder="e.g. Aarohi"
              value={formData.bride}
              onChange={(e) => handleInputChange("bride", e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid rgba(212, 175, 55, 0.2)",
                borderRadius: 8,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-crimson)",
              marginBottom: 6,
            }}>
              Groom's Name
            </label>
            <input
              type="text"
              placeholder="e.g. Kabir"
              value={formData.groom}
              onChange={(e) => handleInputChange("groom", e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid rgba(212, 175, 55, 0.2)",
                borderRadius: 8,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-crimson)",
            marginBottom: 6,
          }}>
            Wedding Date
          </label>
          <input
            type="text"
            placeholder="e.g. 14 February 2027"
            value={formData.date}
            onChange={(e) => handleInputChange("date", e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: 8,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{
            display: "block",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-crimson)",
            marginBottom: 6,
          }}>
            Venue / Location
          </label>
          <input
            type="text"
            placeholder="e.g. Jaipur Palace"
            value={formData.venue}
            onChange={(e) => handleInputChange("venue", e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: 8,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-crimson)",
              marginBottom: 6,
            }}>
              Expected Guests
            </label>
            <input
              type="text"
              placeholder="e.g. 300"
              value={formData.guests}
              onChange={(e) => handleInputChange("guests", e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid rgba(212, 175, 55, 0.2)",
                borderRadius: 8,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-crimson)",
              marginBottom: 6,
            }}>
              Budget (₹)
            </label>
            <input
              type="text"
              placeholder="e.g. 50,00,000"
              value={formData.budget}
              onChange={(e) => handleInputChange("budget", e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid rgba(212, 175, 55, 0.2)",
                borderRadius: 8,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setStep("template")}
            style={{
              flex: 1,
              padding: 12,
              border: "1px solid rgba(212, 175, 55, 0.2)",
              borderRadius: 8,
              background: "white",
              color: "var(--color-light-text)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleCreate}
            style={{
              flex: 1,
              padding: 12,
              border: "none",
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--color-crimson), var(--color-deep-red))",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Create Plan
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            padding: 12,
            border: "none",
            borderRadius: 8,
            background: "transparent",
            color: "var(--color-light-text)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            marginTop: 12,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
