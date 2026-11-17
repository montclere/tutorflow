import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "lime" | "ghost" | "outline" | "primary";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type ActionProps = ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonProps = (LinkProps | ActionProps) & { variant: Variant; children: ReactNode };

export function Button({ variant, className, children, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(" ");
  if (props.href !== undefined) {
    return (
      <a className={classes} {...(props as LinkProps)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...(props as ActionProps)}>
      {children}
    </button>
  );
}
