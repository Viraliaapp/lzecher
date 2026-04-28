"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

function CandleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 96"
      className={cn("h-20 w-14", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Candle body */}
      <rect x="20" y="40" width="24" height="52" rx="4" fill="#FAF6EC" stroke="#C9A961" strokeWidth="1.5" />
      {/* Wick */}
      <line x1="32" y1="40" x2="32" y2="28" stroke="#2A2D34" strokeWidth="1.5" />
      {/* Flame */}
      <ellipse cx="32" cy="20" rx="8" ry="14" fill="#C9A961" opacity="0.3">
        <animate attributeName="ry" values="14;12;14" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.5;0.3" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="32" cy="20" rx="4" ry="8" fill="#C9A961" opacity="0.7">
        <animate attributeName="ry" values="8;7;8" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="32" cy="18" rx="2" ry="4" fill="#E8CD93">
        <animate attributeName="ry" values="4;3;4" dur="1.8s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {icon || <CandleIcon />}
      <h3 className="font-heading text-lg font-semibold text-navy mt-4 mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted max-w-sm leading-relaxed mb-4">
        {description}
      </p>
      {action}
    </div>
  );
}

export { CandleIcon };
