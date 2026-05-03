"use client";

import { useCallback, useEffect } from "react";
import {
  POLL_INTERVAL_MS,
  getCurrentWallet,
  getToken,
  isAuthErrorMessage,
} from "./notification-utils";
import { fetchOrderSnapshot } from "./notification-state";

export default function useNotificationPolling({
  applySnapshot,
  fetchingRef,
  setError,
  setRefreshing,
  switchWalletIfNeeded,
}) {
  const pollNotifications = useCallback(async (silent = true) => {
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
      const snapshot = await fetchOrderSnapshot();
      applySnapshot({ currentWallet, snapshot });
    } catch (err) {
      const message = err?.message || "加载通知失败";
      if (isAuthErrorMessage(message)) {
        switchWalletIfNeeded("");
        return;
      }
      setError(message);
    } finally {
      if (!silent) setRefreshing(false);
      fetchingRef.current = false;
    }
  }, [applySnapshot, fetchingRef, setError, setRefreshing, switchWalletIfNeeded]);

  useEffect(() => {
    pollNotifications(true);
    const timer = setInterval(() => pollNotifications(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollNotifications]);

  return pollNotifications;
}
