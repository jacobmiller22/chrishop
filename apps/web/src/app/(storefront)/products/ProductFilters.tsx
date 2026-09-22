'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Category } from '@/lib/catalog';
import { Button } from '@chrishop/ui';

export interface ProductFiltersProps {
  categories: Category[];
  activeCategory?: string;
  activeSort?: string;
  activeType?: string;
  totalCount: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  apparel: '🧥',
  'packs-carry': '🎒',
  'field-accessories': '🧰',
  outerwear: '🌧️',
  'waterproof-storm-shells': '⚡',
  'storm-shells': '⚡',
  pants: '👖',
  'technical-brush-pants': '🪨',
  'brush-pants': '🪨',
  'sling-packs': '🎒',
  'chest-rigs': '🎣',
  'dry-bags': '🌊',
  'tool-rolls': '🧵',
  gloves: '🧤',
  headwear: '🧢',
};

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest Additions' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'title', label: 'Alphabetical (A-Z)' },
] as const;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Gear' },
  { value: 'micro_batch', label: 'Micro-Batch & 1-of-1' },
  { value: 'standard', label: 'Standard Production' },
] as const;

export function ProductFilters({
  categories,
  activeCategory,
  activeSort = 'latest',
  activeType = 'all',
  totalCount,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Mobile drawer open state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Helper to build URL with updated search params
  const buildUrl = useCallback(
    (updates: { category?: string | null; sort?: string | null; type?: string | null }) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : '');

      if (updates.category !== undefined) {
        if (updates.category) params.set('category', updates.category);
        else params.delete('category');
      }

      if (updates.sort !== undefined) {
        if (updates.sort && updates.sort !== 'latest') params.set('sort', updates.sort);
        else params.delete('sort');
      }

      if (updates.type !== undefined) {
        if (updates.type && updates.type !== 'all') params.set('type', updates.type);
        else params.delete('type');
      }

      const query = params.toString();
      return `${pathname}${query ? `?${query}` : ''}`;
    },
    [pathname, searchParams]
  );

  const handleUpdate = (updates: {
    category?: string | null;
    sort?: string | null;
    type?: string | null;
  }) => {
    const url = buildUrl(updates);
    startTransition(() => {
      router.push(url);
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push(pathname);
      setDrawerOpen(false);
    });
  };

  // Hierarchy splits
  const topCategories = categories.filter((c) => !c.parent_id);
  const subCategories = categories.filter((c) => Boolean(c.parent_id));

  // Active category object
  const activeCategoryObj = categories.find(
    (c) => c.slug === activeCategory || c.id === activeCategory
  );

  // Active filter count for badge
  let activeFilterCount = 0;
  if (activeCategory) activeFilterCount++;
  if (activeSort && activeSort !== 'latest') activeFilterCount++;
  if (activeType && activeType !== 'all') activeFilterCount++;

  return (
    <div className="space-y-4">
      {/* Top Controls: Category Pills & Mobile Drawer Trigger */}
      <div className="flex flex-col gap-3">
        {/* Primary Categories (Desktop & Tablet) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildUrl({ category: null })}
              className={`min-h-[44px] inline-flex items-center px-4 py-2 rounded-full text-xs font-mono uppercase font-semibold transition-all ${
                !activeCategory
                  ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                  : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-[#E55B24]/50 hover:text-orange-400'
              }`}
            >
              All Gear ({totalCount})
            </Link>

            {topCategories.map((cat) => {
              const isSelected = activeCategory === cat.slug;
              const icon = CATEGORY_ICONS[cat.slug] || '🎒';
              return (
                <Link
                  key={cat.id}
                  href={buildUrl({ category: isSelected ? null : cat.slug })}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-mono uppercase font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                      : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-[#E55B24]/50 hover:text-orange-400'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{cat.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Filter Drawer Button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open filter and sort drawer"
            className="md:hidden min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#15191E] border border-stone-800 text-xs font-mono uppercase font-semibold text-stone-200 hover:border-[#E55B24]/60 transition-colors"
          >
            <svg
              className="w-4 h-4 text-[#E55B24]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filter & Sort</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#E55B24] text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Subcategory Pills (Level 1 & 2) */}
        {subCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-stone-500 uppercase mr-1">
              Sub-Categories:
            </span>
            {subCategories.map((cat) => {
              const isSelected = activeCategory === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={buildUrl({ category: isSelected ? null : cat.slug })}
                  className={`min-h-[44px] inline-flex items-center px-3.5 py-2 rounded-full text-[11px] font-mono transition-all ${
                    isSelected
                      ? 'bg-[#2C362B] text-emerald-300 border border-emerald-700 font-bold'
                      : 'bg-stone-900/60 text-stone-400 border border-stone-800/80 hover:text-stone-200 hover:border-stone-700'
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Toolbar: Sort & Edition Filter Bar */}
      <div className="hidden md:flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-[#101317] border border-stone-800/80">
        {/* Edition / Batch Type Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-stone-400 uppercase mr-1">Batch:</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleUpdate({ type: opt.value })}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-semibold transition-all ${
                activeType === opt.value
                  ? 'bg-stone-800 text-stone-100 border border-stone-700'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort Select Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="catalog-sort" className="text-xs font-mono text-stone-400 uppercase">
            Sort:
          </label>
          <select
            id="catalog-sort"
            value={activeSort}
            onChange={(e) => handleUpdate({ sort: e.target.value })}
            aria-label="Sort catalog equipment"
            className="min-h-[44px] bg-[#15191E] border border-stone-800 rounded-lg px-3 py-2 text-base font-mono text-stone-200 focus:outline-none focus:border-[#E55B24] cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#15191E] text-stone-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Chips & Reset All */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs font-mono">
          <span className="text-stone-500 uppercase">Active Filters:</span>

          {activeCategoryObj && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C362B] text-emerald-300 border border-emerald-700">
              <span>Category: {activeCategoryObj.name}</span>
              <button
                type="button"
                onClick={() => handleUpdate({ category: null })}
                aria-label={`Remove category filter ${activeCategoryObj.name}`}
                className="hover:text-emerald-100 font-bold p-1 min-h-[44px] min-w-[24px] inline-flex items-center justify-center"
              >
                ✕
              </button>
            </span>
          )}

          {activeType && activeType !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-950/80 text-orange-300 border border-orange-800">
              <span>Type: {TYPE_OPTIONS.find((t) => t.value === activeType)?.label}</span>
              <button
                type="button"
                onClick={() => handleUpdate({ type: null })}
                aria-label="Remove batch type filter"
                className="hover:text-orange-100 font-bold p-1 min-h-[44px] min-w-[24px] inline-flex items-center justify-center"
              >
                ✕
              </button>
            </span>
          )}

          {activeSort && activeSort !== 'latest' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-stone-300 border border-stone-700">
              <span>Sort: {SORT_OPTIONS.find((s) => s.value === activeSort)?.label}</span>
              <button
                type="button"
                onClick={() => handleUpdate({ sort: null })}
                aria-label="Reset sort to default"
                className="hover:text-stone-100 font-bold p-1 min-h-[44px] min-w-[24px] inline-flex items-center justify-center"
              >
                ✕
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={clearAllFilters}
            className="min-h-[44px] px-3 py-1.5 text-stone-400 hover:text-[#E55B24] underline underline-offset-4 transition-colors font-semibold uppercase tracking-wider"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Mobile Drawer / Slide-Over Modal */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter and Sort Equipment"
          className="fixed inset-0 z-50 flex justify-end md:hidden"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative w-full max-w-sm bg-[#101317] border-l border-stone-800 h-full overflow-y-auto p-6 flex flex-col justify-between z-10">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧰</span>
                  <h2 className="text-lg font-bold text-stone-100 font-mono uppercase">
                    Filter Equipment
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close filter drawer"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-400 hover:text-stone-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Sort Section */}
              <div className="space-y-3">
                <span className="text-xs font-mono text-[#E55B24] uppercase font-bold tracking-wider block">
                  Sort Order
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdate({ sort: opt.value })}
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-left text-xs font-mono uppercase font-semibold flex items-center justify-between transition-all ${
                        activeSort === opt.value
                          ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                          : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {activeSort === opt.value && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch Type Section */}
              <div className="space-y-3">
                <span className="text-xs font-mono text-[#E55B24] uppercase font-bold tracking-wider block">
                  Production Batch
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdate({ type: opt.value })}
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl text-left text-xs font-mono uppercase font-semibold flex items-center justify-between transition-all ${
                        activeType === opt.value
                          ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                          : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {activeType === opt.value && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories Section */}
              <div className="space-y-3">
                <span className="text-xs font-mono text-[#E55B24] uppercase font-bold tracking-wider block">
                  Category Hierarchy
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate({ category: null })}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl text-left text-xs font-mono uppercase font-semibold flex items-center justify-between transition-all ${
                      !activeCategory
                        ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                        : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <span>All Equipment</span>
                    {!activeCategory && <span>✓</span>}
                  </button>

                  {categories.map((cat) => {
                    const isSelected = activeCategory === cat.slug;
                    const isSub = Boolean(cat.parent_id);
                    const icon = CATEGORY_ICONS[cat.slug] || '🎒';
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleUpdate({ category: isSelected ? null : cat.slug })}
                        className={`min-h-[44px] px-4 py-2.5 rounded-xl text-left text-xs font-mono uppercase font-semibold flex items-center justify-between transition-all ${
                          isSub ? 'pl-8' : ''
                        } ${
                          isSelected
                            ? 'bg-[#E55B24] text-white shadow-lg shadow-orange-950/40'
                            : 'bg-[#15191E] text-stone-300 border border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {!isSub && <span>{icon}</span>}
                          {isSub && <span className="text-stone-500">↳</span>}
                          <span>{cat.name}</span>
                        </span>
                        {isSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Actions Footer */}
            <div className="pt-6 border-t border-stone-800 space-y-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="w-full min-h-[44px] py-2 text-xs font-mono text-stone-400 hover:text-stone-200 uppercase font-semibold text-center block"
                >
                  Reset All Filters
                </button>
              )}
              <Button
                variant="primary"
                onClick={() => setDrawerOpen(false)}
                className="w-full min-h-[44px] font-mono text-xs uppercase font-bold tracking-wider"
              >
                Show Results ({totalCount})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
