import React from 'react';

interface UntangledLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showSubtitle?: boolean;
}

export const UntangledLogo: React.FC<UntangledLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  showSubtitle = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Frosted Glass Geometric Logo Mark */}
      <div
        className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-br from-white/[0.16] via-white/[0.08] to-transparent backdrop-blur-xl border border-white/[0.22] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_4px_16px_-2px_rgba(0,0,0,0.4)] flex items-center justify-center p-1.5 transition-all duration-300 group-hover:scale-105 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.3)] shrink-0`}
      >
        {/* Subtle Ambient Behind-Glow inside the glass badge */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-indigo-500/20 opacity-80" />

        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
        >
          <defs>
            {/* Primary Cyan-to-Ice Frosted Gradient */}
            <linearGradient id="untangled-cyan-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="45%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>

            {/* Specular Edge Highlight Gradient */}
            <linearGradient id="untangled-specular" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
            </linearGradient>

            {/* Glass Underlap Gradient */}
            <linearGradient id="untangled-underlap" x1="10" y1="18" x2="26" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>

          {/* Background Untangling Loop (Under-cross ribbon) */}
          <path
            d="M 10 9 V 19 C 10 26 15 29 18 29 C 21 29 23 27 24.5 24.5 L 26 22"
            stroke="url(#untangled-underlap)"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />

          {/* Foreground Untangling Mobius Flow (Forms the iconic U ribbon) */}
          <path
            d="M 26 9 V 19 C 26 26 21 29 18 29 C 14.5 29 11.5 26 11.5 22.5 C 11.5 19 14.5 16.5 18 16.5 C 22 16.5 25.5 19.5 25.5 23.5 C 25.5 27 22.5 29 18 29"
            stroke="url(#untangled-cyan-grad)"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Specular Glass Highlight Spine (Micro Refraction) */}
          <path
            d="M 10.5 10 V 18 C 10.5 24.5 14.5 27.5 17.5 27.5 M 25.5 10 V 18 C 25.5 24.5 21.5 27.5 18 27.5"
            stroke="url(#untangled-specular)"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Precision Engineering Node Diamond in Center */}
          <polygon
            points="18,13.5 20.2,16.5 18,19.5 15.8,16.5"
            fill="#ffffff"
            className="animate-pulse"
            opacity="0.95"
          />
        </svg>
      </div>

      {/* Brand Wordmark */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={`${textSizes[size]} font-semibold tracking-tight text-white font-sans flex items-center`}
            >
              UNTANGLED
            </span>
            <span className="text-[9px] font-mono tracking-wider font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
              P&ID
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[10px] text-neutral-400 font-normal tracking-wide">
              Deterministic Engineering AI
            </span>
          )}
        </div>
      )}
    </div>
  );
};
