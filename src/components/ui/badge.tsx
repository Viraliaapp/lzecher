import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-gold/10 text-gold-deep",
        secondary: "border-transparent bg-navy/10 text-navy",
        outline: "border-navy/20 text-navy",
        success: "border-transparent bg-emerald-100 text-emerald-700",
        destructive: "border-transparent bg-red-100 text-red-700",
        zeraim: "border-transparent bg-zeraim/10 text-zeraim",
        moed: "border-transparent bg-moed/10 text-moed",
        nashim: "border-transparent bg-nashim/10 text-nashim",
        nezikin: "border-transparent bg-nezikin/10 text-nezikin",
        kodashim: "border-transparent bg-kodashim/10 text-kodashim",
        tahorot: "border-transparent bg-tahorot/10 text-tahorot",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
