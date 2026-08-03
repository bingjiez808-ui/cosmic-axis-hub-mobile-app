/**
 * Abstract "fate bookmark" SVG glyphs. Purely presentational — the
 * chosen glyph is derived from `glyphFor(alias)` and cannot be
 * inverted to a user_id.
 */
import type { BookmarkGlyph } from "./bookmark";

type Props = {
  glyph: BookmarkGlyph;
  size?: number;
  className?: string;
  title?: string;
};

export function BookmarkGlyphIcon({ glyph, size = 22, className, title }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
  };
  const label = title ? <title>{title}</title> : null;
  switch (glyph) {
    case "star":
      return (
        <svg {...common}>
          {label}
          <path d="M12 3l2.4 5.5 5.9.6-4.5 4 1.3 5.9L12 16l-5.1 3 1.3-5.9-4.5-4 5.9-.6L12 3z" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          {label}
          <path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z" />
        </svg>
      );
    case "feather":
      return (
        <svg {...common}>
          {label}
          <path d="M20 4c-6 0-13 4-13 12v4M20 4c0 6-3 11-9 12M8 14h8" />
        </svg>
      );
    case "door":
      return (
        <svg {...common}>
          {label}
          <path d="M7 3h10v18H7zM14 12h.01" />
        </svg>
      );
    case "lamp":
      return (
        <svg {...common}>
          {label}
          <path d="M12 3v3M6 12a6 6 0 1112 0c0 3-2 4-2 6H8c0-2-2-3-2-6zM10 21h4" />
        </svg>
      );
    case "tree":
      return (
        <svg {...common}>
          {label}
          <path d="M12 21v-6M8 15h8M12 3l4 6H8l4-6zM10 9h4l2 3h-8l2-3z" />
        </svg>
      );
    case "tide":
      return (
        <svg {...common}>
          {label}
          <path d="M3 14c3-3 6 3 9 0s6-3 9 0M3 18c3-3 6 3 9 0s6-3 9 0M3 10c3-3 6 3 9 0s6-3 9 0" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          {label}
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12h9M17 12v4M20 12v3" />
        </svg>
      );
  }
}
