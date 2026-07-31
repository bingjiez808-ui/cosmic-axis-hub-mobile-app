import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CREAM, GOLD } from "../theme";
import { DISPLAY, BODY } from "../fonts";
import { RiseText } from "../components/atoms";

/**
 * Hook (0-3.5s): the archive at night, one line that names the viewer's question,
 * then the doors take the frame.
 */
export const SceneOpen: React.FC<{ portrait: boolean }> = ({ portrait }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const push = spring({ frame, fps, config: { damping: 200 }, durationInFrames: durationInFrames });
  const scale = interpolate(push, [0, 1], [1.22, 1.04]);
  const imgOpacity = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp" });
  const darken = interpolate(frame, [0, 30, durationInFrames - 18, durationInFrames], [1, 0.42, 0.42, 0.72]);

  return (
    <AbsoluteFill style={{ background: "#04040a" }}>
      <AbsoluteFill style={{ opacity: imgOpacity }}>
        <Img
          src={staticFile(portrait ? "shots/01-entrance-m.png" : "shots/01-entrance-d.png")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 42%",
            transform: `scale(${scale})`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(4,4,10,${darken})` }} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: portrait ? "0 90px" : "0 160px",
          textAlign: "center",
        }}
      >
        <RiseText delay={14}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 500,
              color: CREAM,
              fontSize: portrait ? 78 : 84,
              lineHeight: 1.28,
              letterSpacing: "0.02em",
              textShadow: "0 12px 60px rgba(0,0,0,0.8)",
            }}
          >
            深夜里那个问题,
          </div>
        </RiseText>
        <RiseText delay={30}>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              color: GOLD,
              fontSize: portrait ? 86 : 96,
              lineHeight: 1.28,
              letterSpacing: "0.02em",
              textShadow: "0 12px 60px rgba(0,0,0,0.85)",
            }}
          >
            你从没跟任何人说过。
          </div>
        </RiseText>
        <div style={{ height: 34 }} />
        <RiseText delay={52}>
          <div
            style={{
              fontFamily: BODY,
              fontWeight: 300,
              color: "rgba(246,235,210,0.78)",
              fontSize: portrait ? 34 : 32,
              letterSpacing: "0.22em",
            }}
          >
            这座图书馆,为它留了一页。
          </div>
        </RiseText>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
