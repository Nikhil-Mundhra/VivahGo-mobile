import { useCallback, useEffect, useRef } from "react";

/**
 * Spread the returned `modalProps` onto the `.modal` div.
 * Dragging the modal downward past `threshold` pixels calls `onClose`
 * without saving. Works correctly on mobile because touch listeners are
 * registered directly on the DOM with { passive: false }.
 */
export function useSwipeDown(onClose, threshold = 120) {
  const modalRef = useRef(null);
  const startY = useRef(null);
  const startTime = useRef(0);
  const tracking = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;

    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    const prevHtmlOverscroll = html.style.overscrollBehaviorY;
    body.style.overflow = "hidden";
    body.style.overscrollBehaviorY = "none";
    html.style.overscrollBehaviorY = "none";

    function resetGestureStyles() {
      el.style.transition = "";
      el.style.transform = "";
    }

    function onTouchStart(e) {
      if (el.scrollTop > 0) { tracking.current = false; return; }
      tracking.current = true;
      startY.current = e.touches[0].clientY;
      startTime.current = Date.now();
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
        resetGestureStyles();
      }
    }

    function onDocumentTouchMoveCapture(e) {
      if (!tracking.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) e.preventDefault();
    }

    function onTouchEnd(e) {
      if (!tracking.current || startY.current === null) return;
      const delta = e.changedTouches[0].clientY - startY.current;
      const elapsed = Date.now() - startTime.current;
      resetGestureStyles();
      tracking.current = false;
      if (delta > threshold || (delta > 80 && elapsed < 260)) onCloseRef.current();
      startY.current = null;
      startTime.current = 0;
    }

    function onTouchCancel() {
      tracking.current = false;
      startY.current = null;
      startTime.current = 0;
      resetGestureStyles();
    }

    function shouldIgnoreMouseTarget(target) {
      return Boolean(target?.closest("input, textarea, select, button"));
    }

    function onMouseDown(e) {
      if (e.button !== 0) return;
      if (shouldIgnoreMouseTarget(e.target)) return;
      if (el.scrollTop > 0) { tracking.current = false; return; }
      tracking.current = true;
      startY.current = e.clientY;
      startTime.current = Date.now();
      el.style.transition = "none";
      body.style.userSelect = "none";
    }

    function onMouseMove(e) {
      if (!tracking.current || startY.current === null) return;
      const delta = e.clientY - startY.current;
      if (delta > 0) {
        e.preventDefault();
        el.style.transform = `translateY(${delta}px)`;
      } else {
        tracking.current = false;
        resetGestureStyles();
        body.style.userSelect = "";
      }
    }

    function onMouseUp(e) {
      if (!tracking.current || startY.current === null) return;
      const delta = e.clientY - startY.current;
      const elapsed = Date.now() - startTime.current;
      resetGestureStyles();
      tracking.current = false;
      body.style.userSelect = "";
      if (delta > threshold || (delta > 80 && elapsed < 260)) onCloseRef.current();
      startY.current = null;
      startTime.current = 0;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onDocumentTouchMoveCapture, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onDocumentTouchMoveCapture, { capture: true });
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
      html.style.overscrollBehaviorY = prevHtmlOverscroll;
      body.style.userSelect = "";
    };
  }, [threshold]);

  const setRef = useCallback((node) => { modalRef.current = node; }, []);

  const modalProps = { ref: setRef };

  return { modalProps };
}

