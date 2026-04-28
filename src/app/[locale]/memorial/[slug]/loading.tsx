const shimmerStyles = `
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-1deg); opacity: 0.9; }
    50% { transform: scale(1.05) rotate(1deg); opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(201, 169, 97, 0.3)); }
    50% { filter: drop-shadow(0 0 12px rgba(201, 169, 97, 0.6)); }
  }
`;

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(90deg, rgba(201,169,97,0.05) 25%, rgba(201,169,97,0.12) 50%, rgba(201,169,97,0.05) 75%)",
        backgroundSize: "800px 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
        borderRadius: "0.75rem",
      }}
    />
  );
}

function ShimmerBlockLight({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "linear-gradient(90deg, rgba(250,246,236,0.08) 25%, rgba(250,246,236,0.16) 50%, rgba(250,246,236,0.08) 75%)",
        backgroundSize: "800px 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
        borderRadius: "0.75rem",
      }}
    />
  );
}

export default function MemorialLoading() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shimmerStyles }} />

      {/* Hero section skeleton */}
      <div className="bg-gradient-to-b from-navy-deep via-navy to-navy-soft px-6 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Candle */}
          <div className="flex justify-center mb-8">
            <svg
              width="40"
              height="80"
              viewBox="0 0 64 120"
              fill="none"
              style={{ animation: "glow 2.5s ease-in-out infinite" }}
            >
              <g style={{ animation: "flicker 2s ease-in-out infinite", transformOrigin: "32px 30px" }}>
                <ellipse cx="32" cy="30" rx="10" ry="22" fill="#C9A961" opacity="0.9" />
                <ellipse cx="32" cy="28" rx="6" ry="14" fill="#E8CD93" opacity="0.8" />
                <ellipse cx="32" cy="26" rx="3" ry="8" fill="#FAF6EC" opacity="0.9" />
              </g>
              <rect x="31" y="48" width="2" height="8" rx="1" fill="#2A2D34" />
              <rect x="22" y="56" width="20" height="56" rx="3" fill="#FAF6EC" opacity="0.9" />
              <rect x="18" y="108" width="28" height="8" rx="2" fill="#C9A961" opacity="0.6" />
            </svg>
          </div>

          {/* Hebrew name */}
          <ShimmerBlockLight className="h-10 w-56 mx-auto mb-3" />
          {/* English name */}
          <ShimmerBlockLight className="h-6 w-40 mx-auto mb-4" />
          {/* Dates */}
          <ShimmerBlockLight className="h-4 w-64 mx-auto mb-6" />
          {/* Description */}
          <ShimmerBlockLight className="h-4 w-80 mx-auto mb-2" />
          <ShimmerBlockLight className="h-4 w-60 mx-auto mb-8" />
          {/* Stats badges */}
          <div className="flex justify-center gap-4">
            <ShimmerBlockLight className="h-8 w-28" />
            <ShimmerBlockLight className="h-8 w-28" />
            <ShimmerBlockLight className="h-8 w-28" />
          </div>
        </div>
      </div>

      {/* Portion grid skeleton */}
      <div className="bg-cream px-6 py-10 md:py-14">
        <div className="max-w-5xl mx-auto">
          {/* Section tabs */}
          <div className="flex gap-3 mb-8 justify-center">
            {[...Array(4)].map((_, i) => (
              <ShimmerBlock key={i} className="h-10 w-28" />
            ))}
          </div>

          {/* Portion grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-gold/10 bg-white/60 p-4"
              >
                <ShimmerBlock className="h-4 w-full mb-2" />
                <ShimmerBlock className="h-3 w-3/4 mb-3" />
                <ShimmerBlock className="h-7 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
