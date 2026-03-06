"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createOrder, getNFTById, getNFTOrderHistory, updateNFTListing } from "@/lib/api";
import { getNFTMedia } from "@/lib/media";
import { buyNFTWithWallet, listNFTWithWallet } from "@/lib/web3";

const TX_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_TX_EXPLORER_BASE ||
  "https://sepolia.etherscan.io/tx/";

const formatPrice = (value, unit = "ETH") => {
  const safeUnit = unit || "ETH";
  if (!value) return `0 ${safeUnit}`;
  const num = Number(value);
  if (!isFinite(num) || num === 0) return `0 ${safeUnit}`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  return `${parseFloat(num.toFixed(8)).toString()} ${safeUnit}`;
};

const shortHex = (value, left = 6, right = 4) => {
  if (!value) return "-";
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
};

const formatTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function hasBackendLogin() {
  if (typeof window === "undefined") return false;
  const token = window.localStorage.getItem("jwt_token");
  return Boolean(token);
}

function readCurrentUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("current_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function PrimaryMedia({ nft }) {
  const { mediaType, mediaUrl, coverUrl } = getNFTMedia(nft);

  if (!mediaUrl) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-white/15 bg-black/40 text-xs text-soft">
        暂无媒体内容
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        controls
        poster={coverUrl || undefined}
        src={mediaUrl}
        preload="metadata"
        className="h-[360px] w-full rounded-2xl border border-white/15 object-cover"
      />
    );
  }

  if (mediaType === "audio") {
    return (
      <div className="relative h-[360px] overflow-hidden rounded-2xl border border-white/15 bg-[#0d1120]">
        {(coverUrl || mediaUrl) && (
          <img
            src={coverUrl || mediaUrl}
            alt={`${nft.name || "audio"} cover`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-black/45 p-3 backdrop-blur-sm">
          <audio controls src={mediaUrl} className="w-full" preload="metadata" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={nft.name}
      className="h-[360px] w-full rounded-2xl border border-white/15 object-cover"
      loading="eager"
      decoding="async"
    />
  );
}

export default function NFTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [nft, setNft] = useState(null);
  const [owner, setOwner] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [buying, setBuying] = useState(false);
  const [relisting, setRelisting] = useState(false);
  const [listingPrice, setListingPrice] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  useEffect(() => {
    setCurrentUser(readCurrentUser());
  }, []);

  useEffect(() => {
    if (!id) return;

    let active = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setMessage("");
        setHistoryError("");

        const data = await getNFTById(id);
        if (!active) return;

        const detail = data.nft || data;
        setNft(detail);
        setOwner(data.owner || null);

        const p = Number(detail?.price || 0);
        setListingPrice(p > 0 ? String(p) : "");
      } catch (err) {
        if (!active) return;
        setMessageType("error");
        setMessage(err.message || "加载失败");
      } finally {
        if (active) {
          setLoading(false);
        }
      }

      try {
        setLoadingHistory(true);
        const list = await getNFTOrderHistory(id);
        if (!active) return;
        setOrderHistory(list || []);
      } catch (err) {
        if (!active) return;
        setHistoryError(err.message || "加载交易记录失败");
      } finally {
        if (active) {
          setLoadingHistory(false);
        }
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [id]);

  const isOwner = useMemo(() => {
    if (!currentUser?.id || !nft?.ownerId) return false;
    return Number(currentUser.id) === Number(nft.ownerId);
  }, [currentUser, nft]);

  const canBuy = !isOwner && Number(nft?.price || 0) > 0;
  const isListed = Number(nft?.price || 0) > 0;

  const handleBuy = async () => {
    if (!nft) return;

    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法购买");
      return;
    }

    if (!hasBackendLogin()) {
      setMessageType("error");
      setMessage("请先登录平台账号后再购买");
      setTimeout(() => router.push("/auth/login"), 600);
      return;
    }

    setBuying(true);
    setMessage("");

    try {
      const purchase = await buyNFTWithWallet({
        tokenId: nft.tokenId,
        fallbackPriceEth: Number(nft.price || 0)
      });

      const order = await createOrder({
        nftId: nft.id,
        price: purchase.priceEth,
        txHash: purchase.txHash
      });

      setMessageType("success");
      setMessage(`购买成功，订单号 #${order.id}`);

      setOwner((prev) => ({ ...prev, wallet: purchase.account }));
      setNft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ownerId: currentUser?.id || prev.ownerId,
          price: 0,
          priceUnit: "ETH"
        };
      });
      setListingPrice("");
      setCurrentUser(readCurrentUser());

      setOrderHistory((prev) => [
        {
          id: order.id,
          nftId: nft.id,
          price: order.price,
          txHash: order.txHash,
          status: order.status,
          createdAt: new Date().toISOString(),
          buyerWallet: purchase.account,
          sellerWallet: owner?.wallet || ""
        },
        ...prev
      ]);
    } catch (err) {
      const errMessage = err.message || "购买失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      if (errMessage.includes("未登录")) {
        setTimeout(() => router.push("/auth/login"), 600);
      }
    } finally {
      setBuying(false);
    }
  };

  const handleRelist = async () => {
    if (!nft) return;
    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法上架");
      return;
    }
    if (!hasBackendLogin()) {
      setMessageType("error");
      setMessage("请先登录平台账号后再上架");
      setTimeout(() => router.push("/auth/login"), 600);
      return;
    }

    const nextPrice = Number(listingPrice);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      setMessageType("error");
      setMessage("请输入大于 0 的 ETH 价格");
      return;
    }

    setRelisting(true);
    setMessage("");

    try {
      await listNFTWithWallet({ tokenId: nft.tokenId, priceEth: nextPrice });
      const updated = await updateNFTListing(nft.id, {
        price: nextPrice,
        priceUnit: "ETH"
      });

      setNft(updated);
      setMessageType("success");
      setMessage(isListed ? "上架价格已更新" : "NFT 已重新上架");
    } catch (err) {
      setMessageType("error");
      setMessage(err.message || "上架失败，请稍后重试");
    } finally {
      setRelisting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel mx-auto w-full max-w-5xl px-6 py-10 text-sm text-soft">
        正在加载 NFT 详情...
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="glass-panel mx-auto w-full max-w-5xl px-6 py-10 text-sm text-soft">
        NFT 不存在或已下架
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="glass-panel hero-glow relative overflow-hidden p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <PrimaryMedia nft={nft} />

          <div className="flex flex-col gap-4">
            <div>
              <span className="badge">藏品详情</span>
              <h1 className="mt-3 text-4xl font-black text-white">{nft.name || "未命名 NFT"}</h1>
              <p className="mt-2 text-sm leading-7 text-soft">{nft.description || "暂无描述"}</p>
            </div>

            <div className="glass-panel p-4 text-xs text-soft">
              <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <p className="text-[11px] text-dim">Token</p>
                  <p className="mt-1 text-sm font-black text-white">{nft.tokenId || "-"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <p className="text-[11px] text-dim">分类</p>
                  <p className="mt-1 text-sm font-black text-white">{(nft.category || "other").toUpperCase()}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <p className="text-[11px] text-dim">价格</p>
                  <p className="mt-1 text-sm font-black text-white">{formatPrice(nft.price, nft.priceUnit)}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="break-all">拥有者: {owner?.wallet || "未知"}</p>
                <p className="break-all">Token URI: {nft.tokenUri || "-"}</p>
                <p className="break-all">Metadata: {nft.metadataUrl || "-"}</p>
              </div>
            </div>

            {!isOwner ? (
              <button
                onClick={handleBuy}
                disabled={buying || !canBuy}
                className="btn-primary w-full justify-center disabled:opacity-55"
              >
                {!canBuy ? "暂未上架" : buying ? "链上购买中..." : "真实购买（测试币）"}
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[12px] text-soft">{isListed ? "修改上架价格" : "该 NFT 当前未上架，输入新价格后可重新上架"}</p>
                <div className="flex items-center gap-2">
                  <input
                    className="input-neo"
                    type="number"
                    min="0"
                    step="0.00000001"
                    value={listingPrice}
                    onChange={(e) => setListingPrice(e.target.value)}
                    placeholder="输入 ETH 价格"
                  />
                  <button
                    type="button"
                    onClick={handleRelist}
                    disabled={relisting}
                    className="btn-primary shrink-0 px-4 disabled:opacity-55"
                  >
                    {relisting ? "提交中..." : isListed ? "更新价格" : "重新上架"}
                  </button>
                </div>
              </div>
            )}

            {message && <p className={`status-message ${messageType}`}>{message}</p>}
          </div>
        </div>
      </section>

      <section className="glass-panel px-5 py-4">
        <div className="mb-3 flex items-center gap-4 text-sm font-semibold">
          <span className="border-b-2 border-[#ff1f9b] pb-1 text-[#ff7bc8]">活动记录</span>
          <span className="text-soft">成交历史</span>
        </div>
        <div className="neo-divider mb-3" />

        {loadingHistory && <p className="status-message info">正在加载交易记录...</p>}
        {historyError && <p className="status-message error">{historyError}</p>}

        {!loadingHistory && !historyError && orderHistory.length === 0 ? (
          <p className="text-xs leading-6 text-soft">暂无交易记录（首发作品尚未成交）。</p>
        ) : (
          <div className="space-y-2">
            {orderHistory.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-soft">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">成交价: {formatPrice(item.price, "ETH")}</p>
                  <p>{formatTime(item.createdAt)}</p>
                </div>
                <p className="mt-1">卖家: {item.sellerName || shortHex(item.sellerWallet || "")}</p>
                <p className="mt-1">买家: {item.buyerName || shortHex(item.buyerWallet || "")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span>Tx:</span>
                  {item.txHash ? (
                    <a
                      href={`${TX_EXPLORER_BASE}${item.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#7fb2ff] underline-offset-2 hover:underline"
                    >
                      {shortHex(item.txHash, 10, 8)}
                    </a>
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
