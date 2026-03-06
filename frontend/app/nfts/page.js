"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getNFTs } from "@/lib/api";
import { getNFTMedia } from "@/lib/media";

const categories = [
  { id: "all", label: "全部" },
  { id: "art", label: "艺术" },
  { id: "music", label: "音乐" },
  { id: "video", label: "视频" },
  { id: "other", label: "其他" }
];

const categoryGlow = {
  art: "rgba(255, 31, 155, 0.75)",
  music: "rgba(114, 240, 140, 0.75)",
  video: "rgba(24, 210, 255, 0.75)",
  other: "rgba(142, 155, 201, 0.75)"
};

const formatPrice = (value, unit = "ETH") => {
  const safeUnit = unit || "ETH";
  if (!value) return `未上架 (${safeUnit})`;
  const num = Number(value);
  if (!isFinite(num) || num === 0) return `未上架 (${safeUnit})`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  return `${parseFloat(num.toFixed(8)).toString()} ${safeUnit}`;
};

function MarketMedia({ nft }) {
  const { mediaType, mediaUrl, coverUrl } = getNFTMedia(nft);

  if (!mediaUrl) {
    return (
      <div className="flex h-[320px] items-center justify-center bg-[#0a0d16] text-xs text-[#8f99b8]">
        暂无预览
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        poster={coverUrl || undefined}
        className="h-[320px] w-full object-cover"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
      />
    );
  }

  if (mediaType === "audio") {
    return (
      <div className="relative h-[320px] overflow-hidden bg-gradient-to-br from-[#132444] to-[#2a123b]">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={`${nft.name || "audio"} cover`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/50 p-2 backdrop-blur-sm">
          <audio controls src={mediaUrl} className="w-full" preload="metadata" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={nft.name}
      className="h-[320px] w-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );
}

function Stats({ nfts }) {
  const counts = useMemo(() => {
    const byCategory = nfts.reduce(
      (acc, item) => {
        const key = item.category || "other";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { art: 0, music: 0, video: 0, other: 0 }
    );

    return {
      total: nfts.length,
      art: byCategory.art || 0,
      multimedia: (byCategory.music || 0) + (byCategory.video || 0)
    };
  }, [nfts]);

  return (
    <div className="glass-panel px-4 py-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[#97a2c8]">NFT 藏品总数</p>
          <p className="mt-1 text-xl font-black text-white">{counts.total}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[#97a2c8]">艺术作品</p>
          <p className="mt-1 text-xl font-black text-white">{counts.art}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[#97a2c8]">音频 + 视频</p>
          <p className="mt-1 text-xl font-black text-white">{counts.multimedia}</p>
        </div>
      </div>
    </div>
  );
}

function MarketCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f1a]">
      <div className="h-[320px] animate-pulse bg-gradient-to-b from-white/5 to-white/[0.03]" />
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        const list = await getNFTs({ category: category === "all" ? undefined : category, listed: true });
        setNfts(list);
      } catch (err) {
        setError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [category]);

  return (
    <div className="flex w-full flex-col gap-6">
      <section>
        <h1 className="section-title mb-3 text-5xl">市场数据</h1>
        <div className="neo-divider mb-3" />
        <Stats nfts={nfts} />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-5xl font-black tracking-tight text-white">浏览市场</h2>
          <span className="text-xs text-soft">{loading ? "同步中..." : `${nfts.length} 件`}</span>
        </div>
        <div className="neo-divider mb-4" />
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="NFT 分类">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                category === c.id
                  ? "border-[#3f7bff] bg-[#3f7bff33] text-white"
                  : "border-white/20 bg-white/5 text-[#c6d1f7] hover:bg-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <div aria-live="polite" className="min-h-0">
        {loading && <p className="status-message info">正在加载 NFT 列表...</p>}
        {error && <p className="status-message error">{error}</p>}
      </div>

      {!loading && !error && nfts.length === 0 && (
        <div className="glass-panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-sm text-soft">
          <p>当前暂无 NFT，先去创建一个吧。</p>
          <Link href="/nfts/create" className="btn-primary px-4 py-2 text-xs">
            去创建 NFT
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading &&
          Array.from({ length: 8 }).map((_, index) => (
            <MarketCardSkeleton key={`skeleton-${index}`} />
          ))}

        {!loading &&
          nfts.map((nft) => {
            const glow = categoryGlow[nft.category] || categoryGlow.other;
            return (
              <Link key={nft.id} href={`/nfts/${nft.id}`} className="block">
                <article
                  className="card-hover overflow-hidden rounded-2xl border bg-[#0b0f1a]"
                  style={{
                    borderColor: glow,
                    boxShadow: `0 0 0 1px ${glow}33, 0 14px 30px rgba(0,0,0,0.45)`
                  }}
                >
                  <div className="relative">
                    <MarketMedia nft={nft} />
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent px-3 py-3 text-[11px]">
                      <span className="truncate text-[#c9d6ff]">
                        {(nft.contract || "0x---").slice(0, 14)}
                      </span>
                      <span className="rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] text-white">
                        {(nft.category || "other").toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-2 pt-12">
                      <p className="truncate text-lg font-black text-white">
                        {nft.name || "未命名"}
                      </p>
                      <p className="line-clamp-2 mt-1 text-[11px] text-[#d0daf8]">
                        {nft.description || "暂无描述"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] text-[#aec0f1]">
                    <span>#{nft.tokenId || "待上链"}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-white">
                      {formatPrice(nft.price, nft.priceUnit)}
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

