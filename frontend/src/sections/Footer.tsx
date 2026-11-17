import { landing } from "../content/landing.ru";
import styles from "./Footer.module.css";

const text = landing.footer;

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>{text.copyright}</span>
      <nav className={styles.nav} aria-label={text.navLabel}>
        {text.links.map((link) => (
          <a key={link.label} className={styles.link} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
