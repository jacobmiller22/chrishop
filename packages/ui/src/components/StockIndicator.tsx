import React from 'react';
import { Badge } from './Badge';

export interface StockIndicatorProps {
  status?: 'active' | 'sold_out' | 'coming_soon' | string;
  stockQuantity?: number;
  isLimitedEdition?: boolean;
  totalEditionCount?: number | null;
  className?: string;
}

export const StockIndicator: React.FC<StockIndicatorProps> = ({
  status = 'active',
  stockQuantity,
  isLimitedEdition = false,
  totalEditionCount,
  className = '',
}) => {
  const isSoldOut = status === 'sold_out' || (stockQuantity !== undefined && stockQuantity <= 0);
  const isComingSoon = status === 'coming_soon';

  if (isSoldOut) {
    return (
      <Badge variant="danger" className={`font-mono uppercase tracking-wider font-bold ${className}`}>
        Batch Depleted
      </Badge>
    );
  }

  if (isComingSoon) {
    return (
      <Badge variant="neutral" className={`font-mono uppercase tracking-wider ${className}`}>
        In Production
      </Badge>
    );
  }

  // Active / In Stock State
  if (stockQuantity !== undefined && stockQuantity > 0 && stockQuantity <= 5) {
    return (
      <Badge variant="warning" className={`font-mono uppercase tracking-wider font-bold ${className}`}>
        Only {stockQuantity} Remaining
      </Badge>
    );
  }

  if (isLimitedEdition && totalEditionCount) {
    return (
      <Badge variant="success" className={`font-mono uppercase tracking-wider font-bold ${className}`}>
        {stockQuantity !== undefined
          ? `${stockQuantity} of ${totalEditionCount} Available`
          : `Limited Edition (${totalEditionCount} Crafted)`}
      </Badge>
    );
  }

  return (
    <Badge variant="success" className={`font-mono uppercase tracking-wider font-bold ${className}`}>
      {stockQuantity !== undefined ? `In Stock (${stockQuantity} Ready)` : 'In Stock · Ready to Ship'}
    </Badge>
  );
};
