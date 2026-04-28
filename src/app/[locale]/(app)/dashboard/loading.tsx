const shimmerStyles = `
  @keyframes shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
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

export default function DashboardLoading() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shimmerStyles }} />
      <div className="min-h-screen bg-cream p-6 md:p-8 lg:p-10">
        {/* Header skeleton */}
        <div className="mb-8">
          <ShimmerBlock className="h-8 w-48 mb-2" />
          <ShimmerBlock className="h-4 w-72" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gold/10 bg-white/60 p-5"
            >
              <ShimmerBlock className="h-4 w-20 mb-3" />
              <ShimmerBlock className="h-8 w-16 mb-2" />
              <ShimmerBlock className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Action button skeleton */}
        <div className="mb-8">
          <ShimmerBlock className="h-11 w-48" />
        </div>

        {/* Project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gold/10 bg-white/60 p-6"
            >
              {/* Card header */}
              <div className="flex items-center gap-3 mb-4">
                <ShimmerBlock className="h-10 w-10 !rounded-full" />
                <div className="flex-1">
                  <ShimmerBlock className="h-5 w-36 mb-2" />
                  <ShimmerBlock className="h-3 w-24" />
                </div>
              </div>
              {/* Progress bar */}
              <ShimmerBlock className="h-2 w-full mb-4" />
              {/* Card footer */}
              <div className="flex justify-between">
                <ShimmerBlock className="h-4 w-20" />
                <ShimmerBlock className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Recent claims section */}
        <div className="mt-10">
          <ShimmerBlock className="h-6 w-40 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border border-gold/10 bg-white/60 p-4"
              >
                <ShimmerBlock className="h-8 w-8 !rounded-full" />
                <div className="flex-1">
                  <ShimmerBlock className="h-4 w-48 mb-2" />
                  <ShimmerBlock className="h-3 w-32" />
                </div>
                <ShimmerBlock className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
