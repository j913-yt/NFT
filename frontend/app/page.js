"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import MarketplaceCard from "@/components/MarketplaceCard";
import MarketplaceStats from "@/components/MarketplaceStats";
import NFTTypeTabs from "@/components/NFTTypeTabs";
import AnimatedSection from "@/components/AnimatedSection";
import { getNFTs } from "@/lib/api";

const FEATURED_COUNT = 4;
const SKELETON_COUNT = 4;

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <div key={index} className="market-card">
          <div className="h-[292px] animate-pulse bg-white/10" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-full animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HomeHero({ nfts, loading, error }) {
  return (
    <AnimatedSection className="home-hero">
      <div className="home-hero-content">
        <span className="badge">Marketplace</span>
        <h1>面向数字藏品创作者与收藏者的链上交易市场</h1>
        <p className="mt-4 text-sm leading-7 text-soft">
          汇聚图片、音频、视频等多类型 NFT，覆盖 IPFS 存储、钱包签名、铸造上架与链上交易全流程。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/nfts" className="btn-primary px-6 py-3">浏览市场</Link>
          <Link href="/nfts/create" className="btn-outline px-6 py-3">发布作品</Link>
        </div>
        <div className="mt-7 max-w-4xl">
          <MarketplaceStats nfts={nfts} loading={loading} />
        </div>
        {error && <p className="status-message error">{error}</p>}
      </div>
    </AnimatedSection>
  );
}

function FeaturedSection({ featured, loading, selectedType, onTypeChange }) {
  return (
    <AnimatedSection className="glass-panel px-5 py-5 sm:px-6" delay={0.08}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge">Browse</span>
          <h2 className="mt-3 text-3xl font-black text-white">精选在售作品</h2>
          <p className="mt-2 text-sm text-soft">按分类快速发现当前可交易的 NFT。</p>
        </div>
        <Link href="/nfts" className="btn-outline px-4 py-2 text-xs">查看全部</Link>
      </div>

      <NFTTypeTabs selected={selectedType} onChange={onTypeChange} compact />
      <div className="neo-divider my-4" />

      {loading && <LoadingGrid />}
      {!loading && featured.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-soft">
          当前分类暂无在售 NFT。
        </div>
      )}
      {!loading && featured.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((nft) => (
            <MarketplaceCard key={nft.id} nft={nft} href={`/nfts/${nft.id}`} />
          ))}
        </div>
      )}
    </AnimatedSection>
  );
}

export default function HomePage() {
  const [listedNfts, setListedNfts] = useState([]);
  const [selectedType, setSelectedType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchListedNfts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
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

  const featured = useMemo(() => {
    const source = selectedType === "all"
      ? listedNfts
      : listedNfts.filter((item) => (item.category || "other") === selectedType);
    return source.slice(0, FEATURED_COUNT);
  }, [listedNfts, selectedType]);

  return (
    <div className="flex w-full flex-col gap-6">
      <HomeHero nfts={listedNfts} loading={loading} error={error} />
      <FeaturedSection
        featured={featured}
        loading={loading}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
      />
    </div>
  );
}
