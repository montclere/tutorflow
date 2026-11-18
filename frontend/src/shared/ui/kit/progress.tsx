import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/shared/lib/utils"
import { Progress as ProgressPrimitive } from "radix-ui"

const indicatorVariants = cva("h-full w-full flex-1 rounded-full transition-transform duration-200 motion-reduce:transition-none", {
  variants: {
    tone: {
      default: "bg-primary",
      success: "bg-success",
      danger: "bg-destructive",
      warning: "bg-warning",
    },
  },
  defaultVariants: { tone: "default" },
})

function Progress({
  className,
  value,
  tone,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & VariantProps<typeof indicatorVariants>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={indicatorVariants({ tone })}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
