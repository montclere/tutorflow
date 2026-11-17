import type { ReactNode } from "react";
import styles from "./GlassCard.module.css";

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={[styles.glass, className].filter(Boolean).join(" ")}>{children}</div>;
}
