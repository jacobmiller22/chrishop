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
      className="fixed inset-0 z-50 overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-[#101317] border-l border-stone-800 h-full shadow-2xl flex flex-col z-10 text-stone-100">
        {/* Header */}
        <div className="p-6 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎒</span>
            <div>
              <h2 className="text-lg font-black uppercase font-mono tracking-tight text-stone-100">
                Gear Roll
              </h2>
              <span className="text-xs text-stone-400 font-mono">
                {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} selected
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-cart-button"
            onClick={onClose}
            aria-label="Close cart drawer"
            className="text-stone-400 hover:text-stone-100 p-2 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <span className="text-xl leading-none">✕</span>
          </button>
        </div>

        {/* Content / Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <span className="text-6xl block">🎒</span>
              <p className="text-stone-300 font-mono text-sm uppercase tracking-wider">
                Your Gear Roll is empty
              </p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Explore our small-batch bank fishing outerwear and convertible carry systems.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="mt-4 font-mono text-xs uppercase"
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
                  className="p-4 rounded-xl bg-[#15191E] border border-stone-800/80 flex items-start gap-4"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-16 h-16 rounded-lg object-cover border border-stone-800 shrink-0 bg-stone-900"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-[#101317] border border-stone-800 flex items-center justify-center text-2xl shrink-0">
                      🧥
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3
                      data-testid="cart-item-title"
                      className="text-sm font-bold text-stone-100 truncate"
                    >
                      {item.title}
                    </h3>
                    {item.variantName && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          data-testid="cart-item-variant"
                          className="text-xs text-stone-400 font-mono truncate"
                        >
                          {item.variantName}
                        </span>
                        {item.editionBadge && (
                          <Badge variant="olive" className="text-[10px] py-0 px-1">
                            {item.editionBadge}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span
                        data-testid="cart-item-price"
                        className="text-sm font-black text-[#E55B24] font-mono"
                      >
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>

                      <div className="flex items-center gap-2">
                        {onUpdateQuantity && (
                          <div className="flex items-center border border-stone-800 rounded bg-[#101317]">
                            <button
                              type="button"
                              onClick={() =>
                                item.quantity > 1
                                  ? onUpdateQuantity(item.id, item.quantity - 1)
                                  : onRemoveItem?.(item.id)
                              }
                              className="px-2 py-0.5 text-xs text-stone-400 hover:text-stone-100 font-mono"
                              aria-label="Decrease quantity"
                            >
                              -
                            </button>
                            <span
                              data-testid="cart-item-quantity"
                              className="px-2 text-xs font-mono font-bold text-stone-200"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-0.5 text-xs text-stone-400 hover:text-stone-100 font-mono"
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
                            className="text-[11px] text-stone-500 hover:text-rose-400 font-mono underline ml-1"
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
          <div className="p-6 border-t border-stone-800 bg-[#15191E]/50 space-y-4">
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Workshop Shipping</span>
                <span className="text-emerald-400 font-semibold">FREE</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-stone-800/80">
                <span className="text-sm font-bold uppercase tracking-wider text-stone-200">
                  Subtotal
                </span>
                <span
                  data-testid="cart-subtotal"
                  className="text-2xl font-black text-[#E55B24]"
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
              className="w-full font-bold uppercase tracking-wider text-sm py-3.5 shadow-lg shadow-orange-950/40"
            >
              {isCheckingOut ? 'Redirecting to Shopify...' : 'Proceed to Shopify Checkout →'}
            </Button>

            <p className="text-[10px] text-stone-500 font-mono text-center">
              Secured with Shopify Storefront API · Lifetime Repair Guarantee
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
