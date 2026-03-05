"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createOrder, getNFTById } from "@/lib/api";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const formatPrice = (value) => {
  if (!value) return "0";
  const num = Number(value);
  if (!isFinite(num) || num === 0) return "0";
  if (num < 0.00000001) return "< 0.00000001";
  return parseFloat(num.toFixed(8)).toString();
};

export default function NFTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [nft, setNft] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      try {
        const data = await getNFTById(id);
        if (data.nft) {
          setNft(data.nft);
          setOwner(data.owner || null);
        } else {
          // 兼容旧结构
          setNft(data);
          setOwner(null);
        }
      } catch (err) {
        setMessage(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleBuy = async () => {
    if (!nft) return;
    setBuying(true);
    setMessage("");
    try {
      const order = await createOrder({
        nftId: nft.id,
        price: nft.price || 0,
        txHash: "offchain-demo" // 这里可在接入真实链上交易后替换
      });
      setMessage(`下单成功，订单号 #${order.id}`);
      // 简单刷新列表状态：把 ownerId 改掉可在下一轮接口中体现，这里先保持 demo 即可
    } catch (err) {
      setMessage(err.message || "下单失败，请确认已登录");
      if (err.message?.includes("未登录")) {
        setTimeout(() => router.push("/auth/login"), 800);
      }
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel mx-auto max-w-3xl px-6 py-8 text-sm text-slate-200">
        正在加载 NFT 详情...
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="glass-panel mx-auto max-w-3xl px-6 py-8 text-sm text-slate-200">
        NFT 不存在或已被下架。
      </div>
    );
  }

  return (
    <div className="glass-panel mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 lg:flex-row">
      <div className="w-full lg:w-[55%]">
        {nft.imageUrl ? (
          <img
            src={
              nft.imageUrl.startsWith("/static/")
                ? `${BACKEND_BASE}${nft.imageUrl}`
                : nft.imageUrl
            }
            alt={nft.name}
            className="h-80 w-full rounded-2xl border border-slate-700 object-cover"
          />
        ) : (
          <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-dashed border-slate-600 text-xs text-slate-400">
            暂无图片
          </div>
        )}
      </div>
      <div className="flex w-full flex-1 flex-col gap-4 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            NovaNFT · On-chain Collectible
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">
            {nft.name || "未命名藏品"}
          </h1>
        </div>
        <p className="text-xs leading-relaxed text-slate-200/80">
          {nft.description || "暂无描述。你可以在展示时口头补充这个作品的创意和含义。"}
        </p>
        <div className="rounded-2xl bg-slate-900/70 p-3 text-[11px] text-slate-300 space-y-2">
          <div>
            <p className="mb-1 font-medium text-slate-100">链上信息</p>
            <p className="truncate">
              合约地址：{nft.contract || "未配置合约（可在部署合约后补上）"}
            </p>
            <p>Token ID：{nft.tokenId || "待链上 mint 后确定"}</p>
            <p>当前价格：{formatPrice(nft.price)} ETH（展示用）</p>
            <p>创建时间：{nft.createdAt?.slice(0, 19) || "—"}</p>
          </div>
          <div className="pt-1 border-t border-slate-700/60">
            <p className="mb-1 font-medium text-slate-100">拥有者</p>
            {owner ? (
              <>
                <p>用户名：{owner.username || "未设置"}</p>
                <p className="break-all">
                  钱包地址：{owner.wallet || "未知"}
                </p>
              </>
            ) : (
              <p>拥有者信息暂不可用。</p>
            )}
          </div>
        </div>
        <button
          onClick={handleBuy}
          disabled={buying}
          className="btn-primary mt-1 w-full justify-center"
        >
          {buying ? "下单中..." : "模拟购买 / 创建订单"}
        </button>
        {message && (
          <p className="mt-2 text-xs text-slate-200">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

