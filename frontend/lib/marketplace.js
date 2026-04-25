export const PRICE_DECIMALS = 8;
export const SMALLEST_DISPLAY_PRICE = 0.00000001;

export const CATEGORY_LABELS = Object.freeze({
  all: "全部",
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他"
});

export const CATEGORY_TABS = Object.freeze([
  { id: "all", label: CATEGORY_LABELS.all },
  { id: "art", label: CATEGORY_LABELS.art },
  { id: "music", label: CATEGORY_LABELS.music },
  { id: "video", label: CATEGORY_LABELS.video },
  { id: "other", label: CATEGORY_LABELS.other }
]);

export const SORT_OPTIONS = Object.freeze([
  { id: "latest", label: "最新上架" },
  { id: "priceLow", label: "价格从低到高" },
  { id: "priceHigh", label: "价格从高到低" },
  { id: "nameAZ", label: "名称 A-Z" },
  { id: "oldest", label: "最早上架" }
]);

export function formatPrice(value, unit = "ETH") {
  const safeUnit = unit || "ETH";
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return `价格异常 (${safeUnit})`;
  if (num <= 0) return `未上架 (${safeUnit})`;
  if (num < SMALLEST_DISPLAY_PRICE) return `< ${SMALLEST_DISPLAY_PRICE} ${safeUnit}`;
  return `${num.toFixed(PRICE_DECIMALS).replace(/\.?0+$/, "")} ${safeUnit}`;
}

export function formatRoyaltyPercent(bps) {
  const num = Number(bps || 0);
  if (!Number.isFinite(num) || num <= 0) return "0";
  return (num / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function summarizeNFTs(nfts) {
  const priced = nfts.map((item) => Number(item.price || 0)).filter((price) => price > 0);
  const totalPrice = priced.reduce((sum, price) => sum + price, 0);
  const categoryCounts = countByCategory(nfts);
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  return {
    total: nfts.length,
    listed: priced.length,
    floor: priced.length ? Math.min(...priced) : 0,
    avg: priced.length ? totalPrice / priced.length : 0,
    topCategory: topCategory ? `${CATEGORY_LABELS[topCategory[0]] || CATEGORY_LABELS.other} · ${topCategory[1]} 件` : "暂无"
  };
}

export function filterAndSortNFTs(nfts, options) {
  const filtered = nfts.filter((item) => matchesFilters(item, options));
  return [...filtered].sort((a, b) => compareNFTs(a, b, options.sortBy));
}

function countByCategory(nfts) {
  return nfts.reduce((acc, item) => {
    const key = item.category || "other";
    return { ...acc, [key]: (acc[key] || 0) + 1 };
  }, {});
}

function matchesFilters(item, options) {
  return matchesCategory(item, options.category)
    && matchesSearch(item, options.search)
    && matchesPriceRange(item, options)
    && matchesFavorite(item, options);
}

function matchesCategory(item, category) {
  return !category || category === "all" || (item.category || "other") === category;
}

function matchesSearch(item, search) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  const fields = [item.name, item.description, item.tokenId].map((value) => String(value || "").toLowerCase());
  return fields.some((value) => value.includes(query));
}

function matchesPriceRange(item, options) {
  const price = Number(item.price || 0);
  const min = Number(options.minPrice);
  const max = Number(options.maxPrice);
  if (options.minPrice !== "" && Number.isFinite(min) && price < min) return false;
  if (options.maxPrice !== "" && Number.isFinite(max) && price > max) return false;
  return true;
}

function matchesFavorite(item, options) {
  if (!options.onlyFav) return true;
  return options.favorites.includes(item.id);
}

function compareNFTs(a, b, sortBy) {
  if (sortBy === "priceLow") return Number(a.price || 0) - Number(b.price || 0);
  if (sortBy === "priceHigh") return Number(b.price || 0) - Number(a.price || 0);
  if (sortBy === "nameAZ") return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
  if (sortBy === "oldest") return Number(a.id || 0) - Number(b.id || 0);
  return Number(b.id || 0) - Number(a.id || 0);
}
