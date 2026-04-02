function getRuntimeEnv() {
  if (typeof import.meta !== "undefined" && import.meta?.env) {
    return import.meta.env;
  }

  return {};
}

const runtimeEnv = getRuntimeEnv();

const CHATBASE_SCRIPT_ID = "chatbase-script";

function readFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export const CHATBASE_CHATBOT_ID = readFirstNonEmpty(
  runtimeEnv.VITE_CHATBASE_CHATBOT_ID,
  runtimeEnv.VITE_CHATBASE_CHATBOT_CHATBOT_ID,
  runtimeEnv.NEXT_PUBLIC_CHATBASE_CHATBOT_ID,
  runtimeEnv.NEXT_PUBLIC_CHATBASE_CHATBOT_CHATBOT_ID,
);

export const CHATBASE_HOST = readFirstNonEmpty(
  runtimeEnv.VITE_CHATBASE_HOST,
  runtimeEnv.NEXT_PUBLIC_CHATBASE_HOST,
  runtimeEnv.NEXT_PUBLIC_CHATBASE_CHATBOT_CHATBASE_HOST,
  "https://www.chatbase.co/",
);

export function shouldShowChatbaseForRoute(routeInfo = {}) {
  return Boolean(routeInfo?.isMarketingHomeRoute || routeInfo?.isPricingRoute || routeInfo?.queryPageSlug);
}

export function removeChatbaseArtifacts(chatbotId) {
  if (typeof document === "undefined") {
    return;
  }

  document.getElementById(CHATBASE_SCRIPT_ID)?.remove();

  if (chatbotId) {
    document.getElementById(chatbotId)?.remove();
  }

  document.querySelectorAll('iframe[src*="chatbase.co"]').forEach((node) => node.remove());
  document.querySelectorAll('[id^="chatbase-"], [class*="chatbase"]').forEach((node) => node.remove());
}

export function initializeChatbase(chatbotId) {
  if (!chatbotId || typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }

  if (!window.chatbase || window.chatbase("getState") !== "initialized") {
    const queueingChatbase = (...args) => {
      if (!queueingChatbase.q) {
        queueingChatbase.q = [];
      }
      queueingChatbase.q.push(args);
    };

    window.chatbase = new Proxy(queueingChatbase, {
      get(target, prop) {
        if (prop === "q") {
          return target.q;
        }
        return (...args) => target(prop, ...args);
      },
    });
  }

  const onLoad = () => {
    if (document.getElementById(CHATBASE_SCRIPT_ID)) {
      return;
    }

    window.chatbaseConfig = { chatbotId };

    const script = document.createElement("script");
    script.src = new URL("embed.min.js", CHATBASE_HOST).toString();
    script.id = CHATBASE_SCRIPT_ID;
    script.setAttribute("chatbotId", chatbotId);
    script.setAttribute("domain", "www.chatbase.co");
    script.domain = "www.chatbase.co";
    script.defer = true;
    document.body.appendChild(script);
  };

  if (document.readyState === "complete") {
    onLoad();
    return undefined;
  }

  window.addEventListener("load", onLoad);
  return () => {
    window.removeEventListener("load", onLoad);
  };
}
