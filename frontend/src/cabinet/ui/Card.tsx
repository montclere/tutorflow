import type { ReactNode } from "react";
import { Card as KitCard, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { cx } from "./cx";

type Props = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  scroll?: boolean;
};

export function Card({ title, subtitle, action, children, className, compact, scroll }: Props) {
  return (
    <KitCard className={cx(compact && "py-2", scroll && "overflow-x-auto", className)}>
      {(title || action) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      {children && <CardContent className={compact ? "px-2" : undefined}>{children}</CardContent>}
    </KitCard>
  );
}
