"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNFTs } from "@/lib/api";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const formatPrice = (value) => {
  if (!value) return "未定价";
  const num = Number(value);
  if (!isFinite(num) || num === 0) return "未定价";
  if (num < 0.00000001) return "< 0.00000001 ETH";
  return `${parseFloat(num.toFixed(8)).toString()} ETH`;
};

export default function NFTListPage() {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const list = await getNFTs(category === "all" ? undefined : category);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">探索市场藏品</h1>
          <p className="mt-1 text-xs text-slate-300/80">
            所有 NFT 都来自同一合约，TokenID 与交易哈希由链上自动生成，你可以在这里展示给答辩老师看完整的资产列表。
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-300">
          <span>类别筛选：</span>
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "全部" },
              { id: "art", label: "艺术" },
              { id: "music", label: "音乐" },
              { id: "video", label: "视频" },
              { id: "game", label: "游戏" },
              { id: "other", label: "其他" }
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-full border px-3 py-1 ${
                  category === c.id
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-slate-600/70 bg-slate-900/40 text-slate-300 hover:border-slate-400"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-300">加载中...</p>}
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {!loading && !error && nfts.length === 0 && (
        <div className="glass-panel flex flex-1 items-center justify-center px-6 py-16 text-sm text-slate-300">
          当前还没有任何 NFT，先去「创建 NFT」体验一条完整链路吧。
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {nfts.map((nft) => (
          <Link key={nft.id} href={`/nfts/${nft.id}`} className="block">
            <article className="glass-panel card-hover flex h-full flex-col overflow-hidden">
              <div className="relative">
                {nft.imageUrl ? (
                  <img
                    src={
                      nft.imageUrl.startsWith("/static/")
                        ? `${BACKEND_BASE}${nft.imageUrl}`
                        : nft.imageUrl
                    }
                    alt={nft.name}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-52 w-full items-center justify-center bg-slate-900/70 text-xs text-slate-500">
                    无图片
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent px-3 pb-2 pt-8 text-[11px] text-slate-200">
                  <span className="truncate">#{nft.tokenId || "未上链"}</span>
                  <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    {formatPrice(nft.price)}
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 px-3 py-3 text-xs">
                <h2 className="truncate text-sm font-semibold text-slate-50">
                  {nft.name || "未命名藏品"}
                </h2>
                <p className="line-clamp-2 text-[11px] text-slate-300">
                  {nft.description || "暂无描述。"}
                </p>
                <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                  <p className="truncate">
                    合约：{nft.contract || "未配置合约地址"}
                  </p>
                  {nft.category && <p>类别：{nft.category}</p>}
                  <p>创建时间：{nft.createdAt?.slice(0, 10) || "—"}</p>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}

