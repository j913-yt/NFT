"use client";

const defaultItems = [
  { id: "all", label: "全部", icon: "*" },
  { id: "art", label: "艺术", icon: "[]" },
  { id: "music", label: "音乐", icon: "~" },
  { id: "video", label: "视频", icon: ">" },
  { id: "other", label: "其他", icon: "." }
];

export default function NFTTypeTabs({
  selected = "all",
  onChange,
  items = defaultItems,
  compact = false
}) {
  return (
    <div
      className={`type-tabs ${compact ? "type-tabs-compact" : ""}`}
      role="tablist"
      aria-label="NFT 分类筛选"
    >
      {items.map((item) => {
        const active = selected === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.id)}
            className={`type-tab ${active ? "active" : ""}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
