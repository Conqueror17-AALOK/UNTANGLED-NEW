import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'high' | 'medium' | 'low' | 'neutral' | 'cyan' | 'blue' | 'purple';
  size?: 'xs' | 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.2 text-[10px] leading-tight',
    sm: 'px-2 py-0.5 text-[11px] leading-snug',
    md: 'px-2.5 py-0.5 text-xs leading-normal',
  };

  const variantClasses = {
    high: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    medium: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    low: "bg-red-500/10 text-red-400 border border-red-500/30",
    neutral: "bg-[#1c202d] text-[#94a3b8] border border-[#2b3145]",
    cyan: "bg-sky-500/10 text-sky-400 border border-sky-500/30",
    blue: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    purple: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
  };

  return (
    <span className={`inline-flex items-center rounded font-mono font-medium tracking-tight ${sizeClasses[size]} ${variantClasses[variant]}`}>
      {children}
    </span>
  );
};
