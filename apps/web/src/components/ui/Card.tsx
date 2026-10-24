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
    card: 'bg-[#20232a] text-neutral-200 border border-[#2e323b] rounded-xl p-5',
    default: 'bg-[#20232a] text-neutral-200 border border-[#2e323b] rounded-xl p-5',
    well: 'bg-[#1c1e24] text-neutral-200 border border-dashed border-[#353945] rounded-xl p-5',
    selected: 'bg-[#252831] text-white border-2 border-blue-500 rounded-xl p-5',
    telemetry: 'bg-[#1e2026] text-neutral-200 border border-[#2e323b] rounded-xl p-5',
    glass: 'bg-[#20232a] text-neutral-200 border border-[#2e323b] rounded-xl p-5',
    interactive: 'bg-[#20232a] text-neutral-200 border border-[#2e323b] hover:border-[#3d424f] hover:bg-[#252831] rounded-xl p-5 cursor-pointer',
  };

  const hoverClass = hoverEffect ? 'hover:bg-[#252831] hover:border-[#3d424f] transition-colors duration-150' : '';

  return (
    <div className={`${variantStyles[variant]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
};
