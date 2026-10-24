import React from 'react';

interface UntangledLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showSubtitle?: boolean;
  stacked?: boolean;
}

export const UntangledLogo: React.FC<UntangledLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  showSubtitle = true,
  stacked = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const imageSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Frosted Glass Emblem containing the Light Grey 3D Glass "U" */}
      <div
        className={`relative ${iconSizes[size]} rounded-xl bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-transparent backdrop-blur-xl border border-white/[0.2] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_4px_16px_-2px_rgba(0,0,0,0.35)] flex items-center justify-center p-1 transition-all duration-300 group-hover:scale-105 group-hover:border-white/[0.4] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] shrink-0`}
      >
        {/* Subtle Ambient Silver Glow inside badge */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-slate-400/10 via-white/5 to-cyan-500/10 opacity-70" />

        {/* 3D Frosted Light Grey Glass "U" Mark */}
        <img
          src="/logo-glass.png"
          alt="METAWIZ UNTANGLED Logo"
          className={`${imageSizes[size]} object-contain relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]`}
        />
      </div>

      {/* Brand Wordmark: METAWIZ UNTANGLED */}
      {showText && (
        <div className={`flex flex-col justify-center ${stacked ? 'leading-tight' : ''}`}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-400 font-semibold">
              METAWIZ
            </span>
            <span
              className={`${textSizes[size]} font-bold tracking-tight text-white font-sans`}
            >
              UNTANGLED
            </span>
          </div>
          {showSubtitle && (
            <span className="text-[10px] text-slate-400 font-normal tracking-wide">
              P&ID Topology & DCS Validation
            </span>
          )}
        </div>
      )}
    </div>
  );
};
