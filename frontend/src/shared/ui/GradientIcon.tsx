import type { LucideIcon } from "lucide-react";
import styles from "./GradientIcon.module.css";

export type GradientTone = "green" | "orange" | "pink" | "purple" | "cyan" | "blue";

/** Иконка в квадрате с градиентом — для выгод, плиток и разделов (VIBE-1). */
export function GradientIcon({ icon: Icon, tone, size = 44, className }: { icon: LucideIcon; tone: GradientTone; size?: number; className?: string }) {
  return (
    <span className={[styles.icon, styles[tone], className].filter(Boolean).join(" ")} style={{ "--size": `${size}px` } as React.CSSProperties} aria-hidden="true">
      <Icon size={Math.round(size * 0.5)} strokeWidth={2.4} />
    </span>
  );
}
