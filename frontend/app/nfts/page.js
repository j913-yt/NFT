"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getNFTs } from "@/lib/api";
import NFTTypeTabs from "@/components/NFTTypeTabs";
import MarketplaceCard from "@/components/MarketplaceCard";

const categoryLabelMap = {
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他"
};

const sortOptions = [
  { id: "latest", label: "最新上架" },
  { id: "priceLow", label: "价格从低到高" },
  { id: "priceHigh", label: "价格从高到低" },
  { id: "nameAZ", label: "名称 A-Z" },
  { id: "oldest", label: "最早上架" }
];

function formatPrice(value, unit = "ETH") {
  const safeUnit = unit || "ETH";
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return `未上架 (${safeUnit})`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  return `${num.toFixed(8).replace(/\.?0+$/, "")} ${safeUnit}`;
}

function Stats({ nfts }) {
  const stats = useMemo(() => {
    const priced = (nfts || [])
      .map((n) => Number(n.price || 0))
      .filter((v) => Number.isFinite(v) && v > 0);

    const floor = priced.length ? Math.min(...priced) : 0;
    const avg = priced.length ? priced.reduce((a, b) => a + b, 0) / priced.length : 0;

    const byCategory = (nfts || []).reduce((acc, item) => {
      const key = item.category || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const topCategory = top ? `${categoryLabelMap[top[0]] || "其他"} · ${top[1]} 件` : "暂无";

    return {
      listed: priced.length,
      total: nfts.length,
      floor,
      avg,
      topCategory
    };
  }, [nfts]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="surface-panel">
        <p className="text-[11px] text-[#9daad0]">在售数量</p>
        <p className="mt-1 text-xl font-black text-white">{stats.listed}</p>
      </div>
      <div className="surface-panel">
        <p className="text-[11px] text-[#9daad0]">藏品总数</p>
        <p className="mt-1 text-xl font-black text-white">{stats.total}</p>
      </div>
      <div className="surface-panel">
        <p className="text-[11px] text-[#9daad0]">地板价</p>
        <p className="mt-1 text-xl font-black text-white">{formatPrice(stats.floor, "ETH")}</p>
      </div>
      <div className="surface-panel">
        <p className="text-[11px] text-[#9daad0]">平均价</p>
        <p className="mt-1 text-xl font-black text-white">{formatPrice(stats.avg, "ETH")}</p>
      </div>
      <div className="surface-panel">
        <p className="text-[11px] text-[#9daad0]">热门分类</p>
        <p className="mt-1 text-base font-black text-white">{stats.topCategory}</p>
      </div>
    </div>
  );
}

function MarketCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f1a]">
      <div className="h-[292px] animate-pulse bg-gradient-to-b from-white/5 to-white/[0.03]" />
      <div className="space-y-2 px-3 py-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded bg-white/10" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
      </div>
    </article>
  );
}

export default function NFTListPage() {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("market_favorites");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setFavorites(arr);
        }
      }
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("market_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        const list = await getNFTs({
          category: category === "all" ? undefined : category,
          listed: true
        });
        setNfts(list || []);
      } catch (err) {
        setError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [category]);

  const displayNfts = useMemo(() => {
    let list = [...nfts];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const name = (item.name || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const token = String(item.tokenId || "").toLowerCase();
        return name.includes(q) || desc.includes(q) || token.includes(q);
      });
    }

    const min = Number(minPrice);
    if (minPrice !== "" && Number.isFinite(min)) {
      list = list.filter((item) => Number(item.price || 0) >= min);
    }

    const max = Number(maxPrice);
    if (maxPrice !== "" && Number.isFinite(max)) {
      list = list.filter((item) => Number(item.price || 0) <= max);
    }

    if (onlyFav) {
      list = list.filter((item) => favorites.includes(item.id));
    }

    if (sortBy === "priceLow") {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "priceHigh") {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === "nameAZ") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    } else {
      list.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }

    return list;
  }, [nfts, search, sortBy, minPrice, maxPrice, onlyFav, favorites]);

  const hasActiveFilters =
    category !== "all" ||
    Boolean(search.trim()) ||
    sortBy !== "latest" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    onlyFav;

  const toggleFav = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="badge mb-2">Marketplace</p>
            <h1 className="text-4xl font-black text-white sm:text-5xl">NFT 市场</h1>
            <p className="mt-2 text-xs text-soft">通过筛选和排序快速定位目标藏品</p>
          </div>
          <span className="text-xs text-soft">
            {loading ? "同步中..." : `当前结果 ${displayNfts.length} 件`}
          </span>
        </div>
        <div className="neo-divider mb-4" />
        <Stats nfts={nfts} />
      </section>

      <section className="glass-panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <NFTTypeTabs selected={category} onChange={setCategory} />
          <button
            type="button"
            className="btn-outline px-3 py-1.5 text-xs"
            onClick={() => {
              setSearch("");
              setSortBy("latest");
              setMinPrice("");
              setMaxPrice("");
              setOnlyFav(false);
            }}
          >
            重置筛选
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <input
            className="input-neo xl:col-span-2"
            placeholder="搜索名称 / 描述 / Token ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="input-neo" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <input
            className="input-neo"
            type="number"
            min="0"
            step="0.00000001"
            placeholder="最低价格 (ETH)"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />

          <input
            className="input-neo"
            type="number"
            min="0"
            step="0.00000001"
            placeholder="最高价格 (ETH)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>

        <label className="mt-3 inline-flex items-center gap-2 text-xs text-soft">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#5f8dff]"
            checked={onlyFav}
            onChange={(e) => setOnlyFav(e.target.checked)}
          />
          仅查看收藏
        </label>
      </section>

      <div aria-live="polite" className="min-h-0">
        {loading && <p className="status-message info">正在加载 NFT 列表...</p>}
        {error && <p className="status-message error">{error}</p>}
      </div>

      {!loading && !error && displayNfts.length === 0 && (
        <div className="glass-panel flex flex-col items-center justify-center gap-3 px-6 py-10 text-sm text-soft">
          <p>{hasActiveFilters ? "没有匹配结果，请放宽筛选条件。" : "当前暂无在售 NFT。"}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-outline px-4 py-2 text-xs"
                onClick={() => {
                  setCategory("all");
                  setSearch("");
                  setSortBy("latest");
                  setMinPrice("");
                  setMaxPrice("");
                  setOnlyFav(false);
                }}
              >
                清空筛选
              </button>
            )}
            <Link href="/nfts/create" className="btn-primary px-4 py-2 text-xs">
              去创建 NFT
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading &&
          Array.from({ length: 8 }).map((_, index) => (
            <MarketCardSkeleton key={`skeleton-${index}`} />
          ))}

        {!loading &&
          displayNfts.map((nft) => (
            <MarketplaceCard
              key={nft.id}
              nft={nft}
              href={`/nfts/${nft.id}`}
              showFavorite
              isFavorite={favorites.includes(nft.id)}
              onToggleFavorite={toggleFav}
            />
          ))}
      </div>
    </div>
  );
}
