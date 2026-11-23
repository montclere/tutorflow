import { routes } from "../config/routes";
import { landing } from "../content/landing.ru";
import { BrandMark } from "../shared/ui/BrandMark";
import styles from "./BrandLogo.module.css";

/** Публичный знак с буквами в SVG-контурах: не зависит от загрузки шрифтов. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return <a href={routes.home} className={`${styles.logo} ${className}`} aria-label={landing.header.publicHomeLabel}>
    <BrandMark />
  </a>;
}
