import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Beat } from "../theme";
import { CREAM, GOLD } from "../theme";
import { DISPLAY, BODY } from "../fonts";
import { Kicker, RiseText, ShotPlate, HairLine } from "../components/atoms";

/** Feature beat: one screenshot, one promise. Landscape = split; portrait = stacked. */
export const SceneBeat: React.FC<{ beat: Beat; portrait: boolean; index: number }> = ({
  beat,
  portrait,
  index,
}) => {
  const frame = useCurrentFrame();
  const parallax = interpolate(frame, [0, 90], [22, -10], { extrapolateRight: "clamp" });
  const flip = index % 2 === 1;

  const copy = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        transform: `translateY(${parallax * 0.25}px)`,
      }}
    >
      <Kicker delay={6} font={BODY}>
        {beat.kicker}
      </Kicker>
      <HairLine delay={10} width={portrait ? 240 : 200} />
      <RiseText delay={14}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: portrait ? 68 : 62,
            lineHeight: 1.24,
            color: CREAM,
            letterSpacing: "0.01em",
            textShadow: "0 14px 60px rgba(0,0,0,0.75)",
          }}
        >
          {beat.title}
        </div>
      </RiseText>
      <RiseText delay={26}>
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 300,
            fontSize: portrait ? 32 : 28,
            lineHeight: 1.6,
            color: "rgba(246,235,210,0.72)",
            letterSpacing: "0.06em",
          }}
        >
          {beat.sub}
        </div>
      </RiseText>
    </div>
  );

  if (portrait) {
    return (
      <AbsoluteFill style={{ padding: "150px 82px 170px", justifyContent: "space-between" }}>
        <div style={{ transform: `translateY(${parallax * 0.2}px)` }}>{copy}</div>
        <ShotPlate
          src={beat.shotM}
          focus={beat.focus}
          radius={30}
          zoomFrom={1.16}
          zoomTo={1.02}
          style={{ width: "100%", height: 980 }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        padding: "0 120px",
        flexDirection: flip ? "row-reverse" : "row",
        alignItems: "center",
        gap: 84,
      }}
    >
      <div style={{ width: 620, flexShrink: 0 }}>{copy}</div>
      <ShotPlate
        src={beat.shotD}
        focus={beat.focus}
        radius={22}
        zoomFrom={1.15}
        zoomTo={1.01}
        style={{ flex: 1, height: 720, transform: `translateY(${parallax * -0.12}px)` }}
      />
      <div
        style={{
          position: "absolute",
          [flip ? "right" : "left"]: 120,
          bottom: 92,
          fontFamily: BODY,
          fontSize: 22,
          letterSpacing: "0.4em",
          color: GOLD,
          opacity: 0.35,
        }}
      >
        DESTINY LIBRARY
      </div>
    </AbsoluteFill>
  );
};
