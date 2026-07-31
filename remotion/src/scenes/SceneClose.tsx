import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CREAM, GOLD, GOLD_SOFT } from "../theme";
import { DISPLAY, BODY } from "../fonts";
import { RiseText, HairLine } from "../components/atoms";

const TILES = [
  "shots/04-ritual-d.png",
  "shots/05-report-d.png",
  "shots/07-math-d.png",
  "shots/06-traditions-d.png",
  "shots/08-community-d.png",
  "shots/10-studies-d.png",
];

/** Close: rapid mosaic of everything, then the door line and the address. */
export const SceneClose: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mosaicOut = interpolate(frame, [34, 56], [1, 0.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = spring({ frame: frame - 58, fps, config: { damping: 14, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {/* mosaic of real product screens */}
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: portrait ? "1fr 1fr" : "1fr 1fr 1fr",
          gap: 18,
          padding: portrait ? 60 : 90,
          opacity: mosaicOut,
        }}
      >
        {TILES.map((t, i) => {
          const inP = interpolate(frame, [i * 4, i * 4 + 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: (v) => 1 - Math.pow(1 - v, 3),
          });
          return (
            <div
              key={t}
              style={{
                overflow: "hidden",
                borderRadius: 16,
                border: `1px solid ${GOLD_SOFT}33`,
                opacity: inP,
                transform: `translateY(${(1 - inP) * 40}px) scale(${0.94 + inP * 0.06})`,
              }}
            >
              <Img
                src={staticFile(t)}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 35%" }}
              />
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(4,4,10,0.55)" }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 2 }}>
        <RiseText delay={44}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: portrait ? 82 : 92,
              color: CREAM,
              textAlign: "center",
              lineHeight: 1.26,
              textShadow: "0 18px 80px rgba(0,0,0,0.85)",
            }}
          >
            推开门,让四位长老
            <br />
            同时看你一眼
          </div>
        </RiseText>
        <HairLine delay={58} width={portrait ? 380 : 460} />
        <div
          style={{
            marginTop: 18,
            padding: portrait ? "22px 52px" : "24px 60px",
            borderRadius: 999,
            border: `1px solid ${GOLD}88`,
            background: "rgba(232,200,122,0.08)",
            boxShadow: `0 0 ${30 + pulse * 40}px rgba(232,200,122,${0.12 + pulse * 0.16})`,
            transform: `scale(${0.9 + pulse * 0.1})`,
            fontFamily: BODY,
            fontSize: portrait ? 34 : 32,
            letterSpacing: "0.24em",
            color: GOLD,
          }}
        >
          cosmic-axis-hub.lovable.app
        </div>
        <RiseText delay={72}>
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 300,
              fontSize: portrait ? 26 : 24,
              color: "rgba(246,235,210,0.6)",
              letterSpacing: "0.2em",
              marginTop: 10,
            }}
          >
            免费开启仪式 · 综合解读永久免费
          </div>
        </RiseText>
      </div>
    </AbsoluteFill>
  );
};
