/**
 * ScrollStack — lightweight React Bits-style card-stack container.
 *
 * Behaviour:
 *   - Each child <ScrollStackItem/> is position: sticky. As the user
 *     scrolls, the following card slides over the previous one, so the
 *     bottom of each card stays visible as a "page edge" (20-28px on
 *     desktop, less on mobile).
 *   - We do NOT nest another scroll container. Main page scroll owns
 *     everything, so refresh restores position and touch scrolling is
 *     never hijacked.
 *   - We add a subtle scale/brightness ramp based on how far above the
 *     viewport-top the card has been pushed. Zero rotation.
 *   - prefers-reduced-motion → sticky + scale disabled; cards render as a
 *     normal vertical list.
 *
 * Progress:
 *   - Each item exposes an id so a companion progress-rail can scroll to
 *     it. The container calls onActiveChange when the intersected item
 *     changes (top ~35% of viewport).
 */
import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

export type ScrollStackItemProps = {
  id: string;
  index: number;
  total: number;
  children: ReactNode;
};

export function ScrollStackItem({
  id,
  index,
  total,
  children,
}: ScrollStackItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 800;
        // How far this card has been pushed above the viewport top by the
        // next sticky sibling. Positive when card starts leaving the top.
        const stickyTop = index * 24; // matches --stack-top-offset math below
        const pushed = Math.max(0, stickyTop - rect.top);
        const t = Math.min(1, pushed / (vh * 0.6));
        const scale = 1 - t * 0.04;
        const brightness = 1 - t * 0.12;
        el.style.setProperty("--stack-scale", scale.toFixed(4));
        el.style.setProperty("--stack-brightness", brightness.toFixed(4));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [index]);

  const stickyTop = `calc(6vh + ${index * 24}px)`;

  return (
    <div
      ref={ref}
      id={id}
      data-stack-index={index}
      className="scroll-stack-item"
      style={{
        position: "sticky",
        top: stickyTop,
        zIndex: 10 + index,
        // Fallback if the item doesn't set --stack-scale yet.
        transform: "scale(var(--stack-scale, 1))",
        filter: "brightness(var(--stack-brightness, 1))",
        transition: "transform 120ms linear, filter 120ms linear",
        marginBottom: index === total - 1 ? "12vh" : "clamp(24px, 6vh, 60px)",
        willChange: "transform, filter",
      }}
    >
      {children}
    </div>
  );
}

export type ScrollStackProps = {
  children: ReactNode;
  onActiveChange?: (id: string, index: number) => void;
};

export function ScrollStack({ children, onActiveChange }: ScrollStackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(() => {
    const arr: ReactElement<ScrollStackItemProps>[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement<ScrollStackItemProps>(child)) arr.push(child);
    });
    return arr;
  }, [children]);

  useEffect(() => {
    if (!onActiveChange) return;
    const root = containerRef.current;
    if (!root) return;
    if (typeof window === "undefined") return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLDivElement>("[data-stack-index]")
    );
    let currentId: string | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        // Choose the topmost card whose top is above the viewport threshold.
        let best: { id: string; index: number; top: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLDivElement;
          const idx = Number(el.dataset.stackIndex);
          const id = el.id;
          const top = entry.boundingClientRect.top;
          if (!best || top > best.top) best = { id, index: idx, top };
        }
        if (best && best.id !== currentId) {
          currentId = best.id;
          onActiveChange(best.id, best.index);
        }
      },
      {
        // Top ~35% band — corresponds to the sticky reading zone.
        rootMargin: "-35% 0px -55% 0px",
        threshold: 0.01,
      }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [onActiveChange, items.length]);

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full max-w-[1320px] px-4 sm:px-6"
    >
      {items.map((child, i) =>
        // Re-inject index/total so authors don't repeat themselves.
        isValidElement(child)
          ? // eslint-disable-next-line react/no-array-index-key
            <ScrollStackItem
              key={child.props.id}
              id={child.props.id}
              index={i}
              total={items.length}
            >
              {child.props.children}
            </ScrollStackItem>
          : null
      )}
    </div>
  );
}
