// web3 相关通用小工具。
// 提供安全数字转换、整数转换和钱包地址缩略展示。
export function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function toSafeInt(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return 0;
  }

  return Math.trunc(normalized);
}

export function shortAddress(value) {
  if (!value) {
    return "-";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
