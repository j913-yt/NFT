"use client";

import { CATEGORY_TABS } from "@/lib/marketplace";

const ICONS = Object.freeze({
  all: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" fill="currentColor" />
    </svg>
  ),
  art: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4C7.58 4 4 7.13 4 11c0 2.76 2.19 5 4.88 5h.72a1.9 1.9 0 0 1 1.85 2.34A1.33 1.33 0 0 0 12.74 20H13c3.87 0 7-3.13 7-7 0-4.97-3.58-9-8-9Z" fill="currentColor" />
      <circle cx="7.75" cy="10" r="1" fill="#101016" />
      <circle cx="11" cy="8.5" r="1" fill="#101016" />
      <circle cx="14.5" cy="9.6" r="1" fill="#101016" />
    </svg>
  ),
  music: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 4.5v10.2a2.9 2.9 0 1 1-1.6-2.59V7.2l-6.8 1.5v7a2.9 2.9 0 1 1-1.6-2.59V7.4a1.5 1.5 0 0 1 1.18-1.46l7.6-1.67A1 1 0 0 1 16 4.5Z" fill="currentColor" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="11" height="12" rx="2" fill="currentColor" />
      <path d="M20 8.8v6.4c0 .77-.83 1.24-1.48.84L15 13.8v-3.6l3.52-2.24c.65-.4 1.48.07 1.48.84Z" fill="currentColor" />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="12" r="2" fill="currentColor" />
    </svg>
  )
});

export default function NFTTypeTabs({
  selected = "all",
  onChange,
  items = CATEGORY_TABS,
  compact = false
}) {
  return (
    <div className={`type-tabs ${compact ? "type-tabs-compact" : ""}`} role="tablist" aria-label="NFT 分类筛选">
      {items.map((item) => {
        const active = selected === item.id;
        const iconNode = item.icon || ICONS[item.id] || ICONS.other;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`type-tab ${active ? "active" : ""}`}
            onClick={() => onChange?.(item.id)}
          >
            <span className="type-tab-icon" aria-hidden="true">{iconNode}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
