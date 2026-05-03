export const POLL_INTERVAL_MS = 20_000;
export const MAX_NOTIFICATIONS = 60;

const NOTIFY_PREFIX = "market_notifications_v2";
const CURSOR_PREFIX = "market_notification_cursor_v2";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function buildStorageKey(prefix, wallet) {
  return `${prefix}:${wallet || "guest"}`;
}

export function buildNotificationKey(wallet) {
  return buildStorageKey(NOTIFY_PREFIX, wallet);
}

export function buildCursorKey(wallet) {
  return buildStorageKey(CURSOR_PREFIX, wallet);
}

export function createDefaultCursor() {
  return {
    initialized: false,
    boughtMaxId: 0,
    soldMaxId: 0,
  };
}

export function createSafeCursor(savedCursor) {
  return {
    initialized: Boolean(savedCursor?.initialized),
    boughtMaxId: asNumber(savedCursor?.boughtMaxId),
    soldMaxId: asNumber(savedCursor?.soldMaxId),
  };
}

export function readJSON(key, fallback) {
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

export function writeJSON(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("jwt_token") || "";
}

export function getCurrentWallet() {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem("current_user");
  if (!raw) return "";
  const user = JSON.parse(raw);
  return String(user?.wallet || "").toLowerCase();
}

export function maxOrderId(list) {
  return (list || []).reduce((max, item) => Math.max(max, asNumber(item?.id)), 0);
}

export function formatPriceEth(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (num < 0.00000001) return "< 0.00000001";
  return num.toFixed(8).replace(/\.?0+$/, "");
}

export function formatRelativeTime(value) {
  if (!value) return "-";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  const diffMs = Date.now() - timestamp;
  if (diffMs < MINUTE_MS) return "刚刚";
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)} 分钟前`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)} 小时前`;
  return `${Math.floor(diffMs / DAY_MS)} 天前`;
}

export function makeNotification(kind, order) {
  const id = asNumber(order?.id);
  const nftId = asNumber(order?.nftId);
  const nftName = order?.nftName || `NFT #${nftId || "-"}`;

  return {
    id: `${kind}-${id}`,
    kind,
    orderId: id,
    nftId,
    nftName,
    price: asNumber(order?.price),
    createdAt: order?.createdAt || new Date().toISOString(),
    title: kind === "bought" ? "买入成功" : "售出提醒",
    subtitle: kind === "bought" ? "账户新增一笔买入订单" : "作品完成一笔成交",
    read: false,
  };
}

export function isAuthErrorMessage(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("未登录") ||
    normalized.includes("unauthorized")
  );
}
