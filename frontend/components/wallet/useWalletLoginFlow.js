"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setPreferredWalletId } from "@/lib/web3";
import {
  getWalletActionError,
  isWalletLoginCancelled,
  loginWithWallet,
} from "@/lib/wallet/login";

async function requestWalletLogin({
  address,
  connectorId,
  router,
  setSession,
  setShowAccountMenu,
  setStage,
  shouldContinue,
  signMessageAsync,
}) {
  const data = await loginWithWallet({
    address,
    shouldContinue,
    signMessageAsync,
    setStage,
  });
  setPreferredWalletId(connectorId || "");
  setSession({ account: data.user?.wallet || address, loggedIn: true });
  setShowAccountMenu(false);
  router.push("/profile");
}

export default function useWalletLoginFlow({
  address,
  connectorId,
  isConnected,
  openConnectModal,
  router,
  session,
  setSession,
  setShowAccountMenu,
  signMessageAsync,
}) {
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const pendingLoginRef = useRef(false);
  const loginRunRef = useRef(0);

  const loginConnectedWallet = useCallback(async (walletAddress) => {
    const runId = loginRunRef.current + 1;
    loginRunRef.current = runId;
    try {
      setLoading(true);
      await requestWalletLogin({
        address: walletAddress,
        connectorId,
        router,
        setSession,
        setShowAccountMenu,
        setStage,
        shouldContinue: () => loginRunRef.current === runId,
        signMessageAsync,
      });
    } catch (error) {
      if (!isWalletLoginCancelled(error)) {
        alert(getWalletActionError(error, "钱包登录失败"));
      }
    } finally {
      setLoading(false);
      setStage("");
      pendingLoginRef.current = false;
    }
  }, [connectorId, router, setSession, setShowAccountMenu, signMessageAsync]);

  usePendingLoginEffect({
    address,
    isConnected,
    loginConnectedWallet,
    pendingLoginRef,
    session,
  });

  const handlePrimaryClick = usePrimaryWalletClick({
    address,
    isConnected,
    loading,
    loginConnectedWallet,
    openConnectModal,
    pendingLoginRef,
    session,
    setShowAccountMenu,
  });

  const cancelLogin = useCallback(() => {
    loginRunRef.current += 1;
    pendingLoginRef.current = false;
    setLoading(false);
    setStage("");
  }, []);

  return {
    cancelLogin,
    handlePrimaryClick,
    loading,
    stage,
  };
}

function usePendingLoginEffect({
  address,
  isConnected,
  loginConnectedWallet,
  pendingLoginRef,
  session,
}) {
  useEffect(() => {
    if (!pendingLoginRef.current || !isConnected || !address || session.loggedIn) {
      return;
    }
    void loginConnectedWallet(address);
  }, [address, isConnected, loginConnectedWallet, pendingLoginRef, session.loggedIn]);
}

function usePrimaryWalletClick({
  address,
  isConnected,
  loading,
  loginConnectedWallet,
  openConnectModal,
  pendingLoginRef,
  session,
  setShowAccountMenu,
}) {
  return useCallback(async () => {
    if (loading) return;
    if (session.loggedIn) {
      setShowAccountMenu((visible) => !visible);
      return;
    }
    if (isConnected && address) {
      await loginConnectedWallet(address);
      return;
    }
    if (!openConnectModal) {
      alert("钱包连接弹窗不可用，请刷新页面后重试");
      return;
    }
    pendingLoginRef.current = true;
    openConnectModal();
  }, [
    address,
    isConnected,
    loading,
    loginConnectedWallet,
    openConnectModal,
    pendingLoginRef,
    session.loggedIn,
    setShowAccountMenu,
  ]);
}
