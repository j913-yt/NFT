"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMyBoughtOrders, getMySoldOrders } from "@/lib/api";

const POLL_INTERVAL_MS = 20000;
const MAX_NOTIFICATIONS = 40;
const NOTIFY_PREFIX = "market_notifications_v1";
const CURSOR_PREFIX = "market_notification_cursor_v1";

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
    // ignore localStorage quota or serialization errors
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

function defaultCursor() {
  return {
    initialized: false,
    boughtMaxId: 0,
    soldMaxId: 0
  };
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

function formatPriceEth(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (num < 0.00000001) return "< 0.00000001";
  return num.toFixed(8).replace(/\.?0+$/, "");
}

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function makeNotification(kind, order) {
  const id = asNumber(order?.id);
  const nftId = asNumber(order?.nftId);
  const nftName = order?.nftName || `NFT #${nftId || "-"}`;
  const sideText = kind === "bought" ? "买入成功" : "售出提醒";

  return {
    id: `${kind}-${id}`,
    kind,
    orderId: id,
    nftId,
    nftName,
    price: asNumber(order?.price),
    createdAt: order?.createdAt || new Date().toISOString(),
    title: sideText,
    read: false
  };
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  const panelRef = useRef(null);
  const itemsRef = useRef([]);
  const cursorRef = useRef(defaultCursor());
  const walletRef = useRef("");
  const fetchingRef = useRef(false);

  const unreadCount = useMemo(
    () => items.reduce((sum, item) => sum + (item.read ? 0 : 1), 0),
    [items]
  );

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
        []
      );
      const savedCursor = readJSON(
        buildStorageKey(CURSOR_PREFIX, targetWallet),
        defaultCursor()
      );

      const safeItems = Array.isArray(savedItems) ? savedItems : [];
      const safeCursor = {
        initialized: Boolean(savedCursor?.initialized),
        boughtMaxId: asNumber(savedCursor?.boughtMaxId),
        soldMaxId: asNumber(savedCursor?.soldMaxId)
      };

      cursorRef.current = safeCursor;
      setItemsSync(safeItems);
    },
    [setItemsSync]
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
    [loadStateForWallet, setItemsSync]
  );

  const pollNotifications = useCallback(async () => {
    const token = getToken();
    const currentWallet = getCurrentWallet();
    if (!token || !currentWallet) {
      switchWalletIfNeeded("");
      return;
    }

    switchWalletIfNeeded(currentWallet);

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setError("");
      const [bought, sold] = await Promise.all([
        getMyBoughtOrders(),
        getMySoldOrders()
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
          soldMaxId: soldMax
        };
        cursorRef.current = bootCursor;
        persistState(currentWallet, itemsRef.current, bootCursor);
        return;
      }

      const newBought = boughtList
        .filter((item) => asNumber(item?.id) > prev.boughtMaxId)
        .map((item) => makeNotification("bought", item));

      const newSold = soldList
        .filter((item) => asNumber(item?.id) > prev.soldMaxId)
        .map((item) => makeNotification("sold", item));

      const incoming = [...newBought, ...newSold]
        .sort((a, b) => {
          const bt = new Date(b.createdAt).getTime();
          const at = new Date(a.createdAt).getTime();
          return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
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
        soldMaxId: Math.max(prev.soldMaxId, soldMax)
      };
      cursorRef.current = nextCursor;
      persistState(currentWallet, nextItems, nextCursor);
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
      fetchingRef.current = false;
    }
  }, [persistState, setItemsSync, switchWalletIfNeeded]);

  const markAllRead = useCallback(() => {
    if (!walletRef.current) return;
    const nextItems = itemsRef.current.map((item) =>
      item.read ? item : { ...item, read: true }
    );
    setItemsSync(nextItems);
    persistState(walletRef.current, nextItems, cursorRef.current);
  }, [persistState, setItemsSync]);

  useEffect(() => {
    pollNotifications();
    const timer = setInterval(pollNotifications, POLL_INTERVAL_MS);
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

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        markAllRead();
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-[#dce7ff] transition hover:bg-white/10"
        title={wallet ? "通知中心" : "登录后查看通知"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.5 18H9.5m8-6.5V9a5.5 5.5 0 10-11 0v2.5L5 14v1h14v-1l-1.5-2.5zM10 18a2 2 0 004 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff5f87] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[70] w-[320px] overflow-hidden rounded-2xl border border-white/15 bg-[#10192bcc] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#b6c9f3]">
                Notifications
              </p>
              <p className="text-[11px] text-[#8ea3cd]">
                {wallet ? "订单轮询提醒（20s）" : "请先连接钱包登录"}
              </p>
            </div>
            <button
              type="button"
              onClick={pollNotifications}
              className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-[#dbe6ff] transition hover:bg-white/10"
            >
              刷新
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto px-2 py-2">
            {!wallet && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-5 text-center text-xs text-[#9ab0dc]">
                登录后可接收买入/卖出通知
              </div>
            )}

            {wallet && error && (
              <div className="mb-2 rounded-lg border border-[#ff8397aa] bg-[#ff839726] px-2.5 py-2 text-[11px] text-[#ffdce2]">
                {error}
              </div>
            )}

            {wallet && !error && items.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-6 text-center text-xs text-[#9ab0dc]">
                暂无通知
              </div>
            )}

            {wallet &&
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.nftId ? `/nfts/${item.nftId}` : "/profile"}
                  onClick={() => setOpen(false)}
                  className={`mb-2 block rounded-xl border px-3 py-2.5 transition ${
                    item.read
                      ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
                      : "border-[#6ea2ff77] bg-[#6ea2ff1e] hover:bg-[#6ea2ff2a]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-white">{item.title}</p>
                    <span className="text-[10px] text-[#9db1da]">
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[#c9d8f8]">
                    {item.nftName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#9db1da]">
                    价格 {formatPriceEth(item.price)} ETH
                  </p>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
