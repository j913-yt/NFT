"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMyBoughtOrders, getMySoldOrders } from "@/lib/api";

const POLL_INTERVAL_MS = 20000;
const MAX_NOTIFICATIONS = 60;
const NOTIFY_PREFIX = "market_notifications_v2";
const CURSOR_PREFIX = "market_notification_cursor_v2";

function readJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage write errors
  }
}

function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("jwt_token") || "";
}

function getCurrentWallet() {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem("current_user");
  if (!raw) return "";
  try {
    const user = JSON.parse(raw);
    return String(user?.wallet || "").toLowerCase();
  } catch {
    return "";
  }
}

function buildStorageKey(prefix, wallet) {
  return `${prefix}:${wallet || "guest"}`;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function maxOrderId(list) {
  return (list || []).reduce((max, item) => {
    const id = asNumber(item?.id);
    return id > max ? id : max;
  }, 0);
}

function defaultCursor() {
  return {
    initialized: false,
    boughtMaxId: 0,
    soldMaxId: 0,
  };
}

function formatPriceEth(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (num < 0.00000001) return "< 0.00000001";
  return num.toFixed(8).replace(/\.?0+$/, "");
}

function formatRelativeTime(value) {
  if (!value) return "-";
  const t = new Date(value).getTime();
  if (!Number.isFinite(t) || t <= 0) return "-";
  const diffMs = Date.now() - t;
  if (diffMs < 60 * 1000) return "刚刚";
  if (diffMs < 60 * 60 * 1000)
    return `${Math.floor(diffMs / (60 * 1000))} 分钟前`;
  if (diffMs < 24 * 60 * 60 * 1000)
    return `${Math.floor(diffMs / (60 * 60 * 1000))} 小时前`;
  return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))} 天前`;
}

function makeNotification(kind, order) {
  const id = asNumber(order?.id);
  const nftId = asNumber(order?.nftId);
  const nftName = order?.nftName || `NFT #${nftId || "-"}`;
  const title = kind === "bought" ? "买入成功" : "售出提醒";

  return {
    id: `${kind}-${id}`,
    kind,
    orderId: id,
    nftId,
    nftName,
    price: asNumber(order?.price),
    createdAt: order?.createdAt || new Date().toISOString(),
    title,
    subtitle:
      kind === "bought"
        ? "你的账户新增一笔买入订单"
        : "你发布的作品完成了一笔交易",
    read: false,
  };
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState("");

  const panelRef = useRef(null);
  const itemsRef = useRef([]);
  const cursorRef = useRef(defaultCursor());
  const walletRef = useRef("");
  const fetchingRef = useRef(false);

  const unreadCount = useMemo(
    () => items.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
    [items],
  );

  const unreadBought = useMemo(
    () => items.filter((item) => !item.read && item.kind === "bought").length,
    [items],
  );

  const unreadSold = useMemo(
    () => items.filter((item) => !item.read && item.kind === "sold").length,
    [items],
  );

  const visibleItems = useMemo(() => {
    if (activeTab === "unread") {
      return items.filter((item) => !item.read);
    }
    return items;
  }, [activeTab, items]);

  const setItemsSync = useCallback((nextItems) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const persistState = useCallback((targetWallet, nextItems, nextCursor) => {
    if (!targetWallet) return;
    writeJSON(buildStorageKey(NOTIFY_PREFIX, targetWallet), nextItems);
    writeJSON(buildStorageKey(CURSOR_PREFIX, targetWallet), nextCursor);
  }, []);

  const loadStateForWallet = useCallback(
    (targetWallet) => {
      const savedItems = readJSON(
        buildStorageKey(NOTIFY_PREFIX, targetWallet),
        [],
      );
      const savedCursor = readJSON(
        buildStorageKey(CURSOR_PREFIX, targetWallet),
        defaultCursor(),
      );

      const safeItems = Array.isArray(savedItems) ? savedItems : [];
      const safeCursor = {
        initialized: Boolean(savedCursor?.initialized),
        boughtMaxId: asNumber(savedCursor?.boughtMaxId),
        soldMaxId: asNumber(savedCursor?.soldMaxId),
      };

      cursorRef.current = safeCursor;
      setItemsSync(safeItems);
    },
    [setItemsSync],
  );

  const switchWalletIfNeeded = useCallback(
    (nextWallet) => {
      if (walletRef.current === nextWallet) return;
      walletRef.current = nextWallet;
      setWallet(nextWallet);
      setError("");

      if (!nextWallet) {
        cursorRef.current = defaultCursor();
        setItemsSync([]);
        return;
      }

      loadStateForWallet(nextWallet);
    },
    [loadStateForWallet, setItemsSync],
  );

  const pollNotifications = useCallback(
    async (silent = true) => {
      const token = getToken();
      const currentWallet = getCurrentWallet();
      if (!token || !currentWallet) {
        switchWalletIfNeeded("");
        return;
      }

      switchWalletIfNeeded(currentWallet);

      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (!silent) setRefreshing(true);

      try {
        setError("");
        const [bought, sold] = await Promise.all([
          getMyBoughtOrders(),
          getMySoldOrders(),
        ]);

        const boughtList = Array.isArray(bought) ? bought : [];
        const soldList = Array.isArray(sold) ? sold : [];
        const boughtMax = maxOrderId(boughtList);
        const soldMax = maxOrderId(soldList);
        const prev = cursorRef.current || defaultCursor();

        if (!prev.initialized) {
          const bootCursor = {
            initialized: true,
            boughtMaxId: boughtMax,
            soldMaxId: soldMax,
          };
          cursorRef.current = bootCursor;
          persistState(currentWallet, itemsRef.current, bootCursor);
          setLastSyncAt(new Date().toISOString());
          return;
        }

        const newBought = boughtList
          .filter((item) => asNumber(item?.id) > prev.boughtMaxId)
          .map((item) => makeNotification("bought", item));

        const newSold = soldList
          .filter((item) => asNumber(item?.id) > prev.soldMaxId)
          .map((item) => makeNotification("sold", item));

        const incoming = [...newBought, ...newSold].sort((a, b) => {
          const bt = new Date(b.createdAt).getTime();
          const at = new Date(a.createdAt).getTime();
          return (
            (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0)
          );
        });

        let nextItems = itemsRef.current;
        if (incoming.length > 0) {
          const seen = new Set();
          nextItems = [...incoming, ...itemsRef.current].filter((item) => {
            if (!item?.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          nextItems = nextItems.slice(0, MAX_NOTIFICATIONS);
          setItemsSync(nextItems);
        }

        const nextCursor = {
          initialized: true,
          boughtMaxId: Math.max(prev.boughtMaxId, boughtMax),
          soldMaxId: Math.max(prev.soldMaxId, soldMax),
        };
        cursorRef.current = nextCursor;
        persistState(currentWallet, nextItems, nextCursor);
        setLastSyncAt(new Date().toISOString());
      } catch (err) {
        const msg = err?.message || "加载通知失败";
        if (
          msg.includes("401") ||
          msg.includes("403") ||
          msg.includes("未登录") ||
          msg.toLowerCase().includes("unauthorized")
        ) {
          switchWalletIfNeeded("");
          return;
        }
        setError(msg);
      } finally {
        if (!silent) setRefreshing(false);
        fetchingRef.current = false;
      }
    },
    [persistState, setItemsSync, switchWalletIfNeeded],
  );

  const markAllRead = useCallback(() => {
    if (!walletRef.current) return;
    const nextItems = itemsRef.current.map((item) =>
      item.read ? item : { ...item, read: true },
    );
    setItemsSync(nextItems);
    persistState(walletRef.current, nextItems, cursorRef.current);
  }, [persistState, setItemsSync]);

  const clearRead = useCallback(() => {
    if (!walletRef.current) return;
    const nextItems = itemsRef.current.filter((item) => !item.read);
    setItemsSync(nextItems);
    persistState(walletRef.current, nextItems, cursorRef.current);
  }, [persistState, setItemsSync]);

  const markOneRead = useCallback(
    (targetId) => {
      if (!walletRef.current) return;
      const nextItems = itemsRef.current.map((item) =>
        item.id === targetId && !item.read ? { ...item, read: true } : item,
      );
      setItemsSync(nextItems);
      persistState(walletRef.current, nextItems, cursorRef.current);
    },
    [persistState, setItemsSync],
  );

  useEffect(() => {
    pollNotifications(true);
    const timer = setInterval(() => pollNotifications(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (!panelRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#86a4e746] bg-gradient-to-br from-[#162645] to-[#131f35] text-[#dce7ff] shadow-[0_10px_24px_rgba(6,12,22,0.4)] transition hover:border-[#8fb7ff77] hover:shadow-[0_10px_28px_rgba(63,123,255,0.3)]"
        title={wallet ? "通知中心" : "登录后查看通知"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          className="h-4 w-4 transition group-hover:scale-105"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.5 18H9.5m8-6.5V9a5.5 5.5 0 10-11 0v2.5L5 14v1h14v-1l-1.5-2.5zM10 18a2 2 0 004 0"
          />
        </svg>

        {unreadCount > 0 && (
          <>
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff658f] shadow-[0_0_0_4px_rgba(255,101,143,0.24)]" />
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff5f87] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[70] w-[360px] overflow-hidden rounded-3xl border border-[#8aacff2d] bg-[#0d172abf] shadow-[0_24px_44px_rgba(2,7,16,0.7)] backdrop-blur-2xl">
          <div className="relative border-b border-white/10 px-4 pb-3 pt-3.5">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#4e82ff33] blur-2xl" />
            <div className="absolute -bottom-12 -left-10 h-24 w-24 rounded-full bg-[#20c4b52b] blur-2xl" />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9eb8eb]">
                  Notification Center
                </p>
                <h3 className="mt-1 text-base font-black text-white">
                  实时订单提醒
                </h3>
                <p className="mt-1 text-[11px] text-[#91a8d5]">
                  {wallet
                    ? `每 ${Math.floor(POLL_INTERVAL_MS / 1000)} 秒自动刷新`
                    : "请先连接钱包并登录"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => pollNotifications(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-[#dce7ff] transition hover:bg-white/10"
              >
                {refreshing ? "刷新中..." : "刷新"}
              </button>
            </div>

            {wallet && (
              <div className="relative z-10 mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <p className="text-[10px] text-[#8ea4d0]">未读</p>
                  <p className="mt-1 text-sm font-black text-white">
                    {unreadCount}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <p className="text-[10px] text-[#8ea4d0]">买入</p>
                  <p className="mt-1 text-sm font-black text-[#7ce2be]">
                    {unreadBought}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <p className="text-[10px] text-[#8ea4d0]">卖出</p>
                  <p className="mt-1 text-sm font-black text-[#9ec1ff]">
                    {unreadSold}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-b border-white/10 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
                    activeTab === "all"
                      ? "bg-[#4b86ff44] text-white"
                      : "text-[#b9c8ea] hover:text-white"
                  }`}
                >
                  全部 ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("unread")}
                  className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
                    activeTab === "unread"
                      ? "bg-[#4b86ff44] text-white"
                      : "text-[#b9c8ea] hover:text-white"
                  }`}
                >
                  未读 ({unreadCount})
                </button>
              </div>

              {wallet && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-[#d6e2ff] transition hover:bg-white/10"
                  >
                    全读
                  </button>
                  <button
                    type="button"
                    onClick={clearRead}
                    className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-[#d6e2ff] transition hover:bg-white/10"
                  >
                    清理已读
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="max-h-[390px] overflow-y-auto px-3 py-2">
            {!wallet && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-white">
                  通知中心未激活
                </p>
                <p className="mt-2 text-xs text-[#9eb4de]">
                  完成钱包登录后会自动开始订单轮询
                </p>
              </div>
            )}

            {wallet && error && (
              <div className="rounded-xl border border-[#ff8397aa] bg-[#ff839726] px-3 py-2 text-xs text-[#ffdce2]">
                {error}
              </div>
            )}

            {wallet && !error && visibleItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-white">暂无通知</p>
                <p className="mt-2 text-xs text-[#9eb4de]">
                  {activeTab === "unread"
                    ? "当前没有未读消息"
                    : "有新成交时会在这里显示"}
                </p>
              </div>
            )}

            {wallet &&
              !error &&
              visibleItems.map((item) => {
                const typeClass =
                  item.kind === "bought"
                    ? "border-[#38d6a066] bg-[linear-gradient(120deg,rgba(56,214,160,0.18),rgba(13,31,39,0.8))]"
                    : "border-[#6ea2ff66] bg-[linear-gradient(120deg,rgba(78,130,255,0.18),rgba(17,26,45,0.8))]";

                return (
                  <Link
                    key={item.id}
                    href={item.nftId ? `/nfts/${item.nftId}` : "/profile"}
                    onClick={() => {
                      markOneRead(item.id);
                      setOpen(false);
                    }}
                    className={`mb-2 block rounded-2xl border px-3 py-3 transition hover:translate-y-[-1px] hover:border-white/35 ${
                      item.read ? "border-white/10 bg-white/[0.04]" : typeClass
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black ${
                            item.kind === "bought"
                              ? "border-[#4adeb3aa] bg-[#4adeb333] text-[#d8ffef]"
                              : "border-[#8ab0ffb0] bg-[#8ab0ff33] text-[#ecf3ff]"
                          }`}
                        >
                          {item.kind === "bought" ? "买" : "卖"}
                        </span>
                        <p className="text-sm font-bold text-white">
                          {item.title}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#9db1da]">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-[#d7e2ff]">
                      {item.nftName}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#b3c4ea]">
                      <span>{item.subtitle}</span>
                      <span className="font-semibold text-white">
                        {formatPriceEth(item.price)} ETH
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>

          <div className="border-t border-white/10 px-3 py-2 text-[11px] text-[#90a7d3]">
            {wallet
              ? `最近同步：${lastSyncAt ? formatRelativeTime(lastSyncAt) : "刚启动"}`
              : "未登录状态"}
          </div>
        </div>
      )}
    </div>
  );
}
