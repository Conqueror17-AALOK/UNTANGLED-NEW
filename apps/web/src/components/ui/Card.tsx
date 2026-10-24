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
    default: 'bg-[#12141c]/90 border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md',
    glass: 'bg-industrial-950/75 border border-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-xl',
    interactive: 'bg-[#12141c]/90 border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-cyan-500/30 hover:shadow-[0_8px_30px_rgba(6,182,212,0.12),inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:bg-[#151822] cursor-pointer',
    telemetry: 'bg-[#0b0d13]/95 border border-industrial-800/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
  };

  const hoverClass = hoverEffect
    ? 'hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:translate-y-[-1px]'
    : '';

  return (
    <div
      className={`rounded-xl p-4 sm:p-5 transition-all duration-200 ${variantStyles[variant]} ${hoverClass} ${className}`}
    >
      {children}
    </div>
  );
};
