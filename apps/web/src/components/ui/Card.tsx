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
      className={`bg-industrial-900 border border-industrial-700/80 rounded-xl p-5 shadow-xl transition-all duration-200 ${
        hoverEffect ? 'hover:border-industrial-600 hover:shadow-cyan-500/5 hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
