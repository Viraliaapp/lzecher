const loadingStyles = `
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-1deg); opacity: 0.9; }
    50% { transform: scale(1.05) rotate(1deg); opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 8px rgba(201, 169, 97, 0.4)); }
    50% { filter: drop-shadow(0 0 16px rgba(201, 169, 97, 0.7)); }
  }
  @keyframes pulse-text {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
`;

export default function LocaleLoading() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loadingStyles }} />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-navy-deep via-navy to-navy-soft">
        {/* Candle */}
        <div className="mb-6">
          <svg
            width="48"
            height="96"
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
            <ellipse cx="26" cy="56" rx="3" ry="4" fill="#FAF6EC" opacity="0.7" />
            <rect x="18" y="108" width="28" height="8" rx="2" fill="#C9A961" opacity="0.6" />
          </svg>
        </div>

        <p
          className="text-cream/60 text-sm font-sans tracking-wide"
          style={{ animation: "pulse-text 2s ease-in-out infinite" }}
        >
          Preparing your experience...
        </p>
      </div>
    </>
  );
}
