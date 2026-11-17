import { siteConfig } from "../config/site";
import { landing } from "../content/landing.ru";
import { Button } from "../shared/ui/Button";
import { Logo } from "../shared/ui/Logo";
import styles from "./Header.module.css";

const text = landing.header;

export function Header({ onLogin }: { onLogin: () => void }) {
  return (
    <header className={styles.header}>
      <Logo left={siteConfig.logo.left} right={siteConfig.logo.right} href="#top" label={text.homeLabel} />
      <nav className={styles.nav} aria-label={text.navLabel}>
        {text.nav.map((item) => (
          <a key={item.href} className={styles.link} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <Button variant="outline" onClick={onLogin}>
        {text.login}
      </Button>
    </header>
  );
}
