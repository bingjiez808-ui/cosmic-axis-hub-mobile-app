import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { AmbientBackdrop, DustLayer } from "./components/Ambient";
import { Grain, Vignette } from "./components/atoms";
import { SceneOpen } from "./scenes/SceneOpen";
import { SceneBrand } from "./scenes/SceneBrand";
import { SceneBeat } from "./scenes/SceneBeat";
import { SceneClose } from "./scenes/SceneClose";
import { BEATS } from "./theme";

const T = 14; // transition overlap

export const OPEN_D = 100;
export const BRAND_D = 78;
export const CLOSE_D = 120;

/** total = sum(scenes) - transitions * overlap */
export const TOTAL =
  OPEN_D + BRAND_D + BEATS.reduce((a, b) => a + b.duration, 0) + CLOSE_D - (BEATS.length + 2) * T;

export const MainVideo: React.FC<{ portrait?: boolean }> = ({ portrait = false }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05050b" }}>
      <AmbientBackdrop />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={OPEN_D}>
          <SceneOpen portrait={portrait} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={BRAND_D}>
          <SceneBrand portrait={portrait} />
        </TransitionSeries.Sequence>

        {BEATS.map((beat, i) => (
          <React.Fragment key={beat.id}>
            <TransitionSeries.Transition
              presentation={
                i % 2 === 0 ? wipe({ direction: "from-bottom" }) : fade()
              }
              timing={springTiming({ config: { damping: 200 }, durationInFrames: T })}
            />
            <TransitionSeries.Sequence durationInFrames={beat.duration}>
              <SceneBeat beat={beat} portrait={portrait} index={i} />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={CLOSE_D}>
          <SceneClose portrait={portrait} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <DustLayer count={portrait ? 34 : 48} />
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};
