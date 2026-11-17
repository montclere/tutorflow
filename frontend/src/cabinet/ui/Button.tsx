import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Button as KitButton } from "@/shared/ui/kit/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

type Props = Omit<ComponentProps<"button">, "ref"> & {
  variant?: "default" | "primary" | "lime";
  size?: "md" | "sm";
  icon?: LucideIcon;
};

const variants = { default: "secondary", primary: "default", lime: "highlight" } as const;

export function Button({ variant = "default", size = "md", icon: Icon, children, ...rest }: Props) {
  return (
    <KitButton variant={variants[variant]} size={size === "sm" ? "sm" : "default"} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </KitButton>
  );
}

export function IconButton({ label, icon: Icon, ...rest }: Omit<ComponentProps<"button">, "ref"> & { label: string; icon: LucideIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <KitButton variant="secondary" size="icon" aria-label={label} {...rest}>
          <Icon aria-hidden="true" />
        </KitButton>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <KitButton variant="link" size="sm" onClick={onClick}>
      {children}
    </KitButton>
  );
}
