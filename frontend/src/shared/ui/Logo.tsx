import styles from "./Logo.module.css";

type LogoProps = { left: string; right: string; href: string; label: string };

export function Logo({ left, right, href, label }: LogoProps) {
  return (
    <a className={styles.logo} href={href} aria-label={label}>
      <span className={styles.left}>{left}</span>
      <span className={styles.right}>{right}</span>
    </a>
  );
}
