import { useEffect, useState } from "react";
import { landing } from "../content/landing.ru";
import { applyVisibility, shouldShowMobileCta } from "../features/signup/model/mobileCta";
import { SignupCta } from "../features/signup/ui/SignupCta";
import { FINAL_CTA_ID, HERO_CTA_ID, SIGNUP_SECTION_ID } from "../features/signup/ui/signupStart";
import styles from "./MobileCta.module.css";

const TARGET_IDS = [HERO_CTA_ID, SIGNUP_SECTION_ID, FINAL_CTA_ID];

function useMobileCtaVisible() {
  // До первого ответа наблюдателя кнопку не показываем: на первом экране уже есть CTA.
  // Без IntersectionObserver следить не за чем — показываем всегда.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    let onScreen = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      onScreen = applyVisibility(
        onScreen,
        entries.map((entry) => ({ id: entry.target.id, visible: entry.isIntersecting })),
      );
      setVisible(shouldShowMobileCta(onScreen));
    });
    for (const id of TARGET_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return visible;
}

export function MobileCta() {
  const visible = useMobileCtaVisible();
  return (
    <div className={styles.bar} data-visible={visible} inert={!visible}>
      <SignupCta place="mobile" label={landing.mobileCta} className={styles.cta} />
    </div>
  );
}
