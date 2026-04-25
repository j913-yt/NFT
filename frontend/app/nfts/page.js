"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MarketplaceCard from "@/components/MarketplaceCard";
import MarketplaceFilters from "@/components/MarketplaceFilters";
import MarketplaceStats from "@/components/MarketplaceStats";
import { getNFTs } from "@/lib/api";
import { filterAndSortNFTs } from "@/lib/marketplace";

const FAVORITES_KEY = "market_favorites";
const SKELETON_COUNT = 8;
const INITIAL_FILTERS = Object.freeze({
  category: "all",
  search: "",
  sortBy: "latest",
  minPrice: "",
  maxPrice: "",
  onlyFav: false
});

function useFavorites() {
  const [favorites, setFavorites] = useState([]);
  const [favoriteError, setFavoriteError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("收藏数据格式错误");
      setFavorites(parsed);
    } catch (err) {
      setFavoriteError(`收藏读取失败：${err.message}`);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  }, []);

  return { favorites, favoriteError, toggleFavorite };
}

function useListedNFTs(category) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchData() {
      setLoading(true);
      setError("");
      try {
        const list = await getNFTs({
          category: category === "all" ? undefined : category,
          listed: true
        });
        if (active) setNfts(list || []);
      } catch (err) {
        if (active) setError(err.message || "加载 NFT 列表失败");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchData();
    return () => {
      active = false;
    };
  }, [category]);

  return { nfts, loading, error };
}

function MarketCardSkeleton() {
  return (
    <article className="market-card">
      <div className="h-[292px] animate-pulse bg-white/10" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded bg-white/10" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-white/10" />
      </div>
    </article>
  );
}

function EmptyState({ hasActiveFilters, onReset }) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-3 px-6 py-10 text-sm text-soft">
      <p>{hasActiveFilters ? "没有匹配结果，请放宽筛选条件。" : "当前暂无在售 NFT。"}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {hasActiveFilters && (
          <button type="button" className="btn-outline px-4 py-2 text-xs" onClick={onReset}>
            清空筛选
          </button>
        )}
        <Link href="/nfts/create" className="btn-primary px-4 py-2 text-xs">
          去创建 NFT
        </Link>
      </div>
    </div>
  );
}

function ResultsGrid({ items, loading, favorites, onToggleFavorite }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {loading && Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <MarketCardSkeleton key={`skeleton-${index}`} />
      ))}
      {!loading && items.map((nft) => (
        <MarketplaceCard
          key={nft.id}
          nft={nft}
          href={`/nfts/${nft.id}`}
          showFavorite
          isFavorite={favorites.includes(nft.id)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

export default function NFTListPage() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const { favorites, favoriteError, toggleFavorite } = useFavorites();
  const { nfts, loading, error } = useListedNFTs(filters.category);

  const displayNfts = useMemo(() => filterAndSortNFTs(nfts, {
    ...filters,
    favorites
  }), [nfts, filters, favorites]);

  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS);
  const resetFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="badge">Marketplace</span>
            <h1 className="mt-3 text-4xl font-black text-white sm:text-5xl">NFT 市场</h1>
            <p className="mt-2 text-sm text-soft">通过分类、价格、收藏和排序快速定位目标藏品。</p>
          </div>
          <span className="text-xs text-soft">
            {loading ? "同步中..." : `当前结果 ${displayNfts.length} 件`}
          </span>
        </div>
        <MarketplaceStats nfts={nfts} loading={loading} />
      </section>

      <MarketplaceFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        onChange={setFilters}
        onReset={resetFilters}
      />

      {loading && <p className="status-message info">正在加载 NFT 列表...</p>}
      {error && <p className="status-message error">{error}</p>}
      {favoriteError && <p className="status-message error">{favoriteError}</p>}
      {!loading && !error && displayNfts.length === 0 && (
        <EmptyState hasActiveFilters={hasActiveFilters} onReset={resetFilters} />
      )}
      <ResultsGrid
        items={displayNfts}
        loading={loading}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
