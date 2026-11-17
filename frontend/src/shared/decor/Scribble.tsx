import styles from "./Scribble.module.css";

const variants = {
  loop: {
    viewBox: "0 0 150 110",
    width: 9,
    line: "M12 92c18-34 48-58 66-50s-8 34 10 34 30-30 46-56",
    arrow: "M118 14l18 6-6 18",
  },
  swirl: {
    viewBox: "0 0 150 120",
    width: 9,
    line: "M20 20c40-12 92 0 104 30s-30 52-52 40-4-36 22-34 34 22 34 44",
    arrow: "M114 96l14 10 8-16",
  },
  wave: {
    viewBox: "0 0 90 60",
    width: 8,
    line: "M8 40c10-22 22-30 30-18s-6 26 6 22 18-24 36-30",
    arrow: null,
  },
  curl: {
    viewBox: "0 0 150 110",
    width: 8,
    line: "M10 30c30-20 70-20 84 4s-20 40-34 26 10-34 40-30 34 30 36 50",
    arrow: "M124 70l12 14 10-16",
  },
} as const;

type ScribbleProps = {
  variant: keyof typeof variants;
  tone?: "lime" | "blue" | "ink";
  arrow?: boolean;
  className?: string;
};

export function Scribble({ variant, tone = "lime", arrow = false, className }: ScribbleProps) {
  const shape = variants[variant];
  return (
    <svg
      className={[styles.scribble, styles[tone], className].filter(Boolean).join(" ")}
      viewBox={shape.viewBox}
      strokeWidth={shape.width}
      aria-hidden="true"
      focusable="false"
    >
      <path d={shape.line} />
      {arrow && shape.arrow && <path d={shape.arrow} />}
    </svg>
  );
}
