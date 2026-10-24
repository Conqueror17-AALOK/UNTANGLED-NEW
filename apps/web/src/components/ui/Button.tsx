import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'engineering';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const base = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer";
  
  const sizeClasses = {
    xs: "px-2.5 py-1 text-[11px] gap-1.5 font-mono",
    sm: "px-3.5 py-1.5 text-xs gap-1.5",
    md: "px-4.5 py-2 text-xs sm:text-sm gap-2",
    lg: "px-6 py-2.5 text-sm sm:text-base font-semibold gap-2.5 shadow-lg",
  };

  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_4px_20px_rgba(37,99,235,0.4)] border border-blue-400/40 border-t-white/30 active:scale-[0.98] hover:shadow-[0_6px_28px_rgba(37,99,235,0.55)]",
    engineering: "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_4px_24px_rgba(6,182,212,0.35)] border border-cyan-400/40 border-t-white/40 active:scale-[0.98] hover:shadow-[0_6px_32px_rgba(6,182,212,0.5)]",
    secondary: "bg-white/[0.05] hover:bg-white/[0.09] text-white border border-white/[0.12] border-t-white/[0.25] shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98] hover:border-white/25 backdrop-blur-xl",
    outline: "border border-white/[0.12] hover:border-cyan-400/50 text-slate-300 hover:text-white bg-white/[0.02] hover:bg-cyan-500/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-md active:scale-[0.98]",
    danger: "bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/35 border-t-red-400/50 active:scale-[0.98] backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.2)]",
    ghost: "text-slate-400 hover:text-white hover:bg-white/[0.06] active:scale-[0.98]",
  };

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};
