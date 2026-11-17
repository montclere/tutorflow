import { landing } from "../content/landing.ru";
import { SignupCta } from "../features/signup/ui/SignupCta";
import styles from "./MobileCta.module.css";

export function MobileCta() {
  return <SignupCta place="mobile" label={landing.mobileCta} className={styles.cta} />;
}
