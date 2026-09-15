'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  webm: string;
  mp4: string;
  poster: string;
  className?: string;
  /** How far outside the viewport to start downloading. */
  rootMargin?: string;
};

/**
 * Muted, looping background video that costs nothing until it's needed.
 *
 * - No bytes are fetched until the element is actually on screen. A copy
 *   hidden by a breakpoint (`hidden md:block`) never intersects, so phones
 *   skip the desktop hero and desktops skip the mobile stack.
 * - The poster frame shows while loading, and stays put wherever autoplay is
 *   blocked (iOS Low Power Mode) or the visitor has Data Saver on — instead of
 *   an empty black box.
 * - Playback pauses while scrolled out of view.
 */
export default function BackgroundVideo({ webm, mp4, poster, className, rootMargin = '200px' }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          if (video.readyState > 0) video.play().catch(() => {});
        } else if (!video.paused) {
          video.pause();
        }
      },
      { rootMargin }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    const video = ref.current;
    if (!shouldLoad || !video) return;
    // React doesn't reliably reflect `muted` as a property, and browsers only
    // allow autoplay for muted video.
    video.muted = true;
    video.load();
    video.play().catch(() => {});
  }, [shouldLoad]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
      poster={poster}
      className={className}
    >
      {shouldLoad && (
        <>
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </>
      )}
    </video>
  );
}
