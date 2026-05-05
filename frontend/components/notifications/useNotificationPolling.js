"use client";

import { useCallback, useEffect, useState } from "react";
import {
  POLL_INTERVAL_MS,
  getCurrentWallet,
  getToken,
  isAuthErrorMessage,
} from "./notification-utils";
import { fetchOrderSnapshot } from "./notification-state";
import { WALLET_SESSION_CHANGED_EVENT } from "@/lib/wallet/session";

function isPollingEnabled() {
  return Boolean(getToken() && getCurrentWallet());
}

export default function useNotificationPolling({
  applySnapshot,
  fetchingRef,
  setError,
  setRefreshing,
  switchWalletIfNeeded,
}) {
  const [pollingEnabled, setPollingEnabled] = useState(() => isPollingEnabled());

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
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncPollingState = () => {
      setPollingEnabled(isPollingEnabled());
    };

    syncPollingState();
    window.addEventListener("storage", syncPollingState);
    window.addEventListener(WALLET_SESSION_CHANGED_EVENT, syncPollingState);

    return () => {
      window.removeEventListener("storage", syncPollingState);
      window.removeEventListener(WALLET_SESSION_CHANGED_EVENT, syncPollingState);
    };
  }, []);

  useEffect(() => {
    if (!pollingEnabled) {
      switchWalletIfNeeded("");
      return undefined;
    }

    pollNotifications(true);
    const timer = setInterval(() => pollNotifications(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollNotifications, pollingEnabled, switchWalletIfNeeded]);

  return pollNotifications;
}
