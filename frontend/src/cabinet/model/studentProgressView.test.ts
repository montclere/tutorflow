import { describe, expect, it } from "vitest";
import type { Unit } from "../tasks/progress";
import type { HomeworkPoint } from "./studentTasks";
import { filterProgressUnits, weakProgressPreview, weeklyProgress } from "./studentProgressView";

const unit = (key: string, level: Unit["level"]): Unit => ({ key, label: key, points: 1, correct: 0, total: 0, level });
const point = (date: string, correct: number, total: number): HomeworkPoint => ({ date, title: date, correct, total, percent: total ? Math.round(correct / total * 100) : 0 });

describe("STUDENT-PROGRESS-UI-1/2: отображение прогресса", () => {
  it("фильтры соответствуют текстовым уровням, все включает хорошие и без данных", () => {
    const units = [unit("weak", 0), unit("medium", 1), unit("good", 2), unit("mastered", 3), unit("unknown", null)];
    expect(filterProgressUnits(units, "all")).toEqual(units);
    expect(filterProgressUnits(units, "weak").map(item => item.key)).toEqual(["weak"]);
    expect(filterProgressUnits(units, "medium").map(item => item.key)).toEqual(["medium"]);
    expect(filterProgressUnits(units, "mastered").map(item => item.key)).toEqual(["mastered"]);
    expect(units.map(item => item.key)).toEqual(["weak", "medium", "good", "mastered", "unknown"]);
  });
  it("считает долю ответов недели, а не средний процент работ", () => {
    expect(weeklyProgress([point("2026-11-03", 1, 1), point("2026-11-05", 0, 9)])).toEqual([{ week: "2026-11-02", correct: 1, total: 10, percent: 10, works: 2 }]);
  });
  it("разделяет воскресенье и понедельник по локальной неделе, сортирует без мутации", () => {
    const points = [point("2026-11-09", 9, 10), point("2026-11-08", 5, 10)];
    expect(weeklyProgress(points).map(item => [item.week, item.percent])).toEqual([["2026-11-02", 50], ["2026-11-09", 90]]);
    expect(points.map(item => item.date)).toEqual(["2026-11-09", "2026-11-08"]);
  });
  it("берёт шесть последних недель, не заполняя отсутствующие периоды", () => {
    const dates = ["2026-08-03", "2026-08-10", "2026-08-24", "2026-09-07", "2026-09-14", "2026-10-05", "2026-11-02"];
    expect(weeklyProgress(dates.map(date => point(date, 1, 2))).map(item => item.week)).toEqual(dates.slice(1));
  });
  it("берёт две слабейшие темы источника и запускает только доступную показанную", () => {
    const weak = [{ ...unit("a", 0), number: 27 }, { ...unit("b", 0), number: 15 }, { ...unit("c", 1), number: 16 }];
    expect(weakProgressPreview(weak, new Set([15, 16]), true)).toEqual({ units: weak.slice(0, 2), number: 15 });
    expect(weakProgressPreview(weak, new Set([16]), true).number).toBeNull();
    expect(weakProgressPreview(weak, new Set([15]), false).number).toBeNull();
  });
  it("сохраняет 0% и не создаёт статистику без ответов", () => {
    expect(weeklyProgress([])).toEqual([]);
    expect(weeklyProgress([point("2026-11-09", 0, 0)])).toEqual([]);
    expect(weeklyProgress([point("2026-11-09", 0, 10)])[0]?.percent).toBe(0);
    expect(filterProgressUnits([], "weak")).toEqual([]);
  });
});
