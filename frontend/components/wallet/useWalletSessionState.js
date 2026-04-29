"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setPreferredWalletId } from "@/lib/web3";
import {
  clearWalletSession,
  EMPTY_WALLET_SESSION,
  readWalletSession,
} from "@/lib/wallet/session";

const COPY_NOTICE_MS = 1_500;

async function writeClipboard(account) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error("当前浏览器不支持剪贴板 API");
  }
  await navigator.clipboard.writeText(account);
}

export default function useWalletSessionState({ router }) {
  const [session, setSession] = useState(EMPTY_WALLET_SESSION);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  useEffect(() => setSession(readWalletSession()), []);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const clearLocalLogin = useCallback((navigate = true) => {
    clearWalletSession();
    setPreferredWalletId("");
    setSession(EMPTY_WALLET_SESSION);
    setShowAccountMenu(false);
    setCopied(false);
    if (navigate) router.push("/");
  }, [router]);

  const copyAccount = useCallback(async () => {
    await writeClipboard(session.account);
    setCopied(true);
    clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), COPY_NOTICE_MS);
  }, [session.account]);

  const openProfile = useCallback(() => {
    setShowAccountMenu(false);
    router.push("/profile");
  }, [router]);

  return {
    clearLocalLogin,
    copied,
    copyAccount,
    openProfile,
    session,
    setSession,
    setShowAccountMenu,
    showAccountMenu,
  };
}
