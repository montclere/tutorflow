import { describe, expect, it } from "vitest";
import {
  buildStudentRecord,
  initialsOf,
  inviteText,
  newStudentErrors,
  paymentErrors,
  paymentMove,
  pickColor,
  rublesToKopecks,
  type NewStudentInput,
} from "./newStudent";

const input: NewStudentInput = {
  name: "  Мария   Смирнова ",
  goal: "ОГЭ · цель 5",
  tariff: "per_lesson",
  priceRub: 1250,
  packageLessons: 8,
  parent: "",
};

describe("initialsOf", () => {
  it("берёт первые буквы имени и фамилии", () => {
    expect(initialsOf("Мария Смирнова")).toBe("МС");
    expect(initialsOf("  анна ")).toBe("А");
    expect(initialsOf("Иван Петрович Сидоров")).toBe("ИП");
  });
});

describe("pickColor", () => {
  it("раздаёт цвета по кругу", () => {
    expect(pickColor(0)).toBe("peach");
    expect(pickColor(6)).toBe("peach");
    expect(pickColor(7)).toBe("mint");
  });
});

describe("newStudentErrors", () => {
  it("корректная форма без ошибок", () => {
    expect(newStudentErrors(input)).toEqual([]);
  });

  it("требует имя и положительную цену", () => {
    expect(newStudentErrors({ ...input, name: "  " })).toContain("name");
    expect(newStudentErrors({ ...input, priceRub: 0 })).toContain("price");
  });

  it("для абонемента нужен хотя бы один урок", () => {
    expect(newStudentErrors({ ...input, tariff: "package", packageLessons: 0 })).toContain("lessons");
    expect(newStudentErrors({ ...input, tariff: "per_lesson", packageLessons: 0 })).not.toContain("lessons");
  });
});

describe("buildStudentRecord", () => {
  it("создаёт активного ученика без истории, ждущего подключения", () => {
    const record = buildStudentRecord(input, { id: "new-1", today: "2026-11-17", colorIndex: 1 });
    expect(record).toMatchObject({
      id: "new-1",
      name: "Мария Смирнова",
      initials: "МС",
      color: "mint",
      goal: "ОГЭ · цель 5",
      status: "active",
      balance: 0,
      lessonsCount: 0,
      startedAt: "2026-11-17",
      telegramConnected: false,
      recentLessons: [],
      payment: { model: "per_lesson", pricePerLesson: 125000 },
    });
    expect(record.parent).toBeUndefined();
  });

  it("абонемент хранит число уроков и цену", () => {
    const record = buildStudentRecord({ ...input, tariff: "package", packageLessons: 8 }, { id: "new-2", today: "2026-11-17", colorIndex: 0 });
    expect(record.payment).toEqual({ model: "package", pricePerLesson: 125000, package: { lessons: 8, price: 125000, left: 8 } });
  });

  it("контакт родителя сохраняется, если указан", () => {
    const record = buildStudentRecord({ ...input, parent: "@irina_s" }, { id: "new-3", today: "2026-11-17", colorIndex: 0 });
    expect(record.parent?.phone).toBe("@irina_s");
  });
});

describe("оплата", () => {
  it("переводит рубли в копейки и не принимает пустую сумму", () => {
    expect(rublesToKopecks(1500)).toBe(150000);
    expect(paymentErrors({ amountRub: 0, date: "2026-11-17" }, "2026-11-17")).toContain("amount");
    expect(paymentErrors({ amountRub: 1500, date: "2026-11-18" }, "2026-11-17")).toContain("future");
    expect(paymentErrors({ amountRub: 1500, date: "2026-11-17" }, "2026-11-17")).toEqual([]);
  });

  it("движение по счёту — положительная сумма с подписью способа", () => {
    expect(paymentMove({ amountRub: 1500, date: "2026-11-17" }, "СБП")).toEqual({ date: "2026-11-17", title: "Оплата · СБП", amount: 150000 });
  });
});

describe("inviteText", () => {
  it("подставляет имя и ссылку", () => {
    expect(inviteText("Мария Смирнова", "https://x/i/abc")).toContain("Мария");
    expect(inviteText("Мария Смирнова", "https://x/i/abc")).toContain("https://x/i/abc");
  });
});
