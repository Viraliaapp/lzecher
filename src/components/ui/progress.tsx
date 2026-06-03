"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
  }
>(({ className, value, indicatorClassName, ...props }, ref) => {
  const numericValue = typeof value === "number" ? value : Number(value || 0);
  const visualValue = Math.max(0, Math.min(100, Number.isFinite(numericValue) ? numericValue : 0));
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={visualValue}
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-navy/10",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-gold transition-all duration-500 ease-out",
          indicatorClassName
        )}
        style={{ width: `${visualValue}%` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
