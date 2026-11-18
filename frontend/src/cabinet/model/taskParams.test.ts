import { describe, expect, it } from "vitest";
import { withSubjectParam } from "./taskParams";

const params = [{ label: "Экзамен", options: ["ЕГЭ"] }];

describe("withSubjectParam", () => {
  it("не добавляет предмет, если он один", () => {
    expect(withSubjectParam(params, ["Математика"], "Предмет")).toEqual(params);
    expect(withSubjectParam(params, [], "Предмет")).toEqual(params);
  });

  it("ставит предмет первым, если предметов несколько", () => {
    const result = withSubjectParam(params, ["Математика", "Физика"], "Предмет");
    expect(result[0]).toEqual({ label: "Предмет", options: ["Математика", "Физика"] });
    expect(result).toHaveLength(2);
  });
});
