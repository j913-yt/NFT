import { ethers } from "ethers";

import { PREFERRED_WALLET_ID_KEY } from "./constants";
import { shortAddress } from "./utils";

export function getPreferredWalletId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PREFERRED_WALLET_ID_KEY) || "";
}

export function setPreferredWalletId(walletId) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = String(walletId || "").trim();
  if (!normalized) {
    window.localStorage.removeItem(PREFERRED_WALLET_ID_KEY);
    return;
  }

  window.localStorage.setItem(PREFERRED_WALLET_ID_KEY, normalized);
}

function readLoggedInWallet() {
  if (typeof window === "undefined") {
    return "";
  }

  const rawUser = window.localStorage.getItem("current_user");
  if (!rawUser) {
    return "";
  }

  try {
    const user = JSON.parse(rawUser);
    return String(user?.wallet || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function assertLoggedInWallet(account, actionLabel = "当前操作") {
  const expectedWallet = readLoggedInWallet();
  if (!expectedWallet) {
    return;
  }

  const actualWallet = String(account || "").trim().toLowerCase();
  if (!actualWallet || actualWallet === expectedWallet) {
    return;
  }

  throw new Error(
    `${actionLabel}使用的钱包 ${shortAddress(account)} 与当前登录钱包 ${shortAddress(expectedWallet)} 不一致，请切换到登录钱包后重试`,
  );
}

function resolveTargetWallet(wallets, preferredId) {
  const fallback = wallets[0];
  const normalizedPreferredId =
    String(preferredId || getPreferredWalletId() || "").trim() || "";
  if (!normalizedPreferredId) {
    return fallback;
  }

  return wallets.find((wallet) => wallet.id === normalizedPreferredId) || fallback;
}

export function detectInjectedWallets() {
  if (typeof window === "undefined") {
    return [];
  }

  const results = [];
  const ethereum = window.ethereum;
  const providers = ethereum?.providers || (ethereum ? [ethereum] : []);

  const pushWallet = (provider, id, name) => {
    if (!provider) return;
    if (results.find((wallet) => wallet.provider === provider)) return;
    results.push({ id, name, provider });
  };

  for (const provider of providers) {
    if (provider.isOkxWallet || provider.isOKExWallet) {
      pushWallet(provider, "okx", "OKX 钱包");
      continue;
    }

    if (provider.isBitKeep || provider.isBitgetWallet) {
      pushWallet(provider, "bitget", "Bitget 钱包");
      continue;
    }

    if (provider.isMetaMask) {
      pushWallet(provider, "metamask", "MetaMask 钱包");
    }
  }

  const okx = window.okxwallet?.ethereum || window.okxwallet;
  if (okx && !results.find((wallet) => wallet.id === "okx")) {
    pushWallet(okx, "okx", "OKX 钱包");
  }

  const bitget = window.bitkeep?.ethereum || window.bitkeep;
  if (bitget && !results.find((wallet) => wallet.id === "bitget")) {
    pushWallet(bitget, "bitget", "Bitget 钱包");
  }

  if (!results.length && ethereum) {
    pushWallet(ethereum, "injected", "浏览器默认钱包");
  }

  return results;
}

export async function getProviderAndSigner(preferredId) {
  if (typeof window === "undefined") {
    throw new Error("仅在浏览器中可用");
  }

  const wallets = detectInjectedWallets();
  if (!wallets.length) {
    throw new Error("未检测到钱包，请先安装 MetaMask / OKX / Bitget 等扩展");
  }

  const targetWallet = resolveTargetWallet(wallets, preferredId);
  const provider = new ethers.BrowserProvider(targetWallet.provider);
  const accounts = await provider.send("eth_requestAccounts", []);
  if (!Array.isArray(accounts) || !accounts[0]) {
    throw new Error("钱包未返回可用账号，请先在钱包中授权");
  }

  const expectedWallet = readLoggedInWallet();
  const matchedAccount = expectedWallet
    ? accounts.find(
        (account) => String(account || "").trim().toLowerCase() === expectedWallet,
      )
    : "";
  const account = String(matchedAccount || accounts[0]).trim();

  assertLoggedInWallet(account, "链上交易");
  setPreferredWalletId(targetWallet.id);

  return {
    provider,
    signer: await provider.getSigner(account),
    account,
    walletId: targetWallet.id,
  };
}
