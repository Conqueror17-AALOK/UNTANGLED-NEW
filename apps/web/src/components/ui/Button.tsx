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
  const base = "inline-flex items-center justify-center font-bold tracking-tight transition-all duration-150 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#eb1000] disabled:opacity-40 disabled:cursor-not-allowed";
  
  const sizeClasses = {
    xs: "px-3 py-1 text-[11px] h-7 rounded-full font-mono gap-1.5",
    sm: "px-4 py-1.5 text-xs h-8 rounded-full gap-2",
    md: "px-6 py-2.5 text-sm h-10 rounded-full gap-2", // Matches 40px height & 13px 24px padding spec
    lg: "px-8 py-3 text-base h-12 rounded-full gap-2.5",
  };

  const variantClasses = {
    // Adobe Firefly / Podcast Primary: Crisp pure white pill with deep black ink text, subtle tonal hover
    primary: "bg-[#ffffff] text-[#000000] hover:bg-[#e5e7eb] active:scale-[0.98] border border-transparent font-bold",
    // Engineering primary (same high-contrast white pill or crisp accent)
    engineering: "bg-[#ffffff] text-[#000000] hover:bg-[#e5e7eb] active:scale-[0.98] border border-transparent font-bold",
    // Adobe Firefly / Podcast Secondary: Rounded-full border-led pill
    secondary: "bg-transparent text-[#ffffff] border border-white/25 hover:border-white/50 hover:bg-white/[0.06] active:scale-[0.98] font-bold",
    // Adobe Tertiary: Transparent text button
    tertiary: "bg-transparent text-[#d1d5db] hover:text-[#ffffff] p-0 font-bold hover:underline",
    // Danger with Adobe Red #eb1000
    danger: "bg-[#eb1000] text-white hover:bg-[#c90d00] active:scale-[0.98] font-bold rounded-full",
    // Ghost
    ghost: "bg-transparent text-[#9ca3af] hover:text-[#ffffff] hover:bg-white/[0.06] rounded-full font-bold",
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
