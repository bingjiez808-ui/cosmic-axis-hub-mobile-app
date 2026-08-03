/**
 * SageAvatar — the project's canonical "elder/sage" mark.
 * Purple turban, gold halo, calm eyes. Rendered as inline SVG so it
 * scales freely, respects currentColor accents via CSS vars, and can
 * be reused as a floating orb, an account row icon, or a card mascot.
 *
 * Do NOT introduce a raster image URL for this asset — the whole app
 * shares this single vector so identity stays consistent.
 */
export function SageAvatar({
  className,
  glow = true,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <span
      className={`relative inline-grid place-items-center ${className ?? ""}`}
      aria-hidden="true"
    >
      {glow && (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--gold-dust) 45%, transparent) 0%, transparent 65%)",
          }}
        />
      )}
      <svg viewBox="0 0 64 64" className="relative h-[70%] w-[70%]" aria-hidden="true">
        <defs>
          <linearGradient id="sage-robe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--gold-light) 80%, transparent)" />
            <stop offset="100%" stopColor="color-mix(in oklab, var(--gold-dust) 20%, transparent)" />
          </linearGradient>
        </defs>
        <path
          d="M12 60 C 16 44, 20 38, 32 38 C 44 38, 48 44, 52 60 Z"
          fill="url(#sage-robe)"
          opacity="0.85"
        />
        <path
          d="M22 34 C 24 46, 28 52, 32 54 C 36 52, 40 46, 42 34 Z"
          fill="color-mix(in oklab, var(--stone-warm) 85%, transparent)"
          opacity="0.9"
        />
        <circle
          cx="32"
          cy="26"
          r="9"
          fill="color-mix(in oklab, var(--gold-light) 70%, transparent)"
        />
        <path
          d="M20 26 C 22 14, 30 10, 32 10 C 34 10, 42 14, 44 26 Z"
          fill="color-mix(in oklab, var(--nebula-purple) 60%, transparent)"
        />
        <path
          d="M32 15 l1 2.5 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.2 -1.3 l-2.2 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3 z"
          fill="var(--gold-light)"
        />
        <circle cx="29" cy="26" r="0.9" fill="var(--obsidian)" />
        <circle cx="35" cy="26" r="0.9" fill="var(--obsidian)" />
      </svg>
    </span>
  );
}
