import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'high' | 'medium' | 'low' | 'neutral' | 'cyan' | 'purple';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  const variantClasses = {
    high: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium",
    medium: "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium",
    low: "bg-red-500/15 text-red-400 border border-red-500/30 font-medium",
    neutral: "bg-industrial-800 text-slate-300 border border-industrial-700",
    cyan: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-medium",
    purple: "bg-purple-500/15 text-purple-400 border border-purple-500/30 font-medium",
  };

  return (
    <span className={`inline-flex items-center rounded-md font-mono ${sizeClasses} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};
