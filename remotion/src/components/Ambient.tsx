import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";

/** Full-video layer: candle-lit dust drifting through the archive. Deterministic per frame. */
export const DustLayer: React.FC<{ count?: number; seed?: string }> = ({ count = 46, seed = "dust" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const x = random(`${seed}-x-${i}`);
        const y0 = random(`${seed}-y-${i}`);
        const speed = 0.02 + random(`${seed}-s-${i}`) * 0.06;
        const size = 1.4 + random(`${seed}-r-${i}`) * 3.2;
        const sway = Math.sin((frame / 44) + i) * 1.6;
        const y = (y0 + frame * speed * 0.01) % 1;
        const twinkle = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(frame / 17 + i * 1.7));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x * 100 + sway}%`,
              top: `${(1 - y) * 100}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "rgba(255,232,178,0.9)",
              boxShadow: "0 0 10px rgba(232,200,122,0.8)",
              opacity: twinkle * 0.5,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Deep background: ink-blue archive gradient that slowly breathes. */
export const AmbientBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = 0.5 + 0.5 * Math.sin(frame / 90);
  return (
    <AbsoluteFill style={{ background: "#05050b" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(90% 70% at 50% ${18 + breathe * 6}%, rgba(60,52,96,0.55) 0%, rgba(12,12,24,0.9) 55%, #05050b 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 40% at ${20 + breathe * 8}% 80%, rgba(201,162,74,0.16) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: interpolate(frame % 900, [0, 450, 900], [0.1, 0.18, 0.1]),
          background:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 120px)",
        }}
      />
    </AbsoluteFill>
  );
};
