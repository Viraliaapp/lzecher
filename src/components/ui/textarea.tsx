import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-navy/10 bg-white px-3 py-2 text-sm text-navy",
        "placeholder:text-muted",
        "focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors duration-200 resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
