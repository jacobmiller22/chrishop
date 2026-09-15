import React from 'react';

export interface BadgeProps {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'orange' | 'olive';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const variantStyles = {
    info: 'bg-sky-950/80 text-sky-400 border-sky-800',
    success: 'bg-[#2C362B] text-emerald-300 border-[#3F4F3D]',
    warning: 'bg-orange-950/80 text-[#E55B24] border-orange-800/80',
    danger: 'bg-rose-950/80 text-rose-400 border-rose-800',
    neutral: 'bg-stone-900 text-stone-300 border-stone-800',
    orange: 'bg-orange-950/90 text-orange-400 border-orange-700',
    olive: 'bg-[#2C362B] text-stone-200 border-[#3F4F3D]',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
