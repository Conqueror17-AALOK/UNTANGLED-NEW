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
    // Adobe Firefly Chip (#2b211a dark filled surface)
    chip: "bg-[#2b211a] text-white border border-white/10 font-bold",
    // Neutral
    neutral: "bg-white/[0.08] text-white border border-white/10 font-bold",
    // Adobe Red (#eb1000) for emphasis/alerts
    red: "bg-[#eb1000]/15 text-[#eb1000] border border-[#eb1000]/30 font-bold",
    low: "bg-[#eb1000]/15 text-[#eb1000] border border-[#eb1000]/30 font-bold",
    // Medium / Amber
    medium: "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold",
    // High / Verified (Clean white/emerald)
    high: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold",
    emerald: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold",
    cyan: "bg-white/[0.1] text-white border border-white/20 font-bold",
    blue: "bg-white/[0.1] text-white border border-white/20 font-bold",
    purple: "bg-[#2b211a] text-white border border-white/10 font-bold",
  };

  return (
    <span className={`inline-flex items-center font-bold tracking-tight uppercase ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};
