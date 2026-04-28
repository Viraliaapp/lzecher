"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-page-custom-font */
import "./globals.css";

const candleStyles = `
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-1deg); opacity: 0.9; }
    50% { transform: scale(1.05) rotate(1deg); opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 8px rgba(201, 169, 97, 0.4)); }
    50% { filter: drop-shadow(0 0 16px rgba(201, 169, 97, 0.7)); }
  }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: candleStyles }} />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #08111E 0%, #0F1B2D 50%, #1A2840 100%)",
          color: "#FAF6EC",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 520, padding: "2rem" }}>
          {/* Candle SVG */}
          <div style={{ marginBottom: "2rem" }}>
            <svg
              width="64"
              height="120"
              viewBox="0 0 64 120"
              fill="none"
              style={{ animation: "glow 3s ease-in-out infinite" }}
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
            style={{
              fontSize: "0.875rem",
              letterSpacing: "0.3em",
              color: "#C9A961",
              fontWeight: 600,
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Error
          </p>

          <h1
            style={{
              fontFamily: "'Frank Ruhl Libre', serif",
              fontSize: "2.25rem",
              fontWeight: 700,
              lineHeight: 1.2,
              marginBottom: "0.75rem",
              color: "#FAF6EC",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: "0.95rem",
              color: "rgba(250, 246, 236, 0.5)",
              lineHeight: 1.6,
              marginBottom: "2.5rem",
            }}
          >
            An unexpected error occurred. Please try again or return home.
          </p>

          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "rgba(250, 246, 236, 0.3)",
                marginBottom: "1.5rem",
                fontFamily: "monospace",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.875rem 2.5rem",
                background: "linear-gradient(135deg, #C9A961 0%, #D4B679 100%)",
                color: "#0F1B2D",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "0.95rem",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 24px rgba(201, 169, 97, 0.3)",
              }}
            >
              Try Again
            </button>

            <a
              href="/"
              style={{
                padding: "0.875rem 2.5rem",
                background: "transparent",
                color: "#C9A961",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "0.95rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(201, 169, 97, 0.3)",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Back to Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
