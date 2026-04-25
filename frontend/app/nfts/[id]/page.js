"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  createOrder,
  getNFTById,
  getNFTOrderHistory,
  updateNFTListing,
} from "@/lib/api";
import { getNFTMedia } from "@/lib/media";
import {
  buyNFTWithWallet,
  delistNFTWithWallet,
  formatEth,
  getRoyaltyInfoOnChain,
  listNFTWithWallet,
} from "@/lib/web3";
import TxProgressCard from "@/components/TxProgressCard";

const TX_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_TX_EXPLORER_BASE ||
  "https://sepolia.etherscan.io/tx/";

const categoryLabelMap = {
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他",
};

const formatPrice = (value, unit = "ETH") => {
  const safeUnit = unit || "ETH";
  if (!value) return `0 ${safeUnit}`;
  const num = Number(value);
  if (!isFinite(num) || num === 0) return `0 ${safeUnit}`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  const normalized = num.toFixed(8).replace(/\.?0+$/, "");
  return `${normalized} ${safeUnit}`;
};

const formatRoyaltyPercent = (bps) => {
  const n = Number(bps || 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return (n / 100).toFixed(2).replace(/\.?0+$/, "");
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
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function hasWalletLogin() {
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

function hasPositiveWei(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^0+/, "");
  return normalized !== "";
}

function PrimaryMedia({ nft }) {
  const { mediaType, mediaUrl, coverUrl } = getNFTMedia(nft);
  const mediaFrameClass =
    "relative h-[360px] w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0d1120] sm:h-[420px]";

  if (!mediaUrl) {
    return (
      <div
        className={`${mediaFrameClass} flex items-center justify-center bg-black/40 text-xs text-soft`}
      >
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
        className={`${mediaFrameClass} object-contain bg-black/55`}
      />
    );
  }

  if (mediaType === "audio") {
    return (
      <div className={mediaFrameClass}>
        {(coverUrl || mediaUrl) && (
          <img
            src={coverUrl || mediaUrl}
            alt={`${nft.name || "音频"} 封面`}
            className="absolute inset-0 h-full w-full object-contain opacity-90"
            loading="eager"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-black/45 p-3 backdrop-blur-sm">
          <audio
            controls
            src={mediaUrl}
            className="w-full"
            preload="metadata"
          />
        </div>
      </div>
    );
  }

  return (
    <img
      src={coverUrl || mediaUrl}
      alt={nft.name}
      className={`${mediaFrameClass} object-contain bg-[#0b1020]`}
      loading="eager"
      decoding="async"
    />
  );
}

export default function NFTDetailPage() {
  const params = useParams();
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
  const [delisting, setDelisting] = useState(false);
  const [listingPrice, setListingPrice] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [tradeProgress, setTradeProgress] = useState(null);
  const [royaltyInfo, setRoyaltyInfo] = useState(null);

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

  useEffect(() => {
    if (!nft?.tokenId) {
      setRoyaltyInfo(null);
      return;
    }

    let active = true;
    const loadRoyalty = async () => {
      try {
        const chainInfo = await getRoyaltyInfoOnChain({
          tokenId: nft.tokenId,
          salePriceWei: nft.priceWei || "",
          salePriceEth: Number(nft.price || 0),
        });
        if (!active) return;
        setRoyaltyInfo(chainInfo);
      } catch {
        if (!active) return;
        const fallbackFeeBps = Number(nft.royaltyFeeBps || 0);
        const fallbackPrice = Number(nft.price || 0);
        const fallbackRoyalty =
          fallbackFeeBps > 0 ? (fallbackPrice * fallbackFeeBps) / 10000 : 0;
        setRoyaltyInfo({
          receiver: nft.royaltyReceiver || "",
          feeBps: fallbackFeeBps,
          royaltyEth: fallbackRoyalty,
          sellerReceiveEth: Math.max(fallbackPrice - fallbackRoyalty, 0),
        });
      }
    };

    loadRoyalty();
    return () => {
      active = false;
    };
  }, [nft]);

  const isOwner = useMemo(() => {
    if (!currentUser?.id || !nft?.ownerId) return false;
    return Number(currentUser.id) === Number(nft.ownerId);
  }, [currentUser, nft]);

  const royaltyFeeBps = Number(royaltyInfo?.feeBps ?? nft?.royaltyFeeBps ?? 0);
  const royaltyPercent = formatRoyaltyPercent(royaltyFeeBps);
  const royaltyReceiver = royaltyInfo?.receiver || nft?.royaltyReceiver || "";
  const royaltyAmountEth = Number(
    royaltyInfo?.royaltyEth ??
      (Number(nft?.price || 0) * royaltyFeeBps) / 10000,
  );
  const sellerReceiveEth = Number(
    royaltyInfo?.sellerReceiveEth ??
      Math.max(Number(nft?.price || 0) - royaltyAmountEth, 0),
  );

  const isListed = hasPositiveWei(nft?.priceWei);
  const canBuy = !isOwner && isListed;

  const handleBuy = async () => {
    if (!nft) return;

    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法购买");
      return;
    }

    if (!hasWalletLogin()) {
      setMessageType("error");
      setMessage("请先连接钱包并完成登录后再购买");
      return;
    }

    setBuying(true);
    setMessage("");
    setTradeProgress({
      step: "wallet",
      detail: "请在钱包中确认购买交易...",
      txHash: "",
      error: "",
      flow: "buy",
    });

    try {
      const purchase = await buyNFTWithWallet({
        tokenId: nft.tokenId,
        fallbackPriceWei: nft.priceWei || "0",
        fallbackPriceEth: Number(nft.price || 0),
        onStage: (stage, txHash) => {
          if (stage === "wallet") {
            setTradeProgress((prev) => ({
              ...(prev || {}),
              step: "wallet",
              detail: "请在钱包中确认购买交易...",
              txHash: prev?.txHash || "",
              error: "",
            }));
          } else if (stage === "chain") {
            setTradeProgress((prev) => ({
              ...(prev || {}),
              step: "chain",
              detail: "交易已广播，等待链上打包确认...",
              txHash: txHash || prev?.txHash || "",
              error: "",
            }));
          }
        },
      });

      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: "sync",
        detail: "链上确认完成，正在写入订单记录...",
        txHash: purchase.txHash || prev?.txHash || "",
        error: "",
      }));

      const order = await createOrder({
        nftId: nft.id,
        priceWei: purchase.priceWei,
        price: purchase.priceEth,
        txHash: purchase.txHash,
      });

      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: "done",
        detail: `购买完成，订单 #${order.id} 已创建`,
        txHash: purchase.txHash || prev?.txHash || "",
        error: "",
      }));

      setMessageType("success");
      const royaltyText =
        royaltyFeeBps > 0
          ? `，本次交易版税约 ${formatEth(royaltyAmountEth)} ETH`
          : "";
      setMessage(`购买成功，订单号 #${order.id}${royaltyText}`);

      setOwner((prev) => ({ ...prev, wallet: purchase.account }));
      setNft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ownerId: currentUser?.id || prev.ownerId,
          priceWei: "0",
          price: 0,
          priceUnit: "ETH",
        };
      });
      setListingPrice("");
      setCurrentUser(readCurrentUser());

      setOrderHistory((prev) => [
        {
          id: order.id,
          nftId: nft.id,
          priceWei: order.priceWei,
          price: order.price,
          txHash: order.txHash,
          status: order.status,
          createdAt: new Date().toISOString(),
          buyerWallet: purchase.account,
          sellerWallet: owner?.wallet || "",
        },
        ...prev,
      ]);
    } catch (err) {
      const errMessage = err.message || "购买失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: prev?.step || "wallet",
        detail: "购买流程已中断",
        txHash: prev?.txHash || "",
        error: errMessage,
      }));
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
    if (!hasWalletLogin()) {
      setMessageType("error");
      setMessage("请先连接钱包并完成登录后再上架");
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
    setTradeProgress({
      step: "wallet",
      detail: "请在钱包中确认上架交易...",
      txHash: "",
      error: "",
      flow: "list",
    });

    try {
      const listed = await listNFTWithWallet({
        tokenId: nft.tokenId,
        priceEth: nextPrice,
        onStage: (stage, txHash) => {
          if (stage === "wallet") {
            setTradeProgress((prev) => ({
              ...(prev || {}),
              step: "wallet",
              detail: "请在钱包中确认上架交易...",
              txHash: prev?.txHash || "",
              error: "",
            }));
          } else if (stage === "chain") {
            setTradeProgress((prev) => ({
              ...(prev || {}),
              step: "chain",
              detail: "交易已广播，等待链上打包确认...",
              txHash: txHash || prev?.txHash || "",
              error: "",
            }));
          }
        },
      });

      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: "sync",
        detail: "链上确认完成，正在同步后台上架状态...",
        txHash: listed?.txHash || prev?.txHash || "",
        error: "",
      }));

      const updated = await updateNFTListing(nft.id, {
        priceWei: listed.priceWei,
        price: nextPrice,
        priceUnit: "ETH",
      });

      setNft(updated);
      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: "done",
        detail: isListed ? "上架价格已更新" : "NFT 已重新上架",
        txHash: listed?.txHash || prev?.txHash || "",
        error: "",
      }));
      setMessageType("success");
      setMessage(isListed ? "上架价格已更新" : "NFT 已重新上架");
    } catch (err) {
      const errMessage = err.message || "上架失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: prev?.step || "wallet",
        detail: "上架流程已中断",
        txHash: prev?.txHash || "",
        error: errMessage,
      }));
    } finally {
      setRelisting(false);
    }
  };

  const handleDelist = async () => {
    if (!nft) return;
    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法下架");
      return;
    }
    if (!hasWalletLogin()) {
      setMessageType("error");
      setMessage("请先连接钱包并完成登录后再下架");
      return;
    }
    if (!isListed) {
      setMessageType("error");
      setMessage("该 NFT 当前未上架");
      return;
    }

    setDelisting(true);
    setMessage("");
    setTradeProgress({
      step: "wallet",
      detail: "请在钱包中确认下架交易...",
      txHash: "",
      error: "",
      flow: "delist",
    });

    try {
      const delisted = await delistNFTWithWallet({
        tokenId: nft.tokenId,
        onStage: (stage, txHash) => {
          if (stage === "wallet") {
            setTradeProgress((prev) => ({
              ...(prev || {}),
              step: "wallet",
              detail: "请在钱包中确认下架交易...",
              txHash: prev?.txHash || "",
              error: "",
            }));
          } else if (stage === "chain") {
            setTradeProgress((prev) => ({
              ...(prev || {}),
              step: "chain",
              detail: "交易已广播，等待链上打包确认...",
              txHash: txHash || prev?.txHash || "",
              error: "",
            }));
          }
        },
      });

      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: "sync",
        detail: "链上确认完成，正在同步后台下架状态...",
        txHash: delisted?.txHash || prev?.txHash || "",
        error: "",
      }));

      const updated = await updateNFTListing(nft.id, {
        priceWei: "0",
        price: 0,
        priceUnit: "ETH",
      });

      setNft(updated);
      setListingPrice("");
      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: "done",
        detail: "NFT 已下架",
        txHash: delisted?.txHash || prev?.txHash || "",
        error: "",
      }));
      setMessageType("success");
      setMessage("NFT 已下架");
    } catch (err) {
      const errMessage = err.message || "下架失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      setTradeProgress((prev) => ({
        ...(prev || {}),
        step: prev?.step || "wallet",
        detail: "下架流程已中断",
        txHash: prev?.txHash || "",
        error: errMessage,
      }));
    } finally {
      setDelisting(false);
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
              <h1 className="mt-3 text-4xl font-black text-white">
                {nft.name || "未命名 NFT"}
              </h1>
              <p className="mt-2 text-sm leading-7 text-soft">
                {nft.description || "暂无描述"}
              </p>
            </div>

            <div className="glass-panel p-4 text-xs text-soft">
              <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <p className="text-[11px] text-dim">链上编号</p>
                  <p className="mt-1 text-sm font-black text-white">
                    {nft.tokenId || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <p className="text-[11px] text-dim">分类</p>
                  <p className="mt-1 text-sm font-black text-white">
                    {categoryLabelMap[nft.category] || "其他"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
                  <p className="text-[11px] text-dim">价格</p>
                  <p className="mt-1 text-sm font-black text-white">
                    {formatPrice(nft.price, nft.priceUnit)}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="break-all">拥有者: {owner?.wallet || "未知"}</p>
                <p className="break-all">链上 URI: {nft.tokenUri || "-"}</p>
                <p className="break-all">
                  元数据地址: {nft.metadataUrl || "-"}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-[#78a8ff44] bg-[linear-gradient(120deg,rgba(78,130,255,0.14),rgba(14,24,40,0.8))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#9eb8eb]">
                    Royalty
                  </p>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {royaltyPercent}%
                  </span>
                </div>
                {royaltyFeeBps > 0 ? (
                  <div className="mt-2 space-y-1 text-[11px] text-[#cbd8f8]">
                    <p className="break-all">
                      版税接收:{" "}
                      <span className="text-white">
                        {royaltyReceiver || "-"}
                      </span>
                    </p>
                    <p>
                      按当前价格预计版税:{" "}
                      <span className="font-semibold text-white">
                        {formatEth(royaltyAmountEth)} ETH
                      </span>
                    </p>
                    <p>
                      卖家实收预计:{" "}
                      <span className="font-semibold text-white">
                        {formatEth(sellerReceiveEth)} ETH
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-[#b5c7f1]">
                    当前作品未启用版税
                  </p>
                )}
              </div>
            </div>

            {!isOwner ? (
              <button
                onClick={handleBuy}
                disabled={buying || !canBuy}
                className="btn-primary w-full justify-center disabled:opacity-55"
              >
                {!canBuy
                  ? "暂未上架"
                  : buying
                    ? "链上购买中..."
                    : "真实购买（测试币）"}
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[12px] text-soft">
                  {isListed
                    ? "修改上架价格"
                    : "该 NFT 当前未上架，输入新价格后可重新上架"}
                </p>
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
                    disabled={relisting || delisting}
                    className="btn-primary shrink-0 px-4 disabled:opacity-55"
                  >
                    {relisting
                      ? "提交中..."
                      : isListed
                        ? "更新价格"
                        : "重新上架"}
                  </button>
                  {isListed && (
                    <button
                      type="button"
                      onClick={handleDelist}
                      disabled={relisting || delisting}
                      className="btn-outline shrink-0 px-4 disabled:opacity-55"
                    >
                      {delisting ? "下架中..." : "下架"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {tradeProgress && (
              <TxProgressCard
                title={
                  tradeProgress.flow === "list"
                    ? "上架进度"
                    : tradeProgress.flow === "delist"
                      ? "下架进度"
                      : "购买进度"
                }
                steps={["wallet", "chain", "sync", "done"]}
                currentStep={tradeProgress.step}
                detail={tradeProgress.detail}
                txHash={tradeProgress.txHash}
                error={tradeProgress.error}
              />
            )}

            {message && (
              <p className={`status-message ${messageType}`}>{message}</p>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel px-5 py-4">
        <div className="mb-3 flex items-center gap-4 text-sm font-semibold">
          <span className="border-b-2 border-[#ff1f9b] pb-1 text-[#ff7bc8]">
            活动记录
          </span>
          <span className="text-soft">成交历史</span>
        </div>
        <div className="neo-divider mb-3" />

        {loadingHistory && (
          <p className="status-message info">正在加载交易记录...</p>
        )}
        {historyError && <p className="status-message error">{historyError}</p>}

        {!loadingHistory && !historyError && orderHistory.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-xs text-soft">
            <p>暂无交易记录（首发作品尚未成交）。</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Link href="/nfts" className="btn-outline px-3 py-1.5 text-xs">
                去市场浏览
              </Link>
              <Link
                href="/nfts/create"
                className="btn-primary px-3 py-1.5 text-xs"
              >
                去创建 NFT
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {orderHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-soft"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">
                    成交价: {formatPrice(item.price, "ETH")}
                  </p>
                  <p>{formatTime(item.createdAt)}</p>
                </div>
                <p className="mt-1">
                  卖家: {item.sellerName || shortHex(item.sellerWallet || "")}
                </p>
                <p className="mt-1">
                  买家: {item.buyerName || shortHex(item.buyerWallet || "")}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span>交易:</span>
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
