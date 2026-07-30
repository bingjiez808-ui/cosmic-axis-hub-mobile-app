/**
 * LibraryInteriorBackdrop — the fixed video/poster background that shows
 * behind the Guide Desk hero and the seven Scroll Stack cards after the
 * user opens the library doors.
 *
 * - Fixed, full-viewport, pointer-events: none. Does not remount on scroll.
 * - Chooses desktop / mobile source once, based on matchMedia.
 * - Video errors → hides <video>, keeps poster.
 * - prefers-reduced-motion → renders poster only.
 * - Adds three readability layers on top of the media:
 *   1. top + bottom deep gradients
 *   2. black-gold semi-transparent tint
 *   3. subtle vignette (readability behind cards further via card blur)
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import desktopVideo from "@/assets/library-interior/library-interior-desktop.mp4.asset.json";
import mobileVideo from "@/assets/library-interior/library-interior-mobile.mp4.asset.json";
import desktopPoster from "@/assets/library-interior/library-interior-desktop-poster.webp.asset.json";
import mobilePoster from "@/assets/library-interior/library-interior-mobile-poster.webp.asset.json";

export function LibraryInteriorBackdrop() {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mMobile = window.matchMedia("(max-width: 640px)");
    const mReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsMobile(mMobile.matches);
    setReducedMotion(mReduced.matches);
    const onMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const onReduced = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mMobile.addEventListener?.("change", onMobile);
    mReduced.addEventListener?.("change", onReduced);
    return () => {
      mMobile.removeEventListener?.("change", onMobile);
      mReduced.removeEventListener?.("change", onReduced);
    };
  }, []);

  const media = useMemo(
    () =>
      isMobile
        ? { video: mobileVideo.url, poster: mobilePoster.url }
        : { video: desktopVideo.url, poster: desktopPoster.url },
    [isMobile]
  );

  // Pause video when tab hidden — saves battery and prevents ghost decoding.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onVis = () => {
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reducedMotion, videoError]);

  const showVideo = !reducedMotion && !videoError;

  // Mobile: gently scale the media up from the top edge so the library
  // interior stays centred and the frame always overflows the viewport,
  // whatever the aspect ratio. No letterbox, no hard seam under the nav.
  const mediaClass = "absolute inset-0 h-full w-full object-cover";
  const mediaStyle: CSSProperties = isMobile
    ? { objectPosition: "50% 42%", transform: "scale(1.12)", transformOrigin: "center top" }
    : { objectPosition: "50% 45%" };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      data-testid="library-interior-backdrop"
    >
      {showVideo ? (
        <video
          ref={videoRef}
          key={media.video}
          src={media.video}
          poster={media.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoError(true)}
          className={mediaClass}
          style={{ ...mediaStyle, zIndex: 0 }}
        />
      ) : (
        <img src={media.poster} alt="" className={mediaClass} style={{ ...mediaStyle, zIndex: 0 }} />
      )}
      {/* Layer 1 — soft bottom hand-off into the page, only a light top vignette.
          Never an opaque band under the fixed nav. */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,6,10,0.08) 0%, rgba(5,6,10,0.12) 58%, rgba(5,6,10,0.58) 88%, rgba(5,6,10,0.96) 100%)",
        }}
      />
      {/* Layer 2 — black-gold tint (kept translucent for legibility) */}
      <div className="absolute inset-0 z-[1] bg-black/28" />
      <div
        className="absolute inset-0 z-[1] opacity-25"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 40%, rgba(220,180,90,0.14), transparent 60%), linear-gradient(180deg, rgba(15,10,20,0.20), rgba(10,8,18,0.38))",
        }}
      />
      {/* Layer 3 — subtle vignette */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 50%, transparent 58%, rgba(0,0,0,0.48) 100%)",
        }}
      />
    </div>
  );
}
