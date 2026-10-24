import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost' | 'engineering';
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
  const base = "inline-flex items-center justify-center font-medium tracking-tight transition-all duration-150 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed";
  
  const sizeClasses = {
    xs: "px-2.5 py-1 text-xs h-7 rounded-md gap-1.5",
    sm: "px-3 py-1.5 text-xs h-8 rounded-lg gap-1.5",
    md: "px-4 py-2 text-xs sm:text-sm h-9 sm:h-10 rounded-lg gap-2",
    lg: "px-6 py-2.5 text-sm sm:text-base h-11 rounded-lg gap-2.5",
  };

  const variantClasses = {
    primary: "bg-neutral-100 text-neutral-900 hover:bg-white active:scale-[0.98] border border-transparent font-medium shadow-sm",
    engineering: "bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98] border border-transparent font-medium shadow-sm",
    secondary: "bg-[#20232a] text-neutral-200 border border-[#2e323b] hover:bg-[#252831] hover:text-white active:scale-[0.98] font-medium",
    tertiary: "bg-transparent text-neutral-400 hover:text-white p-0 font-medium hover:underline",
    danger: "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98] font-medium rounded-lg",
    ghost: "bg-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04] rounded-lg font-medium",
  };

  const isTertiary = variant === 'tertiary';

  return (
    <button
      className={`${base} ${isTertiary ? 'p-0 text-sm' : sizeClasses[size]} ${variantClasses[variant]} ${className}`}
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
