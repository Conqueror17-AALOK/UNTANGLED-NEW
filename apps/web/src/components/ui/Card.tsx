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
    card: 'bg-[#323642] text-neutral-200 border border-[#434856] rounded-xl p-5',
    default: 'bg-[#323642] text-neutral-200 border border-[#434856] rounded-xl p-5',
    well: 'bg-[#24272f] text-neutral-200 border border-dashed border-[#484e5e] rounded-xl p-5',
    selected: 'bg-[#3f4554] text-white border-2 border-blue-500 rounded-xl p-5',
    telemetry: 'bg-[#24272f] text-neutral-200 border border-[#434856] rounded-xl p-5',
    glass: 'bg-[#323642] text-neutral-200 border border-[#434856] rounded-xl p-5',
    interactive: 'bg-[#323642] text-neutral-200 border border-[#434856] hover:border-slate-400 hover:bg-[#383d4a] rounded-xl p-5 cursor-pointer',
  };

  const hoverClass = hoverEffect ? 'hover:bg-[#383d4a] hover:border-slate-400 transition-colors duration-150' : '';

  return (
    <div className={`${variantStyles[variant]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
};
