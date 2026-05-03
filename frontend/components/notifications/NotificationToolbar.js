function SegmentButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
        active ? "bg-[var(--brand)] text-[#071010]" : "text-[#aebad0] hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-8 rounded-lg px-2 text-[11px] font-bold text-[#cbd7f2] transition hover:bg-white/[0.07] hover:text-white"
    >
      {children}
    </button>
  );
}

export default function NotificationToolbar({
  activeTab,
  counts,
  itemCount,
  onClearRead,
  onMarkAllRead,
  setActiveTab,
  wallet,
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-y border-white/10 px-3 py-2">
      <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5">
        <SegmentButton active={activeTab === "all"} onClick={() => setActiveTab("all")}>
          全部 ({itemCount})
        </SegmentButton>
        <SegmentButton active={activeTab === "unread"} onClick={() => setActiveTab("unread")}>
          未读 ({counts.unreadCount})
        </SegmentButton>
      </div>
      {wallet && (
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={onMarkAllRead}>全读</ToolbarButton>
          <ToolbarButton onClick={onClearRead}>清理</ToolbarButton>
        </div>
      )}
    </div>
  );
}
