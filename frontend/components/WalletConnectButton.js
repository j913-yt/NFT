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
  const [stage, setStage] = useState(null); // connect | nonce | sign | login
  const [showModal, setShowModal] = useState(false);
  const opIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("jwt_token");
    const userRaw = window.localStorage.getItem("current_user");
    if (token && userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u?.wallet) setAccount(u.wallet);
      } catch {
        // ignore
      }
      setLoggedIn(true);
    }

    const detected = detectInjectedWallets();
    setWalletOptions(detected);
    if (detected.length === 1) {
      setSelectedWalletId(detected[0].id);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    if (!eth?.on) return;

    const onAccountsChanged = (accounts) => {
      // 钱包“断开连接”通常会表现为 accounts 变成空数组
      if (!accounts || accounts.length === 0) {
        handleLogout(true);
        return;
      }
      const next = accounts[0];
      setAccount(next);
      // 如果切换了地址，为安全起见要求重新签名登录
      if (loggedIn) {
        const raw = window.localStorage.getItem("current_user");
        try {
          const u = raw ? JSON.parse(raw) : null;
          if (u?.wallet && u.wallet.toLowerCase() !== next.toLowerCase()) {
            handleLogout(false);
          }
        } catch {
          // ignore
        }
      }
    };

    const onDisconnect = () => {
      handleLogout(true);
    };

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
    if (navigate) router.push("/");
  };

  const handleClick = async () => {
    if (loading) return;
    if (!walletOptions.length) {
      alert("未检测到任何钱包扩展，请先安装 MetaMask / OKX / Bitget 等钱包插件。");
      return;
    }

    try {
      setLoading(true);
      setShowModal(true);
      setStage("connect");
      opIdRef.current += 1;
      const opId = opIdRef.current;

      // 1. 连接钱包（按用户选择的 provider）
      const { account: addr, signer } = await withTimeout(
        getProviderAndSigner(selectedWalletId),
        15_000,
        "连接钱包超时，请重试"
      );
      if (opId !== opIdRef.current) return;
      setAccount(addr);

      // 2. 向后端请求 nonce
      setStage("nonce");
      const { nonce } = await withTimeout(
        getWalletNonce(addr),
        10_000,
        "获取登录 nonce 超时，请确认后端已启动"
      );
      if (opId !== opIdRef.current) return;

      // 3. 让钱包签名 nonce
      const message = `NovaNFT Login\nnonce: ${nonce}`;
      setStage("sign");
      let signature;
      try {
        // 大部分钱包 (MetaMask) 是 [message, address]
        signature = await withTimeout(
          signer.provider.send("personal_sign", [message, addr]),
          60_000,
          "签名超时：请在钱包弹窗中确认或取消，然后重试"
        );
      } catch {
        // 少部分钱包/环境可能是 [address, message]
        signature = await withTimeout(
          signer.provider.send("personal_sign", [addr, message]),
          60_000,
          "签名超时：请在钱包弹窗中确认或取消，然后重试"
        );
      }
      if (opId !== opIdRef.current) return;

      // 4. 把签名发给后端换取 JWT
      setStage("login");
      await withTimeout(
        walletLogin(addr, signature),
        10_000,
        "登录超时：请确认后端可访问"
      );
      if (opId !== opIdRef.current) return;
      setLoggedIn(true);
      setShowModal(false);
      setStage(null);
      router.push("/profile");
    } catch (err) {
      console.error(err);
      if (typeof window !== "undefined") {
        const msg = err?.message || "钱包登录失败";
        // 兼容：钱包取消/拒绝签名一般是 4001
        if (err?.code === 4001 || msg.toLowerCase().includes("rejected")) {
          alert("你已取消钱包操作");
        } else {
          alert(msg);
        }
      }
    } finally {
      setLoading(false);
      if (!loggedIn) {
        // 如果还没登录成功，关闭验证弹窗
        setShowModal(false);
        setStage(null);
      }
    }
  };

  const label =
    loggedIn && account
      ? `${account.slice(0, 6)}...${account.slice(-4)}`
      : "连接钱包登录";

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          {walletOptions.length > 1 && (
            <select
              className="rounded-full border border-slate-600/70 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200 outline-none"
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
            className="btn-outline px-4 py-1.5 text-[11px]"
            title={loggedIn ? "钱包已登录" : "连接钱包并签名登录"}
          >
            {loading ? "连接中..." : loggedIn ? `已登录 · ${label}` : label}
          </button>
        </div>
        {loggedIn && (
          <button
            type="button"
            onClick={() => handleLogout(true)}
            className="btn-outline px-3 py-1.5 text-[11px]"
            title="退出登录（仅清除本地登录态）"
          >
            退出
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <div className="glass-panel max-w-sm px-6 py-5 text-xs text-slate-100">
            <h2 className="mb-2 text-sm font-semibold">验证你的账户</h2>
            <p className="mb-3 text-[11px] text-slate-300">
              为了完成连接，需要在钱包中签名一条消息，以验证你是该账户的拥有者。
            </p>
            <button
              type="button"
              disabled
              className="mb-3 w-full rounded-full bg-slate-800/80 px-3 py-2 text-[11px] font-medium text-slate-200"
            >
              {stage === "connect" && "正在连接钱包..."}
              {stage === "nonce" && "正在请求验证信息..."}
              {stage === "sign" && "等待你在钱包中签名..."}
              {stage === "login" && "正在创建登录会话..."}
              {!stage && "处理中..."}
            </button>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-outline px-3 py-1.5 text-[11px]"
                onClick={() => {
                  // 终止当前操作，但不清除已存在的登录态
                  opIdRef.current += 1;
                  setLoading(false);
                  setStage(null);
                  setShowModal(false);
                }}
              >
                取消验证
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

