"use client";

import { useMemo, useState } from "react";
import { createCounts } from "./notification-state";
import useNotificationPolling from "./useNotificationPolling";
import useNotificationStore from "./useNotificationStore";

function useVisibleItems({ activeTab, items }) {
  return useMemo(
    () => (activeTab === "unread" ? items.filter((item) => !item.read) : items),
    [activeTab, items],
  );
}

export default function useNotificationCenter() {
  const [activeTab, setActiveTab] = useState("all");
  const store = useNotificationStore();
  const counts = useMemo(() => createCounts(store.items), [store.items]);
  const visibleItems = useVisibleItems({ activeTab, items: store.items });
  const pollNotifications = useNotificationPolling({
    applySnapshot: store.applySnapshot,
    fetchingRef: store.fetchingRef,
    setError: store.setError,
    setRefreshing: store.setRefreshing,
    switchWalletIfNeeded: store.switchWalletIfNeeded,
  });

  return {
    activeTab,
    clearRead: store.clearRead,
    counts,
    error: store.error,
    items: store.items,
    lastSyncAt: store.lastSyncAt,
    markAllRead: store.markAllRead,
    markOneRead: store.markOneRead,
    pollNotifications,
    refreshing: store.refreshing,
    setActiveTab,
    visibleItems,
    wallet: store.wallet,
  };
}
