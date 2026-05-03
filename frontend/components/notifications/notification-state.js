import { getMyBoughtOrders, getMySoldOrders } from "@/lib/api";
import {
  MAX_NOTIFICATIONS,
  asNumber,
  makeNotification,
  maxOrderId,
} from "./notification-utils";

export function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function createOrderSnapshot({ bought, sold }) {
  const boughtList = normalizeList(bought);
  const soldList = normalizeList(sold);

  return {
    boughtList,
    soldList,
    boughtMaxId: maxOrderId(boughtList),
    soldMaxId: maxOrderId(soldList),
  };
}

export function createNextCursor({ cursor, boughtMaxId, soldMaxId }) {
  return {
    initialized: true,
    boughtMaxId: Math.max(cursor.boughtMaxId, boughtMaxId),
    soldMaxId: Math.max(cursor.soldMaxId, soldMaxId),
  };
}

export function createIncomingNotifications({ boughtList, soldList, cursor }) {
  const bought = boughtList
    .filter((item) => asNumber(item?.id) > cursor.boughtMaxId)
    .map((item) => makeNotification("bought", item));
  const sold = soldList
    .filter((item) => asNumber(item?.id) > cursor.soldMaxId)
    .map((item) => makeNotification("sold", item));

  return sortNotifications([...bought, ...sold]);
}

export function createCounts(items) {
  const unreadItems = items.filter((item) => !item.read);
  return {
    unreadCount: unreadItems.length,
    unreadBought: unreadItems.filter((item) => item.kind === "bought").length,
    unreadSold: unreadItems.filter((item) => item.kind === "sold").length,
  };
}

export function mergeNotifications({ currentItems, incoming }) {
  const seen = new Set();
  return [...incoming, ...currentItems]
    .filter((item) => keepUniqueNotification({ item, seen }))
    .slice(0, MAX_NOTIFICATIONS);
}

export async function fetchOrderSnapshot() {
  const [bought, sold] = await Promise.all([getMyBoughtOrders(), getMySoldOrders()]);
  return createOrderSnapshot({ bought, sold });
}

function keepUniqueNotification({ item, seen }) {
  if (!item?.id || seen.has(item.id)) return false;
  seen.add(item.id);
  return true;
}

function sortNotifications(items) {
  return items.sort((a, b) => {
    const first = new Date(a.createdAt).getTime();
    const second = new Date(b.createdAt).getTime();
    return (Number.isFinite(second) ? second : 0) - (Number.isFinite(first) ? first : 0);
  });
}
