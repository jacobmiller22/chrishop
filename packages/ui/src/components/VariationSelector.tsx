import React from 'react';
import { Badge } from './Badge';

export interface VariationOption {
  id: string;
  name: string;
  sku?: string;
  price: number;
  basePrice?: number;
  priceOverride?: number | null;
  isLimitedEdition?: boolean;
  totalEditionCount?: number | null;
  editionBadge?: string | null;
  variationType?: string;
  status?: string;
  stockQuantity?: number;
}

export interface VariationSelectorProps {
  variations: VariationOption[];
  selectedVariationId: string;
  onSelectVariation: (id: string) => void;
  className?: string;
}

export const VariationSelector: React.FC<VariationSelectorProps> = ({
  variations,
  selectedVariationId,
  onSelectVariation,
  className = '',
}) => {
  if (!variations || variations.length === 0) {
    return null;
  }

  const selectedVariation = variations.find((v) => v.id === selectedVariationId) || variations[0];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-stone-200">
          Select Batch / Variation ({variations.length})
        </label>
        <span className="text-xs text-stone-400 font-mono">
          {selectedVariation?.variationType === 'one_of_one'
            ? '1-of-1 Workshop Prototype'
            : selectedVariation?.variationType === 'micro_batch'
              ? 'Micro-Batch Run'
              : selectedVariation?.isLimitedEdition && selectedVariation.totalEditionCount
                ? `Batch of ${selectedVariation.totalEditionCount}`
                : 'Standard Production'}
        </span>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Select batch or variation">
        {variations.map((v) => {
          const isSelected = v.id === selectedVariationId;
          const isSoldOut = v.status === 'sold_out' || (v.stockQuantity !== undefined && v.stockQuantity <= 0);
          const isComingSoon = v.status === 'coming_soon';
          const hasPriceOverride = v.priceOverride != null && v.basePrice !== undefined && v.priceOverride !== v.basePrice;

          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              data-testid="variation-radio"
              data-variation-id={v.id}
              data-variation-name={v.name}
              aria-checked={isSelected}
              onClick={() => onSelectVariation(v.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 min-w-0 min-h-[44px] ${
                isSelected
                  ? 'border-[#E55B24] bg-[#E55B24]/10 shadow-md shadow-orange-500/10'
                  : 'border-stone-800 bg-[#15191E]/60 hover:border-stone-700 hover:bg-[#15191E]'
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'border-[#E55B24] bg-[#E55B24]'
                        : 'border-stone-500 bg-transparent hover:border-stone-400'
                    }`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
                  </span>
                  <span className="text-sm font-semibold text-stone-100 break-words">
                    {v.name}
                  </span>
                  {v.editionBadge && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#2C362B] text-emerald-300 border border-[#3F4F3D] px-1.5 py-0.5 rounded shrink-0">
                      {v.editionBadge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-stone-400 font-mono pl-6 flex-wrap">
                  {v.sku && <span>{v.sku}</span>}
                  {v.variationType && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{v.variationType.replace('_', ' ')}</span>
                    </>
                  )}
                  {v.isLimitedEdition && v.totalEditionCount && (
                    <>
                      <span>•</span>
                      <span>Run: {v.totalEditionCount}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-baseline gap-1.5">
                  {hasPriceOverride && v.basePrice !== undefined && (
                    <span className="text-xs line-through text-stone-500 font-mono">
                      ${Number(v.basePrice).toFixed(2)}
                    </span>
                  )}
                  <span className="text-base font-bold text-[#E55B24]">
                    ${Number(v.price).toFixed(2)}
                  </span>
                </div>

                {isSoldOut ? (
                  <Badge variant="danger" className="text-[10px] py-0 px-1.5 font-mono">
                    Depleted
                  </Badge>
                ) : isComingSoon ? (
                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5 font-mono">
                    Soon
                  </Badge>
                ) : v.stockQuantity !== undefined ? (
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {v.stockQuantity} left
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
