import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'interactive' | 'telemetry' | 'well';
  accent?: 'cyan' | 'emerald' | 'amber' | 'blue' | 'purple';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'glass',
  accent,
  hoverEffect = false,
}) => {
  const variantStyles = {
    glass: 'premium-glass',
    interactive: 'premium-glass premium-glass-hover cursor-pointer',
    default: 'premium-glass',
    well: 'glass-well',
    telemetry: 'premium-glass bg-[#080d1a]/70',
  };

  const accentStyles = {
    cyan: 'glass-accent-cyan',
    emerald: 'glass-accent-emerald',
    amber: 'glass-accent-amber',
    blue: 'glass-accent-blue',
    purple: 'glass-accent-purple',
  };

  const hoverClass = hoverEffect ? 'premium-glass-hover' : '';
  const accentClass = accent ? accentStyles[accent] : '';

  return (
    <div
      className={`rounded-2xl p-5 sm:p-6 transition-all duration-300 ${variantStyles[variant]} ${accentClass} ${hoverClass} ${className}`}
    >
      {children}
    </div>
  );
};
