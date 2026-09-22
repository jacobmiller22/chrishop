import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1215] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantStyles = {
    primary:
      'bg-[#E55B24] hover:bg-[#D04A15] text-white uppercase tracking-wider font-bold shadow-lg shadow-orange-950/40 focus-visible:ring-[#E55B24]',
    secondary:
      'bg-[#2C362B] hover:bg-[#374336] text-[#E7E4DC] border border-stone-700/60 focus-visible:ring-stone-500',
    outline:
      'border border-stone-700 text-[#E7E4DC] hover:bg-stone-800/80 hover:border-stone-500 focus-visible:ring-stone-500',
    ghost:
      'text-[#E55B24] hover:text-orange-400 hover:bg-stone-800/60 focus-visible:ring-[#E55B24]',
  };

  const sizeStyles = {
    sm: 'px-3 py-2 min-h-[44px] min-w-[44px] text-sm',
    md: 'px-4 py-2.5 min-h-[44px] min-w-[44px] text-base',
    lg: 'px-6 py-3.5 min-h-[48px] min-w-[48px] text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

