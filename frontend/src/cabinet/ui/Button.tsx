import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import styles from "./ui.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "lime";
  size?: "md" | "sm";
};

export function Button({ variant = "default", size = "md", className, type = "button", ...rest }: Props) {
  return <button type={type} className={cx(styles.btn, styles[`btn-${variant}`], size === "sm" && styles.btnSm, className)} {...rest} />;
}

export function LinkButton({ onClick, children, className }: { onClick: () => void; children: string; className?: string }) {
  return (
    <button type="button" className={cx(styles.linkButton, className)} onClick={onClick}>
      {children}
    </button>
  );
}
