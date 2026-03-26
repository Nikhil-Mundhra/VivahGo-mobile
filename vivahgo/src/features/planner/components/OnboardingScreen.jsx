import { useEffect, useMemo, useRef, useState } from "react";
import { MARRIAGE_TEMPLATES } from "../../../plannerDefaults";
import { POPULAR_WEDDING_LOCATIONS } from "../../../locationOptions";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];


function OnboardingScreen({ onComplete }) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const STEPS = [
    { key: "template", label: "Wedding Template", emoji: "🪔", prompt: "First, pick a wedding template to pre-load the right ceremonies and tasks." },
    { key: "couple",   label: "The Couple",       emoji: "💑", prompt: "Who's getting married? Add the names — or skip and fill them in later." },
    { key: "date",     label: "The Date",         emoji: "📅", prompt: "When's the big day? Even a rough month and year helps with planning." },
    { key: "venue",    label: "The Venue",        emoji: "📍", prompt: "Where will the celebrations be? Choose what you know and skip the rest." },
    { key: "details",  label: "The Details",      emoji: "✨", prompt: "Last one! A rough idea of guests and budget helps build your plan." },
  ];

  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    template: "blank",
    bride: "", groom: "",
    dateDay: "", dateMonth: "", dateYear: "",
    country: "", state: "", city: "",
    guests: "", budget: "",
  });
  const [typing, setTyping] = useState(false);
  const chatRef = useRef();

  const addAI = (text) => setMessages(m => [...m, { role: "ai", text }]);
  const addUser = (text) => setMessages(m => [...m, { role: "user", text }]);

  const isUaeSelected = form.country === "UAE";
  const years = useMemo(() => Array.from({ length: 10 }, (_, i) => String(today.getFullYear() + i)), [today]);
  const templateOptions = useMemo(() => Object.values(MARRIAGE_TEMPLATES), []);
  const selectedYear = Number(form.dateYear);
  const selectedMonthIndex = MONTHS.indexOf(form.dateMonth);
  const maxDayForMonth = selectedYear > 0 && selectedMonthIndex >= 0
    ? new Date(selectedYear, selectedMonthIndex + 1, 0).getDate()
    : 31;

  const availableMonths = useMemo(() => {
    if (!form.dateYear) return MONTHS;
    const currentYear = today.getFullYear();

    if (selectedYear > currentYear) {
      return MONTHS;
    }

    return MONTHS.slice(today.getMonth());
  }, [form.dateYear, selectedYear, today]);

  const availableDays = useMemo(() => {
    const allDays = Array.from({ length: maxDayForMonth }, (_, i) => String(i + 1));

    if (!form.dateYear || selectedMonthIndex < 0) {
      return allDays;
    }

    const isCurrentMonthOfCurrentYear = selectedYear === today.getFullYear() && selectedMonthIndex === today.getMonth();
    if (!isCurrentMonthOfCurrentYear) {
      return allDays;
    }

    return allDays.filter(day => Number(day) > today.getDate());
  }, [form.dateYear, maxDayForMonth, selectedMonthIndex, selectedYear, today]);
  const states = useMemo(() => {
    if (!form.country || form.country === "UAE") return [];
    return Object.keys(POPULAR_WEDDING_LOCATIONS[form.country] || {});
  }, [form.country]);
  const cities = useMemo(() => {
    if (!form.country) return [];
    if (form.country === "UAE") return Object.keys(POPULAR_WEDDING_LOCATIONS.UAE || {});
    if (!form.state) return [];
    return POPULAR_WEDDING_LOCATIONS[form.country]?.[form.state] || [];
  }, [form.country, form.state]);

  useEffect(() => {
    if (form.dateMonth && !availableMonths.includes(form.dateMonth)) {
      setForm(current => ({ ...current, dateMonth: "", dateDay: "" }));
    }
  }, [availableMonths, form.dateMonth]);

  useEffect(() => {
    if (form.dateDay && !availableDays.includes(form.dateDay)) {
      setForm(current => ({ ...current, dateDay: "" }));
    }
  }, [availableDays, form.dateDay]);

  function updateForm(field, value) {
    setForm(current => {
      if (field === "country") return { ...current, country: value, state: "", city: "" };
      if (field === "state") return { ...current, state: value, city: "" };
      return { ...current, [field]: value };
    });
  }

  function formatDateFromParts(day, month, year) {
    if (!day && !month && !year) return "";
    return [day, month, year].filter(Boolean).join(" ");
  }

  useEffect(() => {
    const t1 = setTimeout(() => {
      addAI("Namaste! 🙏 Let's set up your planner in a few quick steps. Every field is optional — add only what you know right now.");
    }, 400);
    const t2 = setTimeout(() => {
      addAI(STEPS[0].prompt);
    }, 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  function getSummaryForStep(s) {
    switch (s) {
      case 0: {
        const selectedTemplate = MARRIAGE_TEMPLATES[form.template]?.name || "Start Fresh";
        return `${selectedTemplate} template`;
      }
      case 1: {
        const parts = [form.bride.trim(), form.groom.trim()].filter(Boolean);
        return parts.length ? parts.join(" & ") : "Skipped";
      }
      case 2: {
        const d = formatDateFromParts(form.dateDay, form.dateMonth, form.dateYear);
        return d || "Skipped";
      }
      case 3: {
        const parts = [form.city, form.state, form.country].filter(Boolean);
        return parts.length ? parts.join(", ") : "Skipped";
      }
      case 4: {
        const parts = [];
        if (form.guests.trim()) parts.push(`${form.guests} guests`);
        if (form.budget.trim()) parts.push(`₹${form.budget} budget`);
        return parts.length ? parts.join(", ") : "Skipped";
      }
      default: return "Skipped";
    }
  }

  function handleNext() {
    addUser(getSummaryForStep(step));
    if (step < STEPS.length - 1) {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        addAI(STEPS[step + 1].prompt);
        setStep(s => s + 1);
      }, 700);
    } else {
      handleComplete();
    }
  }

  async function handleComplete() {
    const date = formatDateFromParts(form.dateDay, form.dateMonth, form.dateYear);
    const location = [form.city, form.state, form.country].filter(Boolean).join(", ");
    const finalAnswers = {
      template: form.template,
      bride: form.bride.trim(),
      groom: form.groom.trim(),
      date,
      venue: location,
      guests: form.guests.trim(),
      budget: form.budget.trim(),
      country: form.country,
      state: form.state,
      city: form.city,
    };

    setTyping(true);

    try {
      const nameSummary = [finalAnswers.bride, finalAnswers.groom].filter(Boolean).join(" & ") || "you";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: `You're VivahGo AI. Write a warm 2-sentence welcome for ${nameSummary}. Mention that the form details are saved and they can edit anything later. Keep under 45 words with 1-2 emojis.`,
          }],
        }),
      });
      const data = await response.json();
      const welcomeText = data.content?.[0]?.text;
      if (welcomeText) {
        setTyping(false);
        addAI(welcomeText);
        setTimeout(() => onComplete(finalAnswers), 1100);
        return;
      }
    } catch {
      // fall through to default
    }

    setTyping(false);
    addAI("Perfect, your planner is ready! You can fill or edit every detail anytime from Account & Settings. ✨");
    setTimeout(() => onComplete(finalAnswers), 1000);
  }

  const currentStep = STEPS[step];

  return (
    <div className="onboard">
      <div className="onboard-header">
        <img src="/Thumbnail.png" alt="VivahGo" className="login-logo-image" style={{ width: "50%", margin: "0 auto" }} />
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, paddingBottom: 10 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{
            height: 6,
            width: i === step ? 28 : 8,
            borderRadius: 3,
            background: i < step
              ? "var(--color-gold)"
              : i === step
                ? "var(--color-crimson)"
                : "rgba(139,26,26,0.15)",
            transition: "all 0.35s ease",
          }} />
        ))}
      </div>

      <div className="chat-area" ref={chatRef}>
        {messages.map((m, i) => (
          m.role === "ai"
            ? <div className="msg-ai" key={i}><span className="msg-ai-icon">✨</span><div className="msg-ai-bubble">{m.text}</div></div>
            : <div className="msg-user" key={i}><div className="msg-user-bubble">{m.text}</div></div>
        ))}
        {typing && (
          <div className="msg-ai">
            <span className="msg-ai-icon">✨</span>
            <div className="msg-ai-bubble">
              <div className="typing-indicator">
                <div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/>
              </div>
            </div>
          </div>
        )}
      </div>

      {!typing && (
        <div className="chat-input-area">
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: currentStep.key === "template" ? "var(--color-gold)" : "var(--color-crimson)",
            marginBottom: 12,
          }}>
            {currentStep.emoji} {currentStep.label}
          </div>

          {/* Step 0: Template */}
          {step === 0 && (
            <div className="onboard-form-field">
              <select className="chat-input onboard-form-select" value={form.template} onChange={e => updateForm("template", e.target.value)}>
                {templateOptions.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.emoji} {template.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 12, color: "var(--color-gold)", marginTop: 6 }}>
                {MARRIAGE_TEMPLATES[form.template]?.description || "Create a blank planning canvas"}
              </div>
            </div>
          )}

          {/* Step 1: Couple */}
          {step === 1 && (
            <>
              <div className="onboard-form-grid">
                <div className="onboard-form-field">
                  <div className="onboard-form-label">Bride&apos;s Name</div>
                  <input className="chat-input onboard-form-input" value={form.bride} onChange={e => updateForm("bride", e.target.value)} placeholder="e.g. Aarohi" />
                </div>
                <div className="onboard-form-field">
                  <div className="onboard-form-label">Groom&apos;s Name</div>
                  <input className="chat-input onboard-form-input" value={form.groom} onChange={e => updateForm("groom", e.target.value)} placeholder="e.g. Kabir" />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Date */}
          {step === 2 && (
            <div className="onboard-date-row">
              <select className="chat-input onboard-form-select" value={form.dateDay} onChange={e => updateForm("dateDay", e.target.value)}>
                <option value="">Day</option>
                {availableDays.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="chat-input onboard-form-select" value={form.dateMonth} onChange={e => updateForm("dateMonth", e.target.value)}>
                <option value="">Month</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="chat-input onboard-form-select" value={form.dateYear} onChange={e => updateForm("dateYear", e.target.value)}>
                <option value="">Year</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Step 3: Venue / Location */}
          {step === 3 && (
            <>
              <div className="onboard-form-field">
                <div className="onboard-form-label">Country</div>
                <select className="chat-input onboard-form-select" value={form.country} onChange={e => updateForm("country", e.target.value)}>
                  <option value="">Select country</option>
                  {Object.keys(POPULAR_WEDDING_LOCATIONS).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="onboard-form-grid" style={{ marginTop: 10 }}>
                {!isUaeSelected && (
                  <div className="onboard-form-field">
                    <div className="onboard-form-label">State</div>
                    <select className="chat-input onboard-form-select" value={form.state} onChange={e => updateForm("state", e.target.value)} disabled={!states.length}>
                      <option value="">Select state</option>
                      {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div className="onboard-form-field">
                  <div className="onboard-form-label">City</div>
                  <select className="chat-input onboard-form-select" value={form.city} onChange={e => updateForm("city", e.target.value)} disabled={!cities.length}>
                    <option value="">Select city</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 4: Details */}
          {step === 4 && (
            <div className="onboard-form-grid">
              <div className="onboard-form-field">
                <div className="onboard-form-label">Expected Guests</div>
                <input className="chat-input onboard-form-input" value={form.guests} onChange={e => updateForm("guests", e.target.value)} placeholder="e.g. 300" />
              </div>
              <div className="onboard-form-field">
                <div className="onboard-form-label">Budget</div>
                <input className="chat-input onboard-form-input" value={form.budget} onChange={e => updateForm("budget", e.target.value)} placeholder="e.g. 50,00,000" />
              </div>
            </div>
          )}

          <div className="chat-input-row" style={{ marginTop: 14 }}>
            <input
              className="chat-input"
              value="All fields are optional — skip anything you like."
              readOnly
            />
            <button className="chat-send-btn" onClick={handleNext}>
              {step < STEPS.length - 1 ? "→" : "➤"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnboardingScreen;
