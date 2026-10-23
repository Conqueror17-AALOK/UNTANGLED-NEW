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
  const base = "inline-flex items-center justify-center font-medium transition-all duration-150 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/40 disabled:opacity-40 disabled:cursor-not-allowed select-none";
  
  const sizeClasses = {
    xs: "px-2 py-1 text-[11px] gap-1.5 font-mono",
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-3.5 py-2 text-xs sm:text-sm gap-2",
    lg: "px-5 py-2.5 text-sm gap-2.5",
  };

  const variantClasses = {
    primary: "bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-sm active:scale-[0.99]",
    engineering: "bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm border border-blue-500/40 active:scale-[0.99]",
    secondary: "bg-[#151821] hover:bg-[#222634] text-[#f1f5f9] border border-[#2a2e3d] active:scale-[0.99]",
    outline: "border border-[#2a2e3d] hover:border-[#3d4358] text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#151821]/80",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30",
    ghost: "text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#151821]/60",
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
