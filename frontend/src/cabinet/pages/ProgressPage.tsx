import { cabinet } from "../content/cabinet.ru";
import { getProgress, getTaskLab } from "../data";
import { Card } from "../ui/Card";
import { NumberGrid } from "../ui/NumberGrid";
import { useNotifier } from "../ui/Notifications";
import { PageHead } from "../ui/PageHead";
import { StatGrid } from "../ui/Stat";
import ui from "../ui/ui.module.css";

const text = cabinet.student.progress;

export function ProgressPage() {
  const { notifySoon } = useNotifier();
  const { stats, levels } = getProgress();
  const numbers = getTaskLab().numbers;

  return (
    <>
      <PageHead title={text.title} subtitle={text.subtitle} />
      <StatGrid stats={stats} columns={3} />
      <div className={ui.gap}>
        <Card title={text.mapTitle} subtitle={text.mapSub}>
          <NumberGrid
            cells={levels.map((level, index) => ({
              number: index + 1,
              caption: cabinet.levels[level] ?? "",
              level,
            }))}
            onPick={(number) => notifySoon(`№${number} · ${numbers.find((item) => item.number === number)?.topic ?? ""}`)}
          />
        </Card>
      </div>
    </>
  );
}
