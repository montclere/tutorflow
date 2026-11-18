import { useEffect } from "react";
import { routes } from "../config/routes";
import { siteConfig } from "../config/site";
import { landing } from "../content/landing.ru";
import { Logo } from "../shared/ui/Logo";
import type { LegalDoc } from "./legal";
import styles from "./LegalPage.module.css";

const text = landing.legal;

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const { title, metaTitle } = text.docs[doc];

  useEffect(() => {
    const previous = document.title;
    document.title = metaTitle;
    return () => {
      document.title = previous;
    };
  }, [metaTitle]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo left={siteConfig.logo.left} right={siteConfig.logo.right} href={routes.home} label={landing.header.homeLabel} />
      </header>
      <main className={styles.main}>
        <a className={styles.back} href={routes.home}>
          {text.back}
        </a>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.pending}>{text.pending}</p>
      </main>
    </div>
  );
}
