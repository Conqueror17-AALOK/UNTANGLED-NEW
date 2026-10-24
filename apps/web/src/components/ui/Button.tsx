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
  const base = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer";
  
  const sizeClasses = {
    xs: "px-2.5 py-1 text-[11px] gap-1.5 font-mono",
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-xs sm:text-sm gap-2",
    lg: "px-6 py-2.5 text-sm sm:text-base font-semibold gap-2.5 shadow-lg",
  };

  const variantClasses = {
    primary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-[0_4px_16px_rgba(37,99,235,0.35)] border border-blue-400/30 active:scale-[0.98] hover:shadow-[0_6px_24px_rgba(37,99,235,0.5)]",
    engineering: "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold shadow-[0_4px_20px_rgba(6,182,212,0.35)] border border-cyan-400/40 active:scale-[0.98] hover:shadow-[0_6px_28px_rgba(6,182,212,0.5)]",
    secondary: "bg-[#151821]/90 hover:bg-[#202534] text-[#f1f5f9] border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] active:scale-[0.98] hover:border-white/20",
    outline: "border border-white/10 hover:border-cyan-500/40 text-[#94a3b8] hover:text-cyan-300 hover:bg-cyan-500/[0.05] active:scale-[0.98]",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 active:scale-[0.98]",
    ghost: "text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-white/[0.06]",
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
