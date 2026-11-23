import { useEffect, useState } from "react";

export function useCountdown(running: boolean, totalSeconds: number) {
  const [left, setLeft] = useState(totalSeconds);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const reset = () => setLeft(totalSeconds);

  return { left, reset };
}
