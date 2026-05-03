"use client";

import { RefreshIcon } from "./NotificationIcons";
import NotificationList from "./NotificationList";
import NotificationToolbar from "./NotificationToolbar";
import { POLL_INTERVAL_MS, formatRelativeTime } from "./notification-utils";

function PanelHeader({ onRefresh, refreshing, wallet }) {
  return (
    <div className="border-b border-white/10 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--brand)]">
            Notification Center
          </p>
          <h3 className="mt-1 text-base font-black text-white">订单提醒</h3>
          <p className="mt-1 text-[11px] text-[#9fb0ca]">
            {wallet ? `每 ${Math.floor(POLL_INTERVAL_MS / 1000)} 秒自动同步` : "登录后查看订单动态"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRefresh(false)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 text-[11px] font-bold text-[#dce7ff] transition hover:border-[var(--line-strong)] hover:bg-white/[0.1]"
        >
          <RefreshIcon />
          {refreshing ? "刷新中" : "刷新"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, tone, value }) {
  const toneClass = tone === "buy" ? "text-[#79dfbf]" : tone === "sell" ? "text-[#9ec1ff]" : "text-white";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2">
      <p className="text-[11px] text-[#91a0b8]">{label}</p>
      <p className={`mt-1 text-lg font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatsRow({ counts, wallet }) {
  if (!wallet) return null;

  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-3">
      <StatCard label="未读" value={counts.unreadCount} />
      <StatCard label="买入" tone="buy" value={counts.unreadBought} />
      <StatCard label="卖出" tone="sell" value={counts.unreadSold} />
    </div>
  );
}

export default function NotificationPopover({
  activeTab,
  clearRead,
  counts,
  error,
  items,
  lastSyncAt,
  markAllRead,
  markOneRead,
  onClose,
  pollNotifications,
  refreshing,
  setActiveTab,
  visibleItems,
  wallet,
}) {
  const handleSelect = (itemId) => {
    markOneRead(itemId);
    onClose();
  };

  return (
    <div className="absolute right-0 top-11 z-[70] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-lg border border-white/14 bg-[#11151e]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl">
      <PanelHeader onRefresh={pollNotifications} refreshing={refreshing} wallet={wallet} />
      <StatsRow counts={counts} wallet={wallet} />
      <NotificationToolbar
        activeTab={activeTab}
        counts={counts}
        itemCount={items.length}
        onClearRead={clearRead}
        onMarkAllRead={markAllRead}
        setActiveTab={setActiveTab}
        wallet={wallet}
      />
      <div className="max-h-[390px] overflow-y-auto">
        <NotificationList
          activeTab={activeTab}
          error={error}
          onSelect={handleSelect}
          visibleItems={visibleItems}
          wallet={wallet}
        />
      </div>
      <div className="border-t border-white/10 px-4 py-2 text-[11px] text-[#8fa0bb]">
        {wallet ? `最近同步：${lastSyncAt ? formatRelativeTime(lastSyncAt) : "刚启动"}` : "未登录状态"}
      </div>
    </div>
  );
}
