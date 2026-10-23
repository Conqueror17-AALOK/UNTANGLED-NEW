import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverEffect = false,
}) => {
  return (
    <div
      className={`bg-[#12141c] border border-[#222736] rounded-lg p-4 sm:p-5 shadow-sm transition-all duration-150 ${
        hoverEffect ? 'hover:border-[#353c52] hover:bg-[#151822]' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
