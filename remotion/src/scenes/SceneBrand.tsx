import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CREAM, GOLD, GOLD_SOFT } from "../theme";
import { DISPLAY, BODY } from "../fonts";
import { RiseText, HairLine } from "../components/atoms";

/** Brand lockup — lands before second 5, the golden-15s promise. */
export const SceneBrand: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const halo = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(${40 + halo * 22}% ${38 + halo * 20}% at 50% 50%, rgba(232,200,122,0.20) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      {/* rotating astrolabe ring */}
      <div
        style={{
          position: "absolute",
          width: portrait ? 900 : 1020,
          height: portrait ? 900 : 1020,
          borderRadius: "50%",
          border: `1px solid ${GOLD_SOFT}33`,
          transform: `rotate(${frame * 0.22}deg) scale(${interpolate(halo, [0, 1], [0.8, 1])})`,
          opacity: 0.5,
          maskImage: "linear-gradient(180deg, rgba(0,0,0,1), rgba(0,0,0,0.1))",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: portrait ? 640 : 720,
          height: portrait ? 640 : 720,
          borderRadius: "50%",
          border: `1px dashed ${GOLD_SOFT}44`,
          transform: `rotate(${-frame * 0.35}deg)`,
          opacity: 0.45,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <RiseText delay={4}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: portrait ? 120 : 148,
              color: CREAM,
              letterSpacing: "0.08em",
              textShadow: "0 20px 90px rgba(0,0,0,0.8)",
            }}
          >
            命运图书馆
          </div>
        </RiseText>
        <HairLine delay={20} width={portrait ? 420 : 520} />
        <RiseText delay={24}>
          <div
            style={{
              fontFamily: BODY,
              fontSize: portrait ? 30 : 30,
              color: GOLD,
              letterSpacing: "0.58em",
              paddingLeft: "0.58em",
            }}
          >
            DESTINY LIBRARY
          </div>
        </RiseText>
        <div style={{ height: 10 }} />
        <RiseText delay={36}>
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 300,
              fontSize: portrait ? 32 : 30,
              color: "rgba(246,235,210,0.7)",
              letterSpacing: "0.16em",
            }}
          >
            四大古老体系 · 一位 AI 馆员 · 一份只属于你的读本
          </div>
        </RiseText>
      </div>
    </AbsoluteFill>
  );
};
