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
    // Adobe Firefly Editorial Card: clean 1px border, surface background, rounded-2xl
    card: 'bg-[#141414] text-white border border-white/[0.12] rounded-2xl p-5 sm:p-6',
    default: 'bg-[#141414] text-white border border-white/[0.12] rounded-2xl p-5 sm:p-6',
    // Adobe Firefly Ingestion Well
    well: 'bg-[#0d0d0d] text-white border border-dashed border-white/[0.16] rounded-2xl p-5 sm:p-6',
    // Selected Card with Adobe Red Accent #eb1000
    selected: 'bg-[#181818] text-white border-2 border-[#eb1000] rounded-2xl p-5 sm:p-6',
    telemetry: 'bg-[#0e0e0e] text-white border border-white/[0.1] rounded-2xl p-5 sm:p-6',
    glass: 'bg-[#141414] text-white border border-white/[0.12] rounded-2xl p-5 sm:p-6',
    interactive: 'bg-[#141414] text-white border border-white/[0.12] hover:border-white/30 hover:bg-[#1a1a1a] rounded-2xl p-5 sm:p-6 cursor-pointer',
  };

  const hoverClass = hoverEffect ? 'hover:bg-[#1a1a1a] hover:border-white/25 transition-all duration-200' : '';

  return (
    <div className={`${variantStyles[variant]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
};
