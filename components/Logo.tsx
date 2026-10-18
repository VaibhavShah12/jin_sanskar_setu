import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

/**
 * High-definition, responsive Vector Logo for Jin Sanskar Setu
 * Auspicious Jain Golden Lotus (कमल / Sanskar Padma) with Ahimsa Wheel & Radiant Aura.
 * Renders crisply across all screens and operating systems without emoji font dependencies.
 */
export default function Logo({ size = 36, className = "", showText = false }: LogoProps) {
  return (
    <div className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0, filter: "drop-shadow(0 2px 4px rgba(230, 81, 0, 0.25))" }}
        aria-label="Jin Sanskar Setu Logo"
      >
        <defs>
          {/* Radial Gradient for Outer Aura */}
          <radialGradient id="auraGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF9E6" />
            <stop offset="65%" stopColor="#FFE082" />
            <stop offset="100%" stopColor="#FFB300" />
          </radialGradient>

          {/* Saffron & Deep Gold Gradient for Primary Petals */}
          <linearGradient id="goldSaffronGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF8F00" />
            <stop offset="50%" stopColor="#FFA000" />
            <stop offset="100%" stopColor="#D84315" />
          </linearGradient>

          {/* Shimmer Gold for Highlights */}
          <linearGradient id="shimmerGold" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF8E1" />
            <stop offset="100%" stopColor="#FFC107" />
          </linearGradient>

          {/* Saffron Royal Glow */}
          <radialGradient id="centerGem" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FFEB3B" />
            <stop offset="70%" stopColor="#FF6F00" />
            <stop offset="100%" stopColor="#BF360C" />
          </radialGradient>
        </defs>

        {/* Circular Auspicious Halo / Prabhavali */}
        <circle cx="50" cy="50" r="47" fill="url(#auraGrad)" stroke="#FF8F00" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="#FFA000" strokeWidth="1" strokeDasharray="3 2" />

        {/* Outer Lotus Petals (Left, Right, Base) */}
        {/* Left-most petal */}
        <path
          d="M 50 68 C 30 68 18 52 24 38 C 32 44 42 55 50 68 Z"
          fill="url(#goldSaffronGrad)"
          opacity="0.9"
        />
        {/* Right-most petal */}
        <path
          d="M 50 68 C 70 68 82 52 76 38 C 68 44 58 55 50 68 Z"
          fill="url(#goldSaffronGrad)"
          opacity="0.9"
        />

        {/* Intermediate Left Petal */}
        <path
          d="M 50 72 C 34 65 24 45 34 26 C 42 38 46 54 50 72 Z"
          fill="url(#goldSaffronGrad)"
        />
        {/* Intermediate Right Petal */}
        <path
          d="M 50 72 C 66 65 76 45 66 26 C 58 38 54 54 50 72 Z"
          fill="url(#goldSaffronGrad)"
        />

        {/* Central Crown Petal (Tirthankara Lotus Peak) */}
        <path
          d="M 50 16 C 55 28 58 48 50 74 C 42 48 45 28 50 16 Z"
          fill="url(#shimmerGold)"
          stroke="#E65100"
          strokeWidth="1.2"
        />

        {/* Inner Lotus Bud Accent */}
        <path
          d="M 50 22 C 53 32 54 44 50 56 C 46 44 47 32 50 22 Z"
          fill="#FFFDE7"
          opacity="0.85"
        />

        {/* Auspicious Base Kalash / Pedestal */}
        <path
          d="M 32 73 C 40 70 60 70 68 73 C 65 82 35 82 32 73 Z"
          fill="#D84315"
        />
        <path
          d="M 38 79 C 45 78 55 78 62 79 C 60 84 40 84 38 79 Z"
          fill="#FFB300"
        />

        {/* Center Jewel (Sanskar Bindu) */}
        <circle cx="50" cy="58" r="6" fill="url(#centerGem)" stroke="#FFF" strokeWidth="1.2" />

        {/* Sunbeam Aura Rays at Top */}
        <line x1="50" y1="6" x2="50" y2="12" stroke="#FF6F00" strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="8" x2="43" y2="13" stroke="#FF8F00" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="60" y1="8" x2="57" y2="13" stroke="#FF8F00" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {showText && (
        <div className="d-flex flex-column lh-1">
          <span className="brand-title fw-bold text-dark fs-5">Jin Sanskar Setu</span>
          <small className="brand-hindi text-muted mt-1 fs-8">जिन संस्कार सेतु</small>
        </div>
      )}
    </div>
  );
}
