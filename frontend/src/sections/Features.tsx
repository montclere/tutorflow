import { landing } from "../content/landing.ru";
import { SectionHeading } from "../shared/ui/SectionHeading";
import { AiTile, BalanceTile, HomeworkTile, PaymentTile, ReportTile, TestsTile } from "./FeatureTiles";
import styles from "./Features.module.css";

const text = landing.features;

export function Features() {
  return (
    <section className={styles.section} id="features" aria-labelledby="features-title">
      <SectionHeading id="features-title" lines={text.titleLines} subtitle={text.subtitle} />
      <div className={styles.bento}>
        <AiTile />
        <BalanceTile />
        <HomeworkTile />
        <TestsTile />
        <ReportTile />
        <PaymentTile />
      </div>
    </section>
  );
}
