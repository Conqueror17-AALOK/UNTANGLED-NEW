import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'high' | 'medium' | 'low' | 'neutral' | 'chip' | 'red' | 'cyan' | 'blue' | 'purple' | 'emerald';
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
    xs: 'px-2 py-0.5 text-[10px] leading-tight rounded-md',
    sm: 'px-2.5 py-0.5 text-[11px] leading-snug rounded-md',
    md: 'px-3 py-1 text-xs leading-normal rounded-md',
  };

  const variantClasses = {
    chip: "bg-white/[0.05] text-neutral-300 border border-[#2d313a] font-medium",
    neutral: "bg-white/[0.05] text-neutral-300 border border-[#2d313a] font-medium",
    red: "bg-red-500/10 text-red-400 border border-red-500/20 font-medium",
    low: "bg-red-500/10 text-red-400 border border-red-500/20 font-medium",
    medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium",
    high: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium",
    emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium",
    cyan: "bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium",
    blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium",
    purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium",
  };

  return (
    <span className={`inline-flex items-center font-medium ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};
