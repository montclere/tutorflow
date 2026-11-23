import { describe, expect, it } from "vitest";
import { plural } from "./plural";

const forms: [string, string, string] = ["урок", "урока", "уроков"];

describe("plural", () => {
  it.each([
    [1, "урок"],
    [2, "урока"],
    [5, "уроков"],
    [11, "уроков"],
    [18, "уроков"],
    [21, "урок"],
    [24, "урока"],
  ])("%i → %s", (count, expected) => {
    expect(plural(count, forms)).toBe(expected);
  });
});
