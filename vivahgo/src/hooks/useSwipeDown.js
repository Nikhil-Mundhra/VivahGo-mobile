import { useCallback, useEffect, useRef } from "react";

/**
 * Spread the returned `modalProps` onto the `.modal` div.
 * Dragging the modal downward past `threshold` pixels calls `onClose`
 * without saving. Works correctly on mobile because touch listeners are
 * registered directly on the DOM with { passive: false }.
 */
export function useSwipeDown(onClose, threshold = 80) {
  const modalRef = useRef(null);
  const startY = useRef(null);
  const tracking = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    function onTouchStart(e) {
      if (el.scrollTop > 0) { tracking.current = false; return; }
      tracking.current = true;
      startY.current = e.touches[0].clientY;
      el.style.transition = "none";
    }

    function onTouchMove(e) {
      if (!tracking.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        e.preventDefault();
        el.style.transform = `translateY(${delta}px)`;
      } else {
        tracking.current = false;
        el.style.transform = "";
        el.style.transition = "";
      }
    }

    function onTouchEnd(e) {
      if (!tracking.current || startY.current === null) return;
      const delta = e.changedTouches[0].clientY - startY.current;
      el.style.transition = "";
      el.style.transform = "";
      tracking.current = false;
      if (delta > threshold) onCloseRef.current();
      startY.current = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  });

  const setRef = useCallback((node) => { modalRef.current = node; }, []);

  const modalProps = { ref: setRef };

  return { modalProps };
}

