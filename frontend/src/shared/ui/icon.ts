import type { ComponentType } from "react";

/**
 * Иконка интерфейса (VIBE-15): основной набор — Phosphor в варианте duotone (двухтоновые, заданы в main.tsx
 * через IconContext); мелкие служебные иконки в кнопках остаются из lucide. Обе библиотеки подходят под этот тип.
 */
export type AppIcon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false"; "aria-label"?: string }>;
