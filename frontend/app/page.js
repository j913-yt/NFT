"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getNFTs } from "@/lib/api";
import NFTTypeTabs from "@/components/NFTTypeTabs";
import MarketplaceCard from "@/components/MarketplaceCard";

const categoryLabelMap = {
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他"
};

const formatPrice = (value, unit = "ETH") => {
  const safeUnit = unit || "ETH";
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return `未上架 (${safeUnit})`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  return `${num.toFixed(8).replace(/\.?0+$/, "")} ${safeUnit}`;
};

export default function HomePage() {
  const [listedNfts, setListedNfts] = useState([]);
  const [selectedType, setSelectedType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchListedNfts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const list = await getNFTs({ listed: true });
      setListedNfts(list || []);
    } catch (err) {
      setError(err.message || "加载市场数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListedNfts();
  }, [fetchListedNfts]);

  const marketStats = useMemo(() => {
    const priced = listedNfts
      .map((n) => Number(n.price || 0))
      .filter((v) => Number.isFinite(v) && v > 0);

    const floor = priced.length ? Math.min(...priced) : 0;
    const avg = priced.length
      ? priced.reduce((sum, v) => sum + v, 0) / priced.length
      : 0;

    const byCategory = listedNfts.reduce((acc, item) => {
      const key = item.category || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    return {
      listedCount: listedNfts.length,
      floor,
      avg,
      topCategory: topCategory ? `${categoryLabelMap[topCategory[0]] || "其他"}（${topCategory[1]}）` : "暂无"
    };
  }, [listedNfts]);

  const featured = useMemo(() => {
    const source =
      selectedType === "all"
        ? listedNfts
        : listedNfts.filter((item) => (item.category || "other") === selectedType);

    return source.slice(0, 4);
  }, [listedNfts, selectedType]);

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="glass-panel hero-glow relative overflow-hidden px-6 py-8 sm:px-8">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-5">
            <h1 className="section-title max-w-2xl text-4xl sm:text-5xl">
              NFT数字藏品市场
            </h1>
            <div className="flex flex-wrap gap-3">
              <Link href="/nfts" className="btn-primary px-5 py-2.5">
                进入市场
              </Link>
              <Link href="/nfts/create" className="btn-outline px-5 py-2.5">
                创建 NFT
              </Link>
            </div>
            {error && <p className="status-message error">{error}</p>}
          </div>

          <div className="glass-panel pulse-edge relative overflow-hidden p-5">
            <div className="relative z-10 grid grid-cols-2 gap-3 text-xs text-soft">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p>在售数量</p>
                <strong className="mt-1 block text-xl font-black text-white">
                  {loading ? "..." : marketStats.listedCount}
                </strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p>地板价</p>
                <strong className="mt-1 block text-xl font-black text-white">
                  {loading ? "..." : formatPrice(marketStats.floor, "ETH")}
                </strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p>平均价</p>
                <strong className="mt-1 block text-xl font-black text-white">
                  {loading ? "..." : formatPrice(marketStats.avg, "ETH")}
                </strong>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p>热门类型</p>
                <strong className="mt-1 block text-xl font-black text-white">
                  {loading ? "..." : marketStats.topCategory}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel px-5 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-white">精选藏品</h2>
          <Link href="/nfts" className="btn-outline px-3 py-1.5 text-xs">
            查看全部
          </Link>
        </div>

        <NFTTypeTabs selected={selectedType} onChange={setSelectedType} compact />

        <div className="neo-divider my-4" />

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="h-52 animate-pulse rounded-xl bg-white/10" />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="mt-2 h-3 w-full animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-soft">
            当前类型暂无在售 NFT。
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((nft) => (
              <MarketplaceCard key={nft.id} nft={nft} href={`/nfts/${nft.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

