export function VictorySeal({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Halo ring */}
      <circle cx="18" cy="18" r="17" stroke="#C9A24B" strokeWidth="1" strokeOpacity="0.35" strokeDasharray="3 2" />
      {/* Gold seal circle */}
      <defs>
        <radialGradient id="sealGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#D8B868" />
          <stop offset="100%" stopColor="#C9A24B" />
        </radialGradient>
      </defs>
      <circle cx="18" cy="18" r="14" fill="url(#sealGrad)" />
      {/* White checkmark */}
      <path d="M11 18.5L15.5 23L25 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
