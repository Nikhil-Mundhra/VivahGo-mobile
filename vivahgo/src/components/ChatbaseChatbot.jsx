import { useEffect } from "react";
import { CHATBASE_CHATBOT_ID, initializeChatbase, removeChatbaseArtifacts } from "../chatbase.js";

export default function ChatbaseChatbot({ enabled }) {
  useEffect(() => {
    if (enabled) {
      return initializeChatbase(CHATBASE_CHATBOT_ID);
    }

    removeChatbaseArtifacts(CHATBASE_CHATBOT_ID);
    return undefined;
  }, [enabled]);

  return null;
}
