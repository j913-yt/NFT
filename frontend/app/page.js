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
    const topLabel = topCategory
      ? `${categoryLabelMap[topCategory[0]] || "其他"} · ${topCategory[1]} 件`
      : "暂无";

    return {
      listedCount: listedNfts.length,
      floor,
      avg,
      topLabel
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
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(95,141,255,0.3)] bg-[rgba(95,141,255,0.1)] px-3 py-1 text-xs font-bold text-[#b4d0ff] shadow-[0_0_15px_rgba(95,141,255,0.2)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5f8dff] opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5f8dff]"></span>
              </span>
              Web3 Marketplace
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl lg:text-5xl xl:text-6xl text-white">
              <span className="bg-gradient-to-r from-[#5f8dff] via-[#4fa5ff] to-[#3fecd7] bg-clip-text text-transparent drop-shadow-md pb-1">把你无处安放的创作</span>
              <br />
              <span className="mt-2 block">发布成可交易的 NFT</span>
            </h1>
            <p className="max-w-xl text-sm leading-7 text-[#a4b8df] sm:text-[15px]">
              支持图片、音频、视频作品上传，结合 IPFS 存储与钱包签名登录，为您打造从铸造到上架交易的超沉浸式完整体验。
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/nfts" className="btn-primary group relative overflow-hidden px-8 py-3.5 shadow-[0_10px_30px_rgba(95,141,255,0.4)]">
                <span className="relative z-10 font-bold tracking-wide">立刻探索市场</span>
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full" />
              </Link>
              <Link href="/nfts/create" className="btn-outline px-8 py-3.5 backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                <span className="font-bold tracking-wide">发布首个 NFT</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-4 text-xs font-semibold text-[#8096c4]">
              <span className="flex items-center gap-1.5"><svg className="h-4 w-4 text-[#37c8d0]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>全网 IPFS 存储</span>
              <span className="flex items-center gap-1.5"><svg className="h-4 w-4 text-[#37c8d0]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>钱包签名快速登录</span>
              <span className="flex items-center gap-1.5"><svg className="h-4 w-4 text-[#37c8d0]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>链上实时交易体验</span>
            </div>

            {error && <p className="status-message error mt-4 bg-red-500/10 text-red-300 border border-red-500/30 p-3 rounded-lg flex items-center gap-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>{error}</p>}
          </div>

          <div className="surface-panel pulse-edge relative overflow-hidden p-6 sm:p-7 shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.08)] bg-gradient-to-tl from-[rgba(15,25,40,0.7)] to-[rgba(30,45,70,0.4)] backdrop-blur-xl rounded-[1.5rem] mt-2 sm:mt-0">
            <div className="mb-5 flex items-center gap-2.5 z-10 relative">
              <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#37c8d0] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#37c8d0]"></span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#86a1d8]">
                Market Overview
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs z-10 relative">
              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(95,141,255,0.1)]">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-blue-500/20 to-transparent blur-xl transition-all duration-500 group-hover:scale-[2.5] group-hover:opacity-100 opacity-0" />
                <p className="relative z-10 text-[11px] font-medium text-[#9ba8cc] uppercase tracking-wider">目前在售</p>
                <div className="relative z-10 mt-2 flex items-baseline gap-1.5">
                  <strong className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                    {loading ? "..." : marketStats.listedCount}
                  </strong>
                  <span className="text-[#6c85b5] font-semibold text-[10px]">件精品</span>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(32,196,181,0.1)]">
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-teal-500/20 to-transparent blur-xl transition-all duration-500 group-hover:scale-[2.5] group-hover:opacity-100 opacity-0" />
                <p className="relative z-10 text-[11px] font-medium text-[#9ba8cc] uppercase tracking-wider">市场地板价</p>
                <strong className="relative z-10 mt-2 block text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {loading ? "..." : formatPrice(marketStats.floor, "ETH")}
                </strong>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(32,196,181,0.1)]">
                <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-gradient-to-tr from-teal-500/20 to-transparent blur-xl transition-all duration-500 group-hover:scale-[2.5] group-hover:opacity-100 opacity-0" />
                <p className="relative z-10 text-[11px] font-medium text-[#9ba8cc] uppercase tracking-wider">平均成交</p>
                <strong className="relative z-10 mt-2 block text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {loading ? "..." : formatPrice(marketStats.avg, "ETH")}
                </strong>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_20px_rgba(95,141,255,0.1)]">
                <div className="absolute -left-6 -bottom-6 h-20 w-20 rounded-full bg-gradient-to-tr from-blue-500/20 to-transparent blur-xl transition-all duration-500 group-hover:scale-[2.5] group-hover:opacity-100 opacity-0" />
                <p className="relative z-10 text-[11px] font-medium text-[#9ba8cc] uppercase tracking-wider">最热分类</p>
                <strong className="relative z-10 mt-2 block text-lg sm:text-xl font-black bg-gradient-to-r from-[#9eb9ff] to-[#4fa5ff] bg-clip-text text-transparent tracking-tight drop-shadow-md">
                  {loading ? "..." : marketStats.topLabel}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel px-5 py-5 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-white/[0.06] pb-5">
          <div className="flex items-center gap-4">
            <div className="h-10 w-1.5 rounded-full bg-gradient-to-b from-[#5f8dff] to-[#37c8d0] shadow-[0_0_12px_rgba(95,141,255,0.6)]" />
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-md">精选在售作品</h2>
              <p className="mt-1.5 text-sm text-[#8a9cc2]">按分类快速发现当前最具潜力的 NFT 收藏</p>
            </div>
          </div>
          <Link href="/nfts" className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-bold text-[#c4d4f8] transition-all hover:border-white/30 hover:bg-white/10 hover:text-white">
            发现更多市场作品
            <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
            当前分类暂无在售 NFT。
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
