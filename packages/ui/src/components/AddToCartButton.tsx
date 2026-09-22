import React from 'react';
import { Button } from './Button';

export interface AddToCartButtonProps {
  price?: number;
  status?: 'active' | 'sold_out' | 'coming_soon' | string;
  stockQuantity?: number;
  isLoading?: boolean;
  loadingText?: string;
  onClick?: () => void | Promise<void>;
  className?: string;
  children?: React.ReactNode;
}

export const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  price,
  status = 'active',
  stockQuantity,
  isLoading = false,
  loadingText = 'Preparing Gear Roll...',
  onClick,
  className = '',
  children,
}) => {
  const isSoldOut = status === 'sold_out' || (stockQuantity !== undefined && stockQuantity <= 0);
  const isComingSoon = status === 'coming_soon';
  const isDisabled = isSoldOut || isComingSoon || isLoading;

  let buttonLabel: React.ReactNode;
  if (isLoading) {
    buttonLabel = loadingText;
  } else if (isSoldOut) {
    buttonLabel = 'Batch Depleted';
  } else if (isComingSoon) {
    buttonLabel = 'Releases Soon';
  } else if (children) {
    buttonLabel = children;
  } else if (price !== undefined) {
    buttonLabel = `Deploy Gear • $${Number(price).toFixed(2)}`;
  } else {
    buttonLabel = 'Deploy Gear';
  }

  return (
    <Button
      variant="primary"
      size="lg"
      disabled={isDisabled}
      onClick={onClick}
      className={`w-full font-bold uppercase tracking-wider shadow-lg shadow-orange-950/40 py-3.5 text-base bg-[#E55B24] hover:bg-[#D04A15] text-white border-none min-h-[48px] ${className}`}
    >
      {buttonLabel}
    </Button>
  );
};
