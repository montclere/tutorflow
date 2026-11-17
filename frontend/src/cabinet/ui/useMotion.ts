import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { easeOutCubic, tween } from "../model/motion";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Плавно «досчитывает» число до нового значения; при reduced motion сразу показывает его. */
export function useCountUp(target: number, duration = 900): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const begin = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      current.current = tween(begin, target, easeOutCubic(progress));
      setValue(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return reduced ? target : value;
}
