"use client";

import Link from "next/link";
import { InboxIcon } from "./NotificationIcons";
import { formatPriceEth, formatRelativeTime } from "./notification-utils";

function EmptyState({ activeTab, wallet }) {
  const title = wallet ? "暂无通知" : "通知中心未激活";
  const detail = wallet
    ? activeTab === "unread"
      ? "当前没有未读消息"
      : "有新成交时会在这里显示"
    : "完成钱包登录后会自动开始订单轮询";

  return (
    <div className="mx-3 my-3 rounded-lg border border-dashed border-white/14 bg-white/[0.035] px-4 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[#9fb0ca]">
        <InboxIcon />
      </div>
      <p className="mt-4 text-sm font-bold text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-[#9fb0ca]">{detail}</p>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div className="mx-3 my-3 rounded-lg border border-[rgba(255,107,122,0.45)] bg-[rgba(255,107,122,0.12)] px-3 py-2 text-xs text-[#ffe1e6]">
      {error}
    </div>
  );
}

function KindBadge({ kind }) {
  const isBought = kind === "bought";
  const className = isBought
    ? "border-[#49d6ae66] bg-[#49d6ae1f] text-[#bafbe5]"
    : "border-[#8ab0ff66] bg-[#8ab0ff20] text-[#dbe8ff]";

  return (
    <span className={`inline-flex min-w-9 justify-center rounded-full border px-2 py-1 text-[11px] font-black ${className}`}>
      {isBought ? "买入" : "卖出"}
    </span>
  );
}

function NotificationItem({ item, onSelect }) {
  const unreadClass = item.read
    ? "border-white/10 bg-white/[0.035]"
    : "border-[var(--line-strong)] bg-[rgba(0,213,200,0.08)]";

  return (
    <Link
      href={item.nftId ? `/nfts/${item.nftId}` : "/profile"}
      onClick={() => onSelect(item.id)}
      className={`block rounded-lg border px-3 py-3 transition hover:-translate-y-0.5 hover:border-white/30 ${unreadClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <KindBadge kind={item.kind} />
          <p className="truncate text-sm font-bold text-white">{item.title}</p>
        </div>
        <span className="shrink-0 text-[11px] text-[#8fa0bb]">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>
      <p className="mt-2 truncate text-xs text-[#d7e2ff]">{item.nftName}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#9fb0ca]">
        <span className="truncate">{item.subtitle}</span>
        <span className="shrink-0 font-bold text-white">{formatPriceEth(item.price)} ETH</span>
      </div>
    </Link>
  );
}

export default function NotificationList({ activeTab, error, onSelect, visibleItems, wallet }) {
  if (!wallet) return <EmptyState activeTab={activeTab} wallet={wallet} />;
  if (error) return <ErrorState error={error} />;
  if (visibleItems.length === 0) {
    return <EmptyState activeTab={activeTab} wallet={wallet} />;
  }

  return (
    <div className="space-y-2 px-3 py-3">
      {visibleItems.map((item) => (
        <NotificationItem key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
