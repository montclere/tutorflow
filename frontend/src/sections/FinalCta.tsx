import { landing } from "../content/landing.ru";
import { SignupCta } from "../features/signup/ui/SignupCta";
import { Object3D } from "../shared/decor/Object3D";
import { Scribble } from "../shared/decor/Scribble";
import { Lines } from "../shared/ui/Lines";
import styles from "./FinalCta.module.css";

const text = landing.final;

export function FinalCta() {
  return (
    <section className={styles.final} aria-labelledby="final-title">
      <Object3D name="alarm" className={styles.alarm} />
      <Object3D name="coin" className={styles.coin} />
      <Scribble variant="loop" className={styles.loop} />
      <h2 id="final-title" className={styles.title}>
        <span className={styles.hash} aria-hidden="true">
          {text.hash}
        </span>
        <Lines lines={text.titleLines} />
      </h2>
      <SignupCta place="final" label={text.cta} className={styles.cta} />
    </section>
  );
}
