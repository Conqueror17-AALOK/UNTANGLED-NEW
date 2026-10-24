import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'high' | 'medium' | 'low' | 'neutral' | 'cyan' | 'blue' | 'purple' | 'emerald';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] leading-tight',
    sm: 'px-2 py-0.5 text-[11px] leading-snug',
    md: 'px-2.5 py-0.5 text-xs leading-normal',
  };

  const variantClasses = {
    high: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 shadow-[0_0_12px_rgba(16,185,129,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
    medium: "bg-amber-500/15 text-amber-300 border border-amber-400/35 shadow-[0_0_12px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
    low: "bg-red-500/15 text-red-300 border border-red-400/35 shadow-[0_0_12px_rgba(239,68,68,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
    neutral: "bg-white/[0.05] text-slate-300 border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
    cyan: "bg-cyan-500/15 text-cyan-300 border border-cyan-400/35 shadow-[0_0_12px_rgba(6,182,212,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
    blue: "bg-blue-500/15 text-blue-300 border border-blue-400/35 shadow-[0_0_12px_rgba(59,130,246,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
    purple: "bg-purple-500/15 text-purple-300 border border-purple-400/35 shadow-[0_0_12px_rgba(168,85,247,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
    emerald: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 shadow-[0_0_12px_rgba(16,185,129,0.2),inset_0_1px_0_0_rgba(255,255,255,0.2)]",
  };

  return (
    <span className={`inline-flex items-center rounded-md font-mono font-medium backdrop-blur-md transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};
