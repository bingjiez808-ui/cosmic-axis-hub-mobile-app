import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/lib/i18n";

/**
 * LibrarySplash — first-visit intro.
 * A darkened ancient library opens, dust particles are blown away,
 * and the ghost of a "past self" fades into view before the site appears.
 * Runs once per session (sessionStorage flag) and is skippable.
 */

const SPLASH_KEY = "lod.splash.seen.v1";

export function LibrarySplash() {
  // Splash intro disabled by user preference — return nothing.
  return null;
}

// Retain the rest of the module for potential future re-enable.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LibrarySplashArchived() {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_KEY) === "1";
    } catch {}
    if (seen) return;
    setVisible(true);
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {}
    document.body.style.overflow = "hidden";
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 2100);
    const t3 = setTimeout(() => setPhase(3), 3600);
    const t4 = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, 4400);
    return () => {
      [t1, t2, t3, t4].forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, []);

  const skip = () => {
    setPhase(3);
    setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, 600);
  };

  // Deterministic dust motes.
  const motes = useMemo(
    () =>
      Array.from({ length: 42 }).map((_, i) => ({
        x: (i * 37) % 100,
        y: (i * 71) % 100,
        d: 0.6 + ((i * 13) % 10) / 10,
        s: 2 + ((i * 7) % 6),
      })),
    [],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: phase >= 3 ? 0 : 1 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[100] overflow-hidden bg-[#07050a]"
        >
          {/* Warm candle glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, rgba(212,175,110,0.35) 0%, rgba(120,80,40,0.15) 30%, transparent 65%)",
            }}
          />

          {/* Library shelves silhouette */}
          <svg
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id="shelf-g" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#1a1108" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#050303" stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Two-door frame that parts open */}
            <motion.g
              initial={{ x: 0 }}
              animate={{ x: phase >= 1 ? -260 : 0 }}
              transition={{ duration: 1.4, ease: [0.32, 0.72, 0, 1] }}
            >
              <rect x="0" y="0" width="500" height="600" fill="url(#shelf-g)" />
              {Array.from({ length: 6 }).map((_, r) => (
                <g key={r}>
                  <line
                    x1="20"
                    x2="480"
                    y1={90 + r * 85}
                    y2={90 + r * 85}
                    stroke="#3a2a15"
                    strokeWidth="2"
                  />
                  {Array.from({ length: 9 }).map((_, c) => (
                    <rect
                      key={c}
                      x={30 + c * 50}
                      y={30 + r * 85}
                      width={38 + ((c * 7) % 10)}
                      height={55 + ((c * 11) % 10)}
                      rx="2"
                      fill={c % 2 === 0 ? "#2a1a0c" : "#3d2312"}
                      opacity="0.9"
                    />
                  ))}
                </g>
              ))}
            </motion.g>
            <motion.g
              initial={{ x: 0 }}
              animate={{ x: phase >= 1 ? 260 : 0 }}
              transition={{ duration: 1.4, ease: [0.32, 0.72, 0, 1] }}
            >
              <rect x="500" y="0" width="500" height="600" fill="url(#shelf-g)" />
              {Array.from({ length: 6 }).map((_, r) => (
                <g key={r}>
                  <line
                    x1="520"
                    x2="980"
                    y1={90 + r * 85}
                    y2={90 + r * 85}
                    stroke="#3a2a15"
                    strokeWidth="2"
                  />
                  {Array.from({ length: 9 }).map((_, c) => (
                    <rect
                      key={c}
                      x={530 + c * 50}
                      y={30 + r * 85}
                      width={38 + ((c * 5) % 10)}
                      height={55 + ((c * 13) % 10)}
                      rx="2"
                      fill={c % 2 === 0 ? "#3d2312" : "#2a1a0c"}
                      opacity="0.9"
                    />
                  ))}
                </g>
              ))}
            </motion.g>
          </svg>

          {/* Dust motes being blown */}
          <div className="pointer-events-none absolute inset-0">
            {motes.map((m, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: `${m.x}vw`, y: `${m.y}vh` }}
                animate={
                  phase >= 1
                    ? {
                        opacity: [0, 0.9, 0],
                        x: [`${m.x}vw`, `${m.x + 40}vw`, `${m.x + 80}vw`],
                        y: [`${m.y}vh`, `${m.y - 8}vh`, `${m.y - 20}vh`],
                      }
                    : { opacity: 0 }
                }
                transition={{ duration: m.s, delay: m.d, ease: "easeOut" }}
                className="absolute size-[3px] rounded-full bg-[#d4af6e]"
                style={{ filter: "blur(0.5px)" }}
              />
            ))}
          </div>

          {/* Past-self ghost */}
          <AnimatePresence>
            {phase >= 2 && phase < 3 && (
              <motion.div
                key="ghost"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
              >
                <svg
                  viewBox="0 0 200 240"
                  className="mx-auto h-52 w-44 opacity-70"
                  aria-hidden
                >
                  <defs>
                    <radialGradient id="ghost-g" cx="50%" cy="40%" r="60%">
                      <stop offset="0%" stopColor="#f4d896" stopOpacity="0.85" />
                      <stop offset="60%" stopColor="#d4af6e" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#d4af6e" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <ellipse cx="100" cy="90" rx="42" ry="52" fill="url(#ghost-g)" />
                  <path
                    d="M40,240 Q40,140 100,140 Q160,140 160,240 Z"
                    fill="url(#ghost-g)"
                    opacity="0.7"
                  />
                </svg>
                <p className="mt-6 font-serif text-lg italic text-[#e8c98a] md:text-xl">
                  {lang === "zh"
                    ? "翻开尘封的一页，遇见过去的自己。"
                    : "Turn the dust-worn page. Meet the you that came before."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
            }}
          />

          {/* Skip */}
          <button
            type="button"
            onClick={skip}
            className="absolute bottom-8 right-8 rounded-full border border-[#d4af6e]/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.32em] text-[#e8c98a]/80 transition-colors hover:border-[#d4af6e] hover:text-[#e8c98a]"
          >
            {lang === "zh" ? "跳过" : "Skip"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
