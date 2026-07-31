import { useEffect, useRef, useState } from "react";

/**
 * Reveal-on-scroll helper for the hall.
 * Returns a ref to attach to any element and a boolean that flips to true the
 * first time the element enters the viewport. Falls back to "visible" when
 * IntersectionObserver is unavailable (SSR, old browsers) so nothing is ever
 * stuck invisible.
 */
export function useInView<T extends HTMLElement>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, inView } as const;
}
