"use client";

import { Button, Checkbox, Input, Select, SelectItem } from "@nextui-org/react";
import NFTTypeTabs from "@/components/NFTTypeTabs";
import { SORT_OPTIONS } from "@/lib/marketplace";

function patchFilters(filters, patch, onChange) {
  onChange({ ...filters, ...patch });
}

function selectedKey(keys) {
  return Array.from(keys)[0];
}

function SearchAndSort({ filters, onChange }) {
  return (
    <>
      <Input
        className="xl:col-span-2"
        label="搜索"
        placeholder="名称 / 描述 / Token ID"
        radius="sm"
        value={filters.search}
        variant="bordered"
        onValueChange={(search) => patchFilters(filters, { search }, onChange)}
      />
      <Select
        label="排序"
        radius="sm"
        selectedKeys={[filters.sortBy]}
        variant="bordered"
        onSelectionChange={(keys) => patchFilters(filters, { sortBy: selectedKey(keys) }, onChange)}
      >
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
        ))}
      </Select>
    </>
  );
}

function PriceRange({ filters, onChange }) {
  return (
    <>
      <Input
        label="最低价"
        min="0"
        placeholder="ETH"
        radius="sm"
        step="0.00000001"
        type="number"
        value={filters.minPrice}
        variant="bordered"
        onValueChange={(minPrice) => patchFilters(filters, { minPrice }, onChange)}
      />
      <Input
        label="最高价"
        min="0"
        placeholder="ETH"
        radius="sm"
        step="0.00000001"
        type="number"
        value={filters.maxPrice}
        variant="bordered"
        onValueChange={(maxPrice) => patchFilters(filters, { maxPrice }, onChange)}
      />
    </>
  );
}

export default function MarketplaceFilters({ filters, hasActiveFilters, onChange, onReset }) {
  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <NFTTypeTabs selected={filters.category} onChange={(category) => patchFilters(filters, { category }, onChange)} />
        <Button color="primary" isDisabled={!hasActiveFilters} radius="full" size="sm" variant="flat" onPress={onReset}>
          重置筛选
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SearchAndSort filters={filters} onChange={onChange} />
        <PriceRange filters={filters} onChange={onChange} />
      </div>

      <Checkbox
        className="mt-3"
        color="primary"
        isSelected={filters.onlyFav}
        onValueChange={(onlyFav) => patchFilters(filters, { onlyFav }, onChange)}
      >
        仅查看收藏
      </Checkbox>
    </section>
  );
}
