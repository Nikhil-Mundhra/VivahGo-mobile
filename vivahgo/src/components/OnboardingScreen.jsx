import { useState, useEffect, useRef } from "react";
import { QUESTIONS, AI_RESPONSES } from "../data";
import { validateOnboardingAnswer } from "../utils";

function OnboardingScreen({ onComplete }) {
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(-1);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [answers, setAnswers] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const chatRef = useRef();
  const inputRef = useRef();

  const addAI = (text) => {
    setMessages(m=>[...m,{role:"ai",text}]);
  };
  const addUser = (text) => {
    setMessages(m=>[...m,{role:"user",text}]);
  };

  useEffect(()=>{
    // Initial greeting
    setTimeout(()=>{
      setTyping(true);
      setTimeout(()=>{
        setTyping(false);
        addAI("Namaste! 🙏 I'm VivahGo AI, your personal wedding planning assistant. I'm so excited to help you plan your dream wedding! Let's start with a few quick questions.");
        setTimeout(()=>{
          setTyping(true);
          setTimeout(()=>{
            setTyping(false);
            setStep(0);
            addAI(QUESTIONS[0].q);
          },800);
        },800);
      },1500);
    },500);
  },[]);

  useEffect(()=>{
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  },[messages,typing]);

  async function handleSend() {
    if(!input.trim() || step < 0) return;

    const val = input.trim();

    // Validate the answer
    const validation = validateOnboardingAnswer(QUESTIONS[step].key, val);
    if (!validation.isValid) {
      setValidationError(validation.message);
      return;
    }

    // Clear any previous validation error
    setValidationError("");

    setInput("");
    addUser(val);
    setAnswers(a=>({...a,[QUESTIONS[step].key]:val}));

    if(step < QUESTIONS.length - 1) {
      setTyping(true);
      // Call Anthropic API for a personalized response
      setAiLoading(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:150,
            messages:[{role:"user",content:`You're a warm, enthusiastic Indian wedding planning AI called "VivahGo AI". The user just answered "${val}" for the question "${QUESTIONS[step].q}". Give a short (1 sentence), warm, celebratory acknowledgment of their answer, then naturally transition to this next question: "${QUESTIONS[step+1].q}". Be natural, warm and use 1-2 relevant emojis. Keep it under 40 words.`}]
          })
        });
        const data = await res.json();
        const aiText = data.content?.[0]?.text || (AI_RESPONSES[step] + QUESTIONS[step+1].q);
        setTyping(false);
        setAiLoading(false);
        addAI(aiText);
      } catch {
        setTyping(false);
        setAiLoading(false);
        addAI(AI_RESPONSES[step] + QUESTIONS[step+1].q);
      }
      setStep(s=>s+1);
    } else {
      // Last question answered
      setTyping(true);
      const finalAnswers = {...answers, [QUESTIONS[step].key]: val};
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:150,
            messages:[{role:"user",content:`You're VivahGo AI. The couple ${finalAnswers.bride} and ${finalAnswers.groom} just shared their wedding details. Give a warm, personalized 2-sentence welcome message congratulating them and saying you're ready to help plan their perfect wedding. Mention their names. Use 2-3 emojis. Max 50 words.`}]
          })
        });
        const data = await res.json();
        const text = data.content?.[0]?.text || `Congratulations ${finalAnswers.bride} & ${finalAnswers.groom}! 🎉 I'm so thrilled to help plan your perfect wedding. Let's make it magical! 💍✨`;
        setTimeout(()=>{
          setTyping(false);
          addAI(text);
          setTimeout(()=>onComplete(finalAnswers), 2500);
        },1200);
      } catch {
        setTimeout(()=>{
          setTyping(false);
          addAI(`Congratulations ${finalAnswers.bride} & ${finalAnswers.groom}! 🎉 I can't wait to help plan your perfect wedding. Let's dive in! 💍✨`);
          setTimeout(()=>onComplete(finalAnswers), 2500);
        },1200);
      }
    }
  }

  return (
    <div className="onboard">
      <div className="onboard-header">
        <div className="onboard-avatar">🤖</div>
        <div className="onboard-name">VivahGo AI</div>
        <div className="onboard-tagline">Your personal wedding planner</div>
      </div>
      <div className="chat-area" ref={chatRef}>
        {messages.map((m,i)=>(
          m.role==="ai"
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
      {step >= 0 && !typing && (
        <div className="chat-input-area">
          {validationError && (
            <div className="validation-error">
              ⚠️ {validationError}
            </div>
          )}
          <div className="chat-input-row">
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e=>{setInput(e.target.value); setValidationError("");}}
              onKeyDown={e=>e.key==="Enter"&&handleSend()}
              placeholder={step < QUESTIONS.length ? QUESTIONS[step].placeholder : "..."}
              autoFocus
            />
            <button className="chat-send-btn" onClick={handleSend}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnboardingScreen;