/**
 * ReaderPassLanyard — lazy 3D shell. Loads Lanyard.tsx (and thereby
 * three/rapier/drei/fiber) only on the client, after the guide desk
 * has settled. Handles the SVG-to-texture bridge and forwards the tap
 * callback. Pauses the frameloop when the tab is hidden.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import type { ReaderPassData } from "./useReaderPassData";
import { useReaderPassSvg } from "./useReaderPassSvg";

const Lanyard = lazy(() => import("./Lanyard"));

type Props = {
  data: ReaderPassData;
  onTap: () => void;
  paused?: boolean;
};

export function ReaderPassLanyard({ data, onTap, paused }: Props) {
  const { lang } = useLang();
  const { frontUrl, backUrl } = useReaderPassSvg(data, lang === "zh");

  // Only render Canvas once we have Blob URLs — avoids a first-frame
  // texture flash and gives useTexture stable inputs.
  const [visibilityPaused, setVisibilityPaused] = useState(false);
  useEffect(() => {
    const onVis = () => setVisibilityPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!frontUrl || !backUrl) {
    return <div className="h-full w-full" aria-hidden />;
  }

  return (
    <Suspense fallback={<div className="h-full w-full" aria-hidden />}>
      <Lanyard
        frontImage={frontUrl}
        backImage={backUrl}
        imageFit="cover"
        lanyardWidth={1.15}
        onCardTap={onTap}
        paused={paused || visibilityPaused}
      />
    </Suspense>
  );
}
