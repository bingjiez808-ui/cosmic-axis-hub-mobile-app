import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CREAM, GOLD, GOLD_SOFT } from "../theme";

export const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.14,
      mixBlendMode: "overlay",
      backgroundImage:
        "radial-gradient(rgba(255,255,255,0.35) 0.5px, transparent 0.6px), radial-gradient(rgba(0,0,0,0.5) 0.5px, transparent 0.6px)",
      backgroundSize: "3px 3px, 5px 5px",
      backgroundPosition: "0 0, 2px 1px",
    }}
  />
);

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.9) 100%)",
    }}
  />
);

/** Text that rises out of a clipping mask and sharpens — the one entrance we reuse everywhere. */
export const RiseText: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
  distance?: number;
}> = ({ delay = 0, children, style, distance = 0.42 }) => {
  const frame = useCurrentFrame() - delay;
  const p = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.12em" }}>
      <div
        style={{
          transform: `translateY(${(1 - p) * distance * 100}%)`,
          opacity: p,
          filter: `blur(${(1 - p) * 8}px)`,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Slow ken-burns screenshot inside a lit glass plate. */
export const ShotPlate: React.FC<{
  src: string;
  focus: { x: number; y: number };
  zoomFrom?: number;
  zoomTo?: number;
  drift?: number;
  radius?: number;
  style?: React.CSSProperties;
}> = ({ src, focus, zoomFrom = 1.14, zoomTo = 1.02, drift = -14, radius = 22, style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(t, [0, 1], [zoomFrom, zoomTo]);
  const y = interpolate(t, [0, 1], [0, drift]);
  const reveal = interpolate(frame, [0, 26], [0, 1], {
    extrapolateRight: "clamp",
    easing: (v) => 1 - Math.pow(1 - v, 3),
  });

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        border: `1px solid ${GOLD_SOFT}44`,
        boxShadow: `0 40px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(232,200,122,0.08), 0 0 90px rgba(232,200,122,${0.07 * reveal})`,
        clipPath: `inset(${(1 - reveal) * 46}% 0% 0% 0% round ${radius}px)`,
        opacity: 0.35 + 0.65 * reveal,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${focus.x * 100}% ${focus.y * 100}%`,
          transform: `scale(${scale}) translateY(${y}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(7,7,13,0.35) 0%, rgba(7,7,13,0) 25%, rgba(7,7,13,0) 62%, rgba(7,7,13,0.72) 100%)",
        }}
      />
      {/* light sweep across the glass */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,246,222,0.16) 50%, rgba(255,255,255,0) 60%)",
          transform: `translateX(${interpolate(frame, [0, 46], [-120, 120], {
            extrapolateRight: "clamp",
          })}%)`,
          opacity: 0.9,
        }}
      />
    </div>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; delay?: number; font: string }> = ({
  children,
  delay = 0,
  font,
}) => (
  <RiseText delay={delay} distance={0.9}>
    <div
      style={{
        fontFamily: font,
        color: GOLD,
        letterSpacing: "0.42em",
        fontSize: 22,
        textTransform: "uppercase",
        opacity: 0.9,
      }}
    >
      {children}
    </div>
  </RiseText>
);

export const HairLine: React.FC<{ delay?: number; width?: number }> = ({ delay = 0, width = 220 }) => {
  const frame = useCurrentFrame() - delay;
  const p = interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        width: width * p,
        height: 1,
        background: `linear-gradient(90deg, ${GOLD}, ${CREAM}00)`,
        opacity: 0.8,
      }}
    />
  );
};
