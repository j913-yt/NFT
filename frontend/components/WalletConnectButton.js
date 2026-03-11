"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getWalletNonce, walletLogin } from "@/lib/api";
import { detectInjectedWallets, getProviderAndSigner } from "@/lib/web3";

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function WalletConnectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [walletOptions, setWalletOptions] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [stage, setStage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const opIdRef = useRef(0);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = window.localStorage.getItem("jwt_token");
    const userRaw = window.localStorage.getItem("current_user");
    if (token && userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u?.wallet) setAccount(u.wallet);
      } catch {
        // ignore invalid cache
      }
      setLoggedIn(true);
    }

    const detected = detectInjectedWallets();
    setWalletOptions(detected);
    if (detected.length > 0) {
      setSelectedWalletId((prev) => prev || detected[0].id);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    if (!eth?.on) return;

    const onAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        handleLogout(true);
        return;
      }
      const next = accounts[0];
      setAccount(next);

      if (loggedIn) {
        const raw = window.localStorage.getItem("current_user");
        try {
          const u = raw ? JSON.parse(raw) : null;
          if (u?.wallet && u.wallet.toLowerCase() !== next.toLowerCase()) {
            handleLogout(false);
          }
        } catch {
          // ignore parse failures
        }
      }
    };

    const onDisconnect = () => handleLogout(true);

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("disconnect", onDisconnect);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const handleLogout = (navigate = true) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("jwt_token");
      window.localStorage.removeItem("current_user");
    }
    setLoggedIn(false);
    setAccount("");
    setLoading(false);
    setStage(null);
    setShowModal(false);
    setShowAccountMenu(false);
    setCopied(false);
    if (navigate) router.push("/");
  };

  const handleCopyAddress = async () => {
    if (!account || typeof window === "undefined") return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(account);
      } else {
        const input = document.createElement("textarea");
        input.value = account;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.focus();
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("复制失败，请手动复制地址");
    }
  };

  const handleClick = async () => {
    if (loading) return;

    if (loggedIn) {
      setShowAccountMenu((prev) => !prev);
      return;
    }

    if (!walletOptions.length) {
      alert("未检测到钱包插件，请先安装 MetaMask / OKX / Bitget");
      return;
    }

    const walletId = selectedWalletId || walletOptions[0]?.id;
    if (!walletId) {
      alert("请先选择钱包后重试");
      return;
    }

    let loginSucceeded = false;

    try {
      setLoading(true);
      setShowModal(true);
      setStage("connect");
      opIdRef.current += 1;
      const opId = opIdRef.current;

      const { account: addr, signer } = await withTimeout(
        getProviderAndSigner(walletId),
        15000,
        "连接钱包超时，请重试"
      );
      if (opId !== opIdRef.current) return;
      setAccount(addr);

      setStage("nonce");
      const { nonce } = await withTimeout(
        getWalletNonce(addr),
        10000,
        "获取 nonce 超时，请确认后端已启动"
      );
      if (opId !== opIdRef.current) return;

      const message = `NovaNFT Login\nnonce: ${nonce}`;
      setStage("sign");
      let signature;
      try {
        signature = await withTimeout(
          signer.provider.send("personal_sign", [message, addr]),
          60000,
          "签名超时，请在钱包弹窗中确认"
        );
      } catch {
        signature = await withTimeout(
          signer.provider.send("personal_sign", [addr, message]),
          60000,
          "签名超时，请在钱包弹窗中确认"
        );
      }
      if (opId !== opIdRef.current) return;

      setStage("login");
      await withTimeout(walletLogin(addr, signature), 10000, "登录超时，请重试");

      if (opId !== opIdRef.current) return;
      setLoggedIn(true);
      setShowModal(false);
      setStage(null);
      setShowAccountMenu(false);
      loginSucceeded = true;
      router.push("/profile");
    } catch (err) {
      const msg = err?.message || "钱包登录失败";
      if (err?.code === 4001 || msg.toLowerCase().includes("rejected")) {
        alert("已取消钱包操作");
      } else {
        alert(msg);
      }
    } finally {
      setLoading(false);
      if (!loginSucceeded) {
        setShowModal(false);
        setStage(null);
      }
    }
  };

  const shortAddr = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "";
  const connectedWalletLabel =
    walletOptions.find((w) => w.id === selectedWalletId)?.name || "已连接钱包";
  const avatarLabel = "钱包地址";

  return (
    <>
      <div className="flex items-center gap-2">
        {walletOptions.length > 1 && (
          <select
            className="rounded-lg border border-white/20 bg-[#131b2a] px-2 py-1 text-[11px] text-[#d8e0ff] outline-none"
            value={selectedWalletId}
            onChange={(e) => setSelectedWalletId(e.target.value)}
          >
            <option value="">选择钱包</option>
            {walletOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition ${
            loggedIn ? "bg-[#2c4fa7] hover:bg-[#375fbf]" : "bg-[#4b86ff] hover:bg-[#5a95ff]"
          }`}
        >
          {loading ? "处理中..." : loggedIn ? shortAddr : "连接钱包"}
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm p-5 text-xs text-soft">
            <h2 className="mb-2 text-sm font-black text-white">钱包身份验证</h2>
            <p className="mb-3 leading-6">请在钱包中完成连接和签名，不会产生链上手续费。</p>
            <button
              type="button"
              disabled
              className="mb-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-[#cfd8ff]"
            >
              {stage === "connect" && "正在连接钱包..."}
              {stage === "nonce" && "正在请求 nonce..."}
              {stage === "sign" && "等待签名确认..."}
              {stage === "login" && "正在创建登录会话..."}
              {!stage && "处理中..."}
            </button>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-outline px-3 py-1.5 text-xs"
                onClick={() => {
                  opIdRef.current += 1;
                  setLoading(false);
                  setStage(null);
                  setShowModal(false);
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {loggedIn && showAccountMenu && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-24 backdrop-blur-sm"
          onClick={() => setShowAccountMenu(false)}
        >
          <div
            className="glass-panel w-full max-w-md p-5 text-xs text-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#1a2944] to-[#152136] p-4">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#4b86ff2b]" />
              <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-[#2bbf9c1e]" />

              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2 text-[11px] font-bold leading-4 text-white">
                  {avatarLabel}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-3xl font-black text-white">{shortAddr}</p>
                  <p className="mt-1 text-[11px] text-[#b8c8ee]">{connectedWalletLabel}</p>
                </div>
                <span className="rounded-full border border-[#57d88a88] bg-[#57d88a22] px-2 py-1 text-[10px] font-semibold text-[#ddffea]">
                  已连接
                </span>
              </div>

              <p className="relative z-10 mt-3 break-all rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-[#c7d6ff]">
                {account}
              </p>
            </div>

            <p className="mt-3 text-[11px] text-[#9eb1df]">
              可以在这里快速复制地址、进入个人中心或退出登录。
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[12px] font-semibold text-[#d6e0ff] transition hover:bg-white/10"
                onClick={handleCopyAddress}
              >
                {copied ? "已复制" : "复制地址"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[12px] font-semibold text-[#d6e0ff] transition hover:bg-white/10"
                onClick={() => {
                  setShowAccountMenu(false);
                  router.push("/profile");
                }}
              >
                个人中心
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[12px] font-semibold text-[#d6e0ff] transition hover:bg-white/10"
                onClick={() => handleLogout(true)}
              >
                退出登录
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[12px] font-semibold text-[#d6e0ff] transition hover:bg-white/10"
                onClick={() => setShowAccountMenu(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
