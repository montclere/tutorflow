import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-9.5 shrink-0 overflow-hidden rounded-lg select-none", className)}
      {...props}
    />
  )
}

const fallbackVariants = cva(
  "flex size-full items-center justify-center font-[family-name:var(--font-display)] text-xs font-extrabold text-foreground",
  {
    variants: {
      tone: {
        peach: "bg-[var(--cab-tone-peach)]",
        mint: "bg-[var(--cab-tone-mint)]",
        rose: "bg-[var(--cab-tone-rose)]",
        sky: "bg-[var(--cab-tone-sky)]",
        lilac: "bg-[var(--cab-tone-lilac)]",
      },
    },
    defaultVariants: { tone: "sky" },
  }
)

function AvatarFallback({
  className,
  tone,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & VariantProps<typeof fallbackVariants>) {
  return <AvatarPrimitive.Fallback data-slot="avatar-fallback" className={cn(fallbackVariants({ tone }), className)} {...props} />
}

export { Avatar, AvatarFallback }
