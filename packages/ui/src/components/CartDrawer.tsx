'use client';

import React, { useEffect } from 'react';
import { Button } from './Button';
import { Badge } from './Badge';

export interface CartItem {
  id: string;
  variantId?: string;
  title: string;
  variantName?: string;
  editionBadge?: string | null;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity?: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
  onCheckout: () => void;
  isCheckingOut?: boolean;
  checkoutError?: string | null;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  isCheckingOut = false,
  checkoutError = null,
}) => {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gear Roll Cart Drawer"
      data-testid="cart-drawer"
      className="fixed inset-0 z-[70] overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-[#1A1613] border-l border-[#3A2E24] h-full shadow-2xl flex flex-col z-10 text-[#EFE8DC]">
        {/* Header */}
        <div className="p-6 border-b border-[#3A2E24] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[#A8472A] font-bold text-base">//</span>
            <div>
              <h2 className="text-lg font-black uppercase font-mono tracking-tight text-[#F8F5EE]">
                Gear Roll
              </h2>
              <span className="text-xs text-[#DDD0BE]/70 font-mono">
                {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} selected
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-cart-button"
            onClick={onClose}
            aria-label="Close cart drawer"
            className="text-[#DDD0BE]/70 hover:text-white p-2 rounded-lg hover:bg-[#2A211A] transition-colors"
          >
            <span className="text-xl leading-none">✕</span>
          </button>
        </div>

        {/* Content / Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-xl border border-[#3A2E24] bg-[#2A211A] flex items-center justify-center text-[#DDD0BE]/50">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-[#EFE8DC] font-mono text-xs uppercase tracking-wider">
                [ GEAR ROLL EMPTY ]
              </p>
              <p className="text-xs text-[#DDD0BE]/60 max-w-xs mx-auto">
                Explore our small-batch bank fishing outerwear and convertible carry systems.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="mt-4 font-mono text-xs uppercase border-[#3A2E24] text-[#EFE8DC] hover:bg-[#2A211A]"
              >
                Browse Catalog
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  data-testid="cart-line-item"
                  className="p-4 rounded-xl bg-[#2A211A] border border-[#3A2E24] flex items-start gap-4"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-16 h-16 rounded-lg object-cover border border-[#3A2E24] shrink-0 bg-[#1A1613]"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#1A1613] border border-[#3A2E24] flex items-center justify-center font-mono text-[10px] text-[#DDD0BE]/50 shrink-0 uppercase">
                      Spec
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3
                      data-testid="cart-item-title"
                      className="text-sm font-bold text-[#F8F5EE] truncate"
                    >
                      {item.title}
                    </h3>
                    {item.variantName && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          data-testid="cart-item-variant"
                          className="text-xs text-[#DDD0BE]/70 font-mono truncate"
                        >
                          {item.variantName}
                        </span>
                        {item.editionBadge && (
                          <Badge variant="olive" className="text-[10px] py-0 px-1 bg-[#2C362B] text-emerald-300 border-[#3F4F3D]">
                            {item.editionBadge}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span
                        data-testid="cart-item-price"
                        className="text-sm font-black text-[#A8472A] font-mono"
                      >
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>

                      <div className="flex items-center gap-2">
                        {onUpdateQuantity && (
                          <div className="flex items-center border border-[#3A2E24] rounded bg-[#1A1613]">
                            <button
                              type="button"
                              onClick={() =>
                                item.quantity > 1
                                  ? onUpdateQuantity(item.id, item.quantity - 1)
                                  : onRemoveItem?.(item.id)
                              }
                              className="px-2 py-0.5 text-xs text-[#DDD0BE]/70 hover:text-white font-mono"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span
                              data-testid="cart-item-quantity"
                              className="px-2 text-xs font-mono font-bold text-[#EFE8DC]"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-0.5 text-xs text-[#DDD0BE]/70 hover:text-white font-mono"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        )}
                        {onRemoveItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="text-[11px] text-[#DDD0BE]/50 hover:text-rose-400 font-mono underline ml-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-[#3A2E24] bg-[#1E1813] space-y-4">
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between text-[#DDD0BE]/70">
                <span>Workshop Shipping</span>
                <span className="text-emerald-400 font-semibold">FREE</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-[#3A2E24]/70">
                <span className="text-sm font-bold uppercase tracking-wider text-[#EFE8DC]">
                  Subtotal
                </span>
                <span
                  data-testid="cart-subtotal"
                  className="text-2xl font-black text-[#A8472A]"
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>
            </div>

            {checkoutError && (
              <p className="text-xs text-rose-400 font-mono text-center">{checkoutError}</p>
            )}

            <Button
              variant="primary"
              size="lg"
              data-testid="checkout-button"
              disabled={isCheckingOut}
              onClick={onCheckout}
              className="w-full font-bold uppercase tracking-wider text-sm py-3.5 !bg-[#A8472A] hover:!bg-[#8C371D] text-white border-none shadow-md shadow-black/20"
            >
              {isCheckingOut ? 'Redirecting to Shopify...' : 'Proceed to Shopify Checkout →'}
            </Button>

            <p className="text-[10px] text-[#DDD0BE]/50 font-mono text-center">
              Secured with Shopify Storefront API · Lifetime Repair Guarantee
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
