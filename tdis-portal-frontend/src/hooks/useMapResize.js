/**
 * @fileoverview Hook to resize the map when its container size changes.
 * Centralizes ResizeObserver logic used by OSATab and HMEDTab.
 */

import { useEffect } from 'react';

/**
 * Observes the map container and calls map.resize() when the container size changes.
 * Map refs are populated asynchronously after this effect mounts; ResizeObserver alone can miss
 * the first usable size, so we also schedule bounded delayed resizes after mount.
 *
 * @param {React.RefObject} mapRef - Ref to the Mapbox map instance
 * @param {React.RefObject} containerRef - Ref to the map container DOM element
 */
export function useMapResize(mapRef, containerRef) {
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    const safeResize = () => {
      try {
        if (mapRef.current) mapRef.current.resize();
      } catch {
        /* map destroyed */
      }
    };

    const resizeObserver = new ResizeObserver(safeResize);
    resizeObserver.observe(el);

    safeResize();
    const raf = requestAnimationFrame(safeResize);
    const timerA = window.setTimeout(safeResize, 120);
    const timerB = window.setTimeout(safeResize, 450);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timerA);
      window.clearTimeout(timerB);
      resizeObserver.disconnect();
    };
  }, [mapRef, containerRef]);
}
