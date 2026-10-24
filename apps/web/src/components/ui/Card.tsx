import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'card' | 'well' | 'selected' | 'telemetry' | 'glass' | 'interactive';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'card',
  hoverEffect = false,
}) => {
  const variantStyles = {
    card: 'bg-[#323642]/70 backdrop-blur-xl text-neutral-200 border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_10px_30px_-5px_rgba(0,0,0,0.25)] rounded-2xl p-5',
    default: 'bg-[#323642]/70 backdrop-blur-xl text-neutral-200 border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_10px_30px_-5px_rgba(0,0,0,0.25)] rounded-2xl p-5',
    well: 'bg-[#24272f]/60 backdrop-blur-md text-neutral-200 border border-dashed border-white/[0.15] shadow-inner rounded-xl p-5',
    selected: 'bg-white/[0.15] backdrop-blur-xl text-white border-2 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)] rounded-2xl p-5',
    telemetry: 'bg-[#24272f]/70 backdrop-blur-lg text-neutral-200 border border-white/[0.1] rounded-xl p-5',
    glass: 'bg-white/[0.06] backdrop-blur-2xl text-neutral-200 border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] rounded-2xl p-5',
    interactive: 'bg-[#323642]/70 backdrop-blur-xl text-neutral-200 border border-white/[0.12] hover:border-white/[0.25] hover:bg-[#383d4a]/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] rounded-2xl p-5 cursor-pointer transition-all',
  };

  const hoverClass = hoverEffect ? 'hover:bg-[#383d4a]/85 hover:border-white/[0.25] hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-200' : '';

  return (
    <div className={`${variantStyles[variant]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
};
