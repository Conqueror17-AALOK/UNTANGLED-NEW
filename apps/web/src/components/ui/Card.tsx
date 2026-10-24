import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'interactive' | 'telemetry';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  hoverEffect = false,
}) => {
  const variantStyles = {
    default: 'bg-gradient-to-b from-white/[0.05] to-white/[0.01] bg-[#0d101a]/80 border border-white/[0.1] shadow-[0_6px_24px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.14)] backdrop-blur-xl',
    glass: 'bg-gradient-to-b from-white/[0.07] to-white/[0.015] bg-[#0c0f18]/75 border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.18)] backdrop-blur-2xl',
    interactive: 'bg-gradient-to-b from-white/[0.06] to-white/[0.01] bg-[#0d101a]/75 border border-white/[0.1] shadow-[0_6px_24px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.14)] hover:border-cyan-400/40 hover:shadow-[0_12px_36px_rgba(6,182,212,0.18),inset_0_1px_0_0_rgba(255,255,255,0.25)] hover:bg-[#121624]/85 cursor-pointer backdrop-blur-xl',
    telemetry: 'bg-gradient-to-b from-white/[0.03] to-transparent bg-[#080a11]/90 border border-white/[0.07] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-md',
  };

  const hoverClass = hoverEffect
    ? 'hover:border-white/25 hover:shadow-[0_12px_36px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.22)] hover:translate-y-[-1px]'
    : '';

  return (
    <div
      className={`rounded-xl p-4 sm:p-5 transition-all duration-200 ${variantStyles[variant]} ${hoverClass} ${className}`}
    >
      {children}
    </div>
  );
};
