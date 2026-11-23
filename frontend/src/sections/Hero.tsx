import { Play } from "lucide-react";
import { env } from "../config/env";
import { routes } from "../config/routes";
import { landing } from "../content/landing.ru";
import { SignupCta } from "../features/signup/ui/SignupCta";
import { HERO_CTA_ID } from "../features/signup/ui/signupStart";
import { Object3D } from "../shared/decor/Object3D";
import { RotatingBadge } from "../shared/decor/RotatingBadge";
import { Scribble } from "../shared/decor/Scribble";
import { Button } from "../shared/ui/Button";
import { Lines } from "../shared/ui/Lines";
import { HeroCards } from "./HeroCards";
import styles from "./Hero.module.css";

const text = landing.hero;

export function Hero() {
  return (
    <section className={styles.hero} id="top">
      <Object3D name="coin" className={styles.coin} eager />
      <Object3D name="plane" className={styles.plane} eager />
      <Object3D name="calendar" className={styles.calendar} eager />
      <Scribble variant="wave" className={styles.wave} />
      <Scribble variant="loop" arrow className={styles.loop} />
      <Scribble variant="swirl" arrow className={styles.swirl} />

      <h1 className={styles.headline}>
        <span className={styles.hash} aria-hidden="true">
          {text.hash}
        </span>
        <Lines lines={text.titleLines} />
      </h1>

      <HeroCards />
      <RotatingBadge text={text.badge} className={styles.badge} />

      <div className={styles.sub}>
        <p className={styles.subtitle}>{text.subtitle}</p>
        <div className={styles.actions}>
          <span className={styles.ctaWrap}>
            <SignupCta id={HERO_CTA_ID} place="hero" label={text.cta} />
            <span className={styles.sticker} aria-hidden="true">
              {text.sticker}
            </span>
          </span>
          <Button variant="ghost" href={env.demoUrl ?? routes.teacherCabinet}>
            <span className={styles.play} aria-hidden="true">
              <Play size={12} fill="currentColor" />
            </span>
            {text.demo}
          </Button>
        </div>
      </div>
    </section>
  );
}
