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
      className={`bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl backdrop-blur-sm transition-all hover:border-slate-700 ${className}`}
    >
      {children}
    </div>
  );
};
