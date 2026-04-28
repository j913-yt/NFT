export const TX_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_TX_EXPLORER_BASE ||
  "https://sepolia.etherscan.io/tx/";

export const categoryLabelMap = {
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他",
};

export function formatPrice(value, unit = "ETH") {
  const safeUnit = unit || "ETH";
  if (!value) return `0 ${safeUnit}`;

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized === 0) {
    return `0 ${safeUnit}`;
  }

  if (normalized < 0.00000001) {
    return `< 0.00000001 ${safeUnit}`;
  }

  return `${normalized.toFixed(8).replace(/\.?0+$/, "")} ${safeUnit}`;
}

export function formatRoyaltyPercent(bps) {
  const normalized = Number(bps || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return "0";
  }

  return (normalized / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function shortHex(value, left = 6, right = 4) {
  if (!value) return "-";
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

export function formatTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

export function hasWalletLogin() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage.getItem("jwt_token"));
}

export function readCurrentUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawUser = window.localStorage.getItem("current_user");
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export function hasPositiveWei(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^0+/, "");
  return normalized !== "";
}
