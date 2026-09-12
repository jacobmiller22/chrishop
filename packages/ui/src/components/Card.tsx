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
      className={`bg-[#15191E] border border-stone-800/80 rounded-xl p-6 shadow-xl backdrop-blur-sm transition-all hover:border-stone-700 ${className}`}
    >
      {children}
    </div>
  );
};
