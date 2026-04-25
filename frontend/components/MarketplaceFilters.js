"use client";

import NFTTypeTabs from "@/components/NFTTypeTabs";
import { SORT_OPTIONS } from "@/lib/marketplace";

function patchFilters(filters, patch, onChange) {
  onChange({ ...filters, ...patch });
}

function SearchAndSort({ filters, onChange }) {
  return (
    <>
      <input
        className="input-neo xl:col-span-2"
        placeholder="搜索名称 / 描述 / Token ID"
        value={filters.search}
        onChange={(event) => patchFilters(filters, { search: event.target.value }, onChange)}
      />
      <select
        className="input-neo"
        value={filters.sortBy}
        onChange={(event) => patchFilters(filters, { sortBy: event.target.value }, onChange)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </>
  );
}

function PriceRange({ filters, onChange }) {
  return (
    <>
      <input
        className="input-neo"
        type="number"
        min="0"
        step="0.00000001"
        placeholder="最低价格 (ETH)"
        value={filters.minPrice}
        onChange={(event) => patchFilters(filters, { minPrice: event.target.value }, onChange)}
      />
      <input
        className="input-neo"
        type="number"
        min="0"
        step="0.00000001"
        placeholder="最高价格 (ETH)"
        value={filters.maxPrice}
        onChange={(event) => patchFilters(filters, { maxPrice: event.target.value }, onChange)}
      />
    </>
  );
}

export default function MarketplaceFilters({ filters, hasActiveFilters, onChange, onReset }) {
  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <NFTTypeTabs
          selected={filters.category}
          onChange={(category) => patchFilters(filters, { category }, onChange)}
        />
        <button
          type="button"
          className="btn-outline px-3 py-2 text-xs"
          disabled={!hasActiveFilters}
          onClick={onReset}
        >
          重置筛选
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <SearchAndSort filters={filters} onChange={onChange} />
        <PriceRange filters={filters} onChange={onChange} />
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-xs text-soft">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#00d5c8]"
          checked={filters.onlyFav}
          onChange={(event) => patchFilters(filters, { onlyFav: event.target.checked }, onChange)}
        />
        仅查看收藏
      </label>
    </section>
  );
}
