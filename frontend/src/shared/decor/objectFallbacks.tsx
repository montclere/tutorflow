import { useId } from "react";

function Coin() {
  const face = useId();
  const edge = useId();
  return (
    <svg viewBox="0 0 120 120">
      <defs>
        <radialGradient id={face} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="var(--color-art-lime-light)" />
          <stop offset=".55" stopColor="var(--color-lime)" />
          <stop offset="1" stopColor="var(--color-art-lime-dark)" />
        </radialGradient>
        <linearGradient id={edge} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--color-lime-shadow)" />
          <stop offset="1" stopColor="var(--color-art-lime-shade)" />
        </linearGradient>
      </defs>
      <g transform="rotate(-18 60 60)">
        <circle cx="60" cy="68" r="46" fill={`url(#${edge})`} />
        <circle cx="60" cy="58" r="46" fill={`url(#${face})`} />
        <circle cx="60" cy="58" r="35" fill="none" stroke="var(--color-lime-shadow)" strokeWidth="3" />
        <text
          x="60"
          y="74"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="900"
          fontSize="44"
          fill="var(--color-ink)"
        >
          ₽
        </text>
      </g>
    </svg>
  );
}

function CoinsStack() {
  const top = useId();
  return (
    <svg viewBox="0 0 120 120">
      <defs>
        <radialGradient id={top} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="var(--color-art-lime-light)" />
          <stop offset=".55" stopColor="var(--color-lime)" />
          <stop offset="1" stopColor="var(--color-art-lime-dark)" />
        </radialGradient>
      </defs>
      <g transform="rotate(12 60 60)">
        <ellipse cx="60" cy="84" rx="44" ry="16" fill="var(--color-art-lime-shade)" />
        <ellipse cx="60" cy="78" rx="44" ry="16" fill="var(--color-lime-shadow)" />
        <ellipse cx="60" cy="66" rx="44" ry="16" fill="var(--color-art-lime-shade)" />
        <ellipse cx="60" cy="60" rx="44" ry="16" fill="var(--color-art-lime-mid)" />
        <ellipse cx="60" cy="48" rx="44" ry="16" fill="var(--color-art-lime-shade)" />
        <ellipse cx="60" cy="42" rx="44" ry="16" fill={`url(#${top})`} />
      </g>
    </svg>
  );
}

function Calendar() {
  const sheet = useId();
  return (
    <svg viewBox="0 0 110 110">
      <defs>
        <linearGradient id={sheet} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-paper)" />
          <stop offset="1" stopColor="var(--color-art-paper-blue)" />
        </linearGradient>
      </defs>
      <g transform="rotate(8 55 55)">
        <rect x="14" y="22" width="82" height="76" rx="18" fill="var(--color-art-periwinkle)" />
        <rect x="14" y="16" width="82" height="76" rx="18" fill={`url(#${sheet})`} />
        <path d="M14 34a18 18 0 0 1 18-18h46a18 18 0 0 1 18 18v6H14z" fill="var(--color-lime)" />
        <rect x="34" y="8" width="8" height="20" rx="4" fill="var(--color-ink)" />
        <rect x="68" y="8" width="8" height="20" rx="4" fill="var(--color-ink)" />
        <text
          x="55"
          y="80"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="900"
          fontSize="32"
          fill="var(--color-blue)"
        >
          16
        </text>
      </g>
    </svg>
  );
}

function Plane() {
  return (
    <svg viewBox="0 0 100 80">
      <g transform="rotate(-10 50 40)">
        <path d="M6 38L92 8 70 70 46 50z" fill="var(--color-paper)" />
        <path d="M46 50L92 8 40 60z" fill="var(--color-blue-soft)" />
        <path d="M40 60l6-10 8 7z" fill="var(--color-art-plane-shade)" />
      </g>
    </svg>
  );
}

// В прототипе место будильника занимает тот же календарь: отдельной заглушки для него нет.
export const objectFallbacks = {
  coin: Coin,
  "coins-stack": CoinsStack,
  calendar: Calendar,
  plane: Plane,
  alarm: Calendar,
} as const;

export type ObjectName = keyof typeof objectFallbacks;
