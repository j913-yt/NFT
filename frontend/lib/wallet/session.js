export const EMPTY_WALLET_SESSION = Object.freeze({
  account: "",
  loggedIn: false,
});

export const WALLET_SESSION_CHANGED_EVENT = "wallet-session-changed";

export function sameAddress(firstAddress, secondAddress) {
  return (
    String(firstAddress || "").trim().toLowerCase() ===
    String(secondAddress || "").trim().toLowerCase()
  );
}

export function shortWalletAddress(account) {
  const normalized = String(account || "").trim();
  if (!normalized) {
    return "";
  }
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function readWalletSession() {
  if (typeof window === "undefined") {
    return EMPTY_WALLET_SESSION;
  }

  const token = window.localStorage.getItem("jwt_token");
  const userRaw = window.localStorage.getItem("current_user");
  if (!token || !userRaw) {
    return EMPTY_WALLET_SESSION;
  }

  const user = JSON.parse(userRaw);
  const account = String(user?.wallet || "").trim();
  return account ? { account, loggedIn: true } : EMPTY_WALLET_SESSION;
}

export function clearWalletSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("jwt_token");
  window.localStorage.removeItem("current_user");
  window.dispatchEvent(new Event(WALLET_SESSION_CHANGED_EVENT));
}
