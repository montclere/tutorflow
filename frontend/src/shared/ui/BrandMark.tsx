import styles from "./BrandMark.module.css";

/** Та же векторная айдентика для лендинга и кабинетов; ссылка задаётся вызывающим компонентом. */
export function BrandMark({ compactAt = 359 }: { compactAt?: number }) {
  return <picture className={styles.artwork}>
    <source media={`(max-width: ${compactAt}px)`} srcSet="/landing/assets/brand/tyutor-mark.svg" />
    <img src="/landing/assets/brand/tyutor-logo.svg" width="1390" height="290" alt="" aria-hidden="true" />
  </picture>;
}
