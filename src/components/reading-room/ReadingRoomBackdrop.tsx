import type { ReactNode } from "react";
import "./reading-room-backdrop.css";

export type ReadingRoomVariant =
  | "default"
  | "archive"
  | "systems"
  | "commons"
  | "personal"
  | "sage"
  | "oracle";

export type ReadingRoomBackdropProps = {
  variant?: ReadingRoomVariant;
  children: ReactNode;
  className?: string;
};

const TINTS: Record<ReadingRoomVariant, string> = {
  default: "rgba(91, 70, 40, 0.05)",
  archive: "rgba(104, 70, 32, 0.10)",
  systems: "rgba(32, 70, 58, 0.09)",
  commons: "rgba(91, 76, 42, 0.07)",
  personal: "rgba(30, 44, 70, 0.10)",
  sage: "rgba(100, 75, 35, 0.10)",
  oracle: "rgba(58, 43, 92, 0.12)",
};

/**
 * Static "reading room" backdrop used across non-home content pages.
 * Purely presentational: fixed background image + scrims below the content.
 */
export function ReadingRoomBackdrop({
  variant = "default",
  children,
  className,
}: ReadingRoomBackdropProps) {
  return (
    <div
      className={`rrb-root${className ? ` ${className}` : ""}`}
      style={{ ["--rrb-tint" as string]: TINTS[variant] }}
    >
      <div className="rrb-fallback" aria-hidden="true" />
      <picture className="rrb-picture" aria-hidden="true">
        <source
          media="(max-width: 767px)"
          srcSet="/images/reading-room-mobile.webp"
        />
        <img
          src="/images/reading-room-desktop.webp"
          alt=""
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      </picture>
      <div className="rrb-scrim" aria-hidden="true" />
      <div className="rrb-tint" aria-hidden="true" />
      <div className="rrb-reading-guard" aria-hidden="true" />
      <div className="rrb-grain" aria-hidden="true" />
      <div className="rrb-content">{children}</div>
    </div>
  );
}

/** Map a pathname to its reading-room variant, or null when excluded. */
export function readingRoomVariantForPath(
  pathname: string,
): ReadingRoomVariant | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  // Excluded: entrance/home hero video, ritual, dev harnesses
  if (p === "/" || p === "/ritual" || p.startsWith("/dev/")) return null;

  if (p === "/me/sage") return "sage";
  if (p === "/me/oracle") return "oracle";
  if (p.startsWith("/me")) return "personal";
  if (p === "/report" || p === "/synthesis") return "archive";
  if (p === "/traditions") return "systems";
  if (p.startsWith("/life-studies")) return "systems";
  if (p.startsWith("/commons")) return "systems";
  if (p.startsWith("/community")) return "commons";
  return "default";
}

export default ReadingRoomBackdrop;
