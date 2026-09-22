import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#15191E] border border-stone-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-stone-700 hover:-translate-y-0.5 ${className}`}
    >
      {children}
    </div>
  );
};

