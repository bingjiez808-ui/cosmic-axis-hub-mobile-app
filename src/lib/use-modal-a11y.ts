import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Shared accessibility behaviour for hand-rolled dialogs:
 * - ESC closes (unless `closeOnEscape` is false, e.g. while a payment is in flight)
 * - Tab / Shift+Tab cycle focus inside the dialog (focus trap)
 * - focus moves into the dialog on open, and returns to the opener on close
 * - background scroll is locked while open
 *
 * Radix-based dialogs already do all of this — only use this for custom overlays.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(options: {
  open: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
  returnFocus?: HTMLElement | null;
}) {
  const { open, onClose, closeOnEscape = true, lockScroll = true, returnFocus } = options;
  const containerRef = useRef<T | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  const escapeRef = useRef(closeOnEscape);
  closeRef.current = onClose;
  escapeRef.current = closeOnEscape;

  const restoreFocus = useCallback(() => {
    const target = returnFocus ?? openerRef.current;
    if (target && typeof target.focus === "function" && document.contains(target)) {
      requestAnimationFrame(() => target.focus());
    }
  }, [returnFocus]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    openerRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      const node = containerRef.current;
      if (event.key === "Escape") {
        if (!escapeRef.current) return;
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const items = focusableIn(node);
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !node.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    const raf = requestAnimationFrame(() => {
      const node = containerRef.current;
      if (!node) return;
      if (node.contains(document.activeElement)) return;
      const items = focusableIn(node);
      (items[0] ?? node).focus?.();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      cancelAnimationFrame(raf);
      if (lockScroll) document.body.style.overflow = prevOverflow;
      restoreFocus();
    };
  }, [open, lockScroll, restoreFocus]);

  return containerRef;
}
