import { useEffect, useRef } from "react";

const BACK_STATE_KEY = "__vivahgoModalToken";

/**
 * While `isOpen` is true, push a lightweight history entry so browser Back
 * closes the current form/modal before navigating away.
 */
export function useBackButtonClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  const tokenRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;

    const token = `modal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    tokenRef.current = token;

    window.history.pushState(
      { ...(window.history.state || {}), [BACK_STATE_KEY]: token },
      ""
    );

    function onPopState() {
      if (!tokenRef.current) return;
      tokenRef.current = null;
      onCloseRef.current?.();
    }

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      tokenRef.current = null;
    };
  }, [isOpen]);
}
