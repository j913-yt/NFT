"use client";

const defaultItems = [
  { id: "all", label: "\u5168\u90e8" },
  { id: "art", label: "\u827a\u672f" },
  { id: "music", label: "\u97f3\u4e50" },
  { id: "video", label: "\u89c6\u9891" },
  { id: "other", label: "\u5176\u4ed6" }
];

const iconById = {
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
      <path
        d="M12 4C7.582 4 4 7.134 4 11c0 2.762 2.186 5 4.882 5h.718a1.9 1.9 0 0 1 1.85 2.338A1.33 1.33 0 0 0 12.742 20H13c3.866 0 7-3.134 7-7 0-4.97-3.582-9-8-9Z"
        fill="currentColor"
      />
      <circle cx="7.75" cy="10" r="1" fill="#0d1118" />
      <circle cx="11" cy="8.5" r="1" fill="#0d1118" />
      <circle cx="14.5" cy="9.6" r="1" fill="#0d1118" />
    </svg>
  ),
  music: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 4.5v10.2a2.9 2.9 0 1 1-1.6-2.59V7.2l-6.8 1.5v7a2.9 2.9 0 1 1-1.6-2.59V7.4a1.5 1.5 0 0 1 1.18-1.46l7.6-1.67A1 1 0 0 1 16 4.5Z"
        fill="currentColor"
      />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="11" height="12" rx="2" fill="currentColor" />
      <path
        d="M20 8.8v6.4c0 .77-.83 1.24-1.48.84L15 13.8v-3.6l3.52-2.24c.65-.4 1.48.07 1.48.84Z"
        fill="currentColor"
      />
    </svg>
  ),
  other: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="12" r="2" fill="currentColor" />
    </svg>
  )
};

export default function NFTTypeTabs({
  selected = "all",
  onChange,
  items = defaultItems,
  compact = false
}) {
  return (
    <div
      className={`flex flex-wrap gap-2 sm:gap-3 ${compact ? "" : ""}`}
      role="tablist"
      aria-label="NFT 分类筛选"
    >
      {items.map((item) => {
        const active = selected === item.id;
        const iconNode =
          item.icon && typeof item.icon !== "string"
            ? item.icon
            : iconById[item.id] || iconById.other;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.id)}
            className={`group relative flex items-center gap-1.5 overflow-hidden rounded-full border transition-all duration-300 ${
              compact ? "px-3.5 py-1.5 text-[11px]" : "px-4 py-2 text-xs sm:text-sm"
            } font-bold ${
              active
                ? "border-blue-400/50 bg-blue-500/20 text-white shadow-[0_0_15px_rgba(95,141,255,0.25)]"
                : "border-white/10 bg-white/5 text-[#a4b5d8] hover:border-white/30 hover:bg-white/10 hover:text-white"
            }`}
          >
            {active && (
              <div className="absolute inset-0 bg-gradient-to-r from-[#5f8dff]/20 to-[#37c8d0]/20 opacity-80" />
            )}
            <span
              className={`relative z-10 flex items-center justify-center rounded-full transition-colors ${
                compact ? "h-4 w-4" : "h-5 w-5"
              } ${
                active
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-[#a4b5d8] group-hover:bg-white/20 group-hover:text-white"
              }`}
              aria-hidden="true"
            >
              <div className={`[&>svg]:block ${compact ? "[&>svg]:h-2.5 [&>svg]:w-2.5" : "[&>svg]:h-3 [&>svg]:w-3"}`}>
                {iconNode}
              </div>
            </span>
            <span className="relative z-10 drop-shadow-sm">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
