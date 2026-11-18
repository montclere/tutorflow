import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { landing } from "../content/landing.ru";
import { scrollEdges } from "../shared/lib/carousel";
import { SectionHeading } from "../shared/ui/SectionHeading";
import styles from "./Testimonials.module.css";

const text = landing.testimonials;
const TONES = ["lime", "blue", "mist"] as const;

// Примеры отзывов не показываем на живом сайте (LANDING-9): только в режиме разработки, для оценки макета.
const visible = !text.sample || import.meta.env.DEV;

function useCarousel() {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const update = () => {
    const element = track.current;
    if (element) setEdges(scrollEdges(element.scrollLeft, element.clientWidth, element.scrollWidth));
  };

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setEdges(scrollEdges(element.scrollLeft, element.clientWidth, element.scrollWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Листаем на ширину одной карточки с отступом — дальше её выровняет scroll-snap.
  const step = (direction: 1 | -1) => {
    const element = track.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (!element || !card) return;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: "smooth" });
  };

  return { track, edges, update, step };
}

export function Testimonials() {
  const { track, edges, update, step } = useCarousel();
  if (!visible) return null;

  return (
    <section className={styles.section} id="reviews" aria-labelledby="reviews-title">
      <div className={styles.head}>
        <SectionHeading id="reviews-title" lines={text.titleLines} />
        <div className={styles.controls}>
          <button type="button" className={styles.arrow} aria-label={text.prev} disabled={edges.atStart} onClick={() => step(-1)}>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" className={styles.arrow} aria-label={text.next} disabled={edges.atEnd} onClick={() => step(1)}>
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul ref={track} className={styles.track} aria-label={text.carouselLabel} onScroll={update}>
        {text.items.map((item, index) => (
          <li key={item.name} className={`${styles.card} ${styles[TONES[index % TONES.length] ?? "mist"]}`}>
            <figure className={styles.figure}>
              <p className={styles.highlight}>{item.highlight}</p>
              <blockquote className={styles.quote}>
                <p>{item.quote}</p>
              </blockquote>
              <figcaption className={styles.author}>
                <span className={styles.avatar} aria-hidden="true">
                  {item.initials}
                </span>
                <span>
                  <b className={styles.name}>{item.name}</b>
                  <small className={styles.role}>{item.role}</small>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
