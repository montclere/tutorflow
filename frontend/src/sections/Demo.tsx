import { env } from "../config/env";
import { routes } from "../config/routes";
import { landing } from "../content/landing.ru";
import { Button } from "../shared/ui/Button";
import { Lines } from "../shared/ui/Lines";
import { Tag } from "../shared/ui/Tag";
import styles from "./Demo.module.css";

const text = landing.demo;
const SHOT = { src: "/demo/teacher-overview.webp", width: 1920, height: 1200 };

export function Demo() {
  return (
    <section className={styles.section} id="demo" aria-labelledby="demo-title">
      <div className={styles.copy}>
        <Tag>{text.tag}</Tag>
        <h2 id="demo-title" className={styles.title}>
          <Lines lines={text.titleLines} />
        </h2>
        <p className={styles.lead}>{text.lead}</p>
        <Button variant="ghost" href={env.demoUrl ?? routes.teacherCabinet}>
          {text.cta}
        </Button>
      </div>
      <figure className={styles.frame}>
        <img
          className={styles.shot}
          src={SHOT.src}
          width={SHOT.width}
          height={SHOT.height}
          alt={text.imageAlt}
          loading="lazy"
          decoding="async"
        />
      </figure>
    </section>
  );
}
