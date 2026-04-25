"use client";

import { Tab, Tabs } from "@nextui-org/react";
import { CATEGORY_TABS } from "@/lib/marketplace";

const ICONS = Object.freeze({
  all: "▦",
  art: "◐",
  music: "♪",
  video: "▶",
  other: "•••"
});

function tabTitle(item) {
  return (
    <span className="flex items-center gap-2">
      <span className="type-tab-icon" aria-hidden="true">{ICONS[item.id] || ICONS.other}</span>
      <span>{item.label}</span>
    </span>
  );
}

export default function NFTTypeTabs({
  selected = "all",
  onChange,
  items = CATEGORY_TABS,
  compact = false
}) {
  return (
    <Tabs
      aria-label="NFT 分类筛选"
      color="primary"
      radius="full"
      selectedKey={selected}
      size={compact ? "sm" : "md"}
      variant="bordered"
      classNames={{
        base: "max-w-full",
        tabList: "flex-wrap border-white/15 bg-white/[0.04]",
        cursor: "bg-primary/25",
        tab: "font-semibold text-foreground"
      }}
      onSelectionChange={(key) => onChange?.(String(key))}
    >
      {items.map((item) => (
        <Tab key={item.id} title={tabTitle(item)} />
      ))}
    </Tabs>
  );
}
