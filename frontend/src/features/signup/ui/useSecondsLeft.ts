import { useEffect, useState } from "react";

export function useSecondsLeft(timestamp: number) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}
