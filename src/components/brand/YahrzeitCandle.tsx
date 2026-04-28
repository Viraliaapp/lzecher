"use client";

import { cn } from "@/lib/utils";

interface YahrzeitCandleProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function YahrzeitCandle({ size = "md", className }: YahrzeitCandleProps) {
  const dims = {
    sm: { w: 48, h: 72, flame: 0.6 },
    md: { w: 80, h: 120, flame: 1 },
    lg: { w: 100, h: 140, flame: 1.2 },
  }[size];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: dims.w, height: dims.h }}
    >
      {/* Glow halos */}
      <div
        className="absolute rounded-full"
        style={{
          width: dims.w * 1.8,
          height: dims.w * 1.8,
          top: -dims.w * 0.2,
          left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(201,169,97,0.15) 0%, transparent 70%)",
          animation: "glow-soft 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: dims.w * 1.2,
          height: dims.w * 1.2,
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          background: "radial-gradient(circle, rgba(201,169,97,0.25) 0%, transparent 60%)",
          animation: "glow-strong 6s ease-in-out infinite",
        }}
      />

      <svg
        viewBox="0 0 80 120"
        width={dims.w}
        height={dims.h}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glass jar */}
        <rect x="22" y="50" width="36" height="60" rx="6" fill="#FAF6EC" fillOpacity="0.9" stroke="#C9A961" strokeWidth="1" strokeOpacity="0.3" />
        <rect x="26" y="50" width="4" height="60" rx="2" fill="#C9A961" fillOpacity="0.05" />

        {/* Wax fill */}
        <rect x="23" y="65" width="34" height="44" rx="5" fill="#F5EDD9" />

        {/* Wick */}
        <line x1="40" y1="50" x2="40" y2="35" stroke="#2A2D34" strokeWidth="1.5" strokeLinecap="round">
          <animate attributeName="x2" values="40;39.5;40.5;40" dur="3.5s" repeatCount="indefinite" />
        </line>

        {/* Flame outer */}
        <ellipse cx="40" cy="24" rx="10" ry="18" fill="#C9A961" fillOpacity="0.2">
          <animate attributeName="ry" values="18;16;19;17;18" dur="7s" repeatCount="indefinite" />
          <animate attributeName="rx" values="10;9;11;10" dur="7s" repeatCount="indefinite" />
          <animate attributeName="cy" values="24;23;25;24" dur="7s" repeatCount="indefinite" />
        </ellipse>

        {/* Flame middle */}
        <ellipse cx="40" cy="24" rx="6" ry="12" fill="#C9A961" fillOpacity="0.6">
          <animate attributeName="ry" values="12;10;13;11;12" dur="5.5s" repeatCount="indefinite" />
          <animate attributeName="rx" values="6;5;7;6" dur="5.5s" repeatCount="indefinite" />
          <animate attributeName="cy" values="24;22;25;23;24" dur="5.5s" repeatCount="indefinite" />
        </ellipse>

        {/* Flame core */}
        <ellipse cx="40" cy="22" rx="3" ry="7" fill="#E8CD93">
          <animate attributeName="ry" values="7;6;8;6.5;7" dur="4.5s" repeatCount="indefinite" />
          <animate attributeName="cy" values="22;21;23;22" dur="4.5s" repeatCount="indefinite" />
        </ellipse>

        {/* Jar rim */}
        <rect x="20" y="48" width="40" height="4" rx="2" fill="#C9A961" fillOpacity="0.15" stroke="#C9A961" strokeWidth="0.5" strokeOpacity="0.2" />
      </svg>
    </div>
  );
}
