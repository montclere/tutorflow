import type { StudentColor } from "../mocks/types";
import { pickColor } from "./newStudent";

/** Цвет аватара стабилен для карточки: зависит от ID, а не от места в списке. */
export function cardColor(id: string): StudentColor {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return pickColor(hash);
}
