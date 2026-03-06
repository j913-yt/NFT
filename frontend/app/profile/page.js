"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyBoughtOrders, getMySoldOrders, getNFTs, updateProfile } from "@/lib/api";
import { getNFTMedia, resolveAssetUrl } from "@/lib/media";

const formatPrice = (value, unit = "ETH") => {
  const safeUnit = unit || "ETH";
  if (!value) return `未上架 (${safeUnit})`;
  const num = Number(value);
  if (!isFinite(num) || num === 0) return `未上架 (${safeUnit})`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  return `${parseFloat(num.toFixed(8)).toString()} ${safeUnit}`;
};

const shortWallet = (wallet) => {
  if (!wallet) return "未知地址";
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
};

const formatOrderTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function ProfileMedia({ nft }) {
  const { mediaType, mediaUrl, coverUrl } = getNFTMedia(nft);

  if (!mediaUrl) {
    return <div className="mb-2 flex h-28 items-center justify-center rounded-lg bg-[#0b1020] text-[11px] text-soft">暂无预览</div>;
  }

  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        poster={coverUrl || undefined}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        className="mb-2 h-28 w-full rounded-lg object-cover"
      />
    );
  }

  if (mediaType === "audio") {
    return (
      <div className="relative mb-2 overflow-hidden rounded-lg bg-[#0b1020] p-2">
        {coverUrl && <img src={coverUrl} alt="cover" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 rounded-md bg-black/45 p-1.5 backdrop-blur-sm">
          <audio controls src={mediaUrl} className="w-full" preload="metadata" />
        </div>
      </div>
    );
  }

  return <img src={mediaUrl} alt={nft.name} className="mb-2 h-28 w-full rounded-lg object-cover" loading="lazy" decoding="async" />;
}

function OrderMedia({ order }) {
  const nft = {
    imageUrl: order.nftImageUrl,
    mediaUrl: order.nftMediaUrl || order.nftImageUrl,
    mediaType: order.nftMediaType || "image"
  };
  return <ProfileMedia nft={nft} />;
}

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [soldOrders, setSoldOrders] = useState([]);
  const [boughtOrders, setBoughtOrders] = useState([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [loadingSold, setLoadingSold] = useState(false);
  const [loadingBought, setLoadingBought] = useState(false);
  const [listError, setListError] = useState("");
  const [soldError, setSoldError] = useState("");
  const [boughtError, setBoughtError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("current_user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          setUser(u);
          setNewName(u.username || "");
        } catch {
          setUser(null);
        }
      }
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setNfts([]);
        setSoldOrders([]);
        setBoughtOrders([]);
        return;
      }

      try {
        setLoadingNfts(true);
        setLoadingSold(true);
        setLoadingBought(true);
        setListError("");
        setSoldError("");
        setBoughtError("");

        const [list, sold, bought] = await Promise.all([getNFTs(), getMySoldOrders(), getMyBoughtOrders()]);
        setNfts((list || []).filter((n) => n.ownerId === user.id));
        setSoldOrders(sold || []);
        setBoughtOrders(bought || []);
      } catch (err) {
        const msg = err.message || "加载数据失败";
        setListError(msg);
        setSoldError(msg);
        setBoughtError(msg);
      } finally {
        setLoadingNfts(false);
        setLoadingSold(false);
        setLoadingBought(false);
      }
    };

    fetchData();
  }, [user]);

  if (!user) {
    return (
      <div className="glass-panel mx-auto w-full max-w-lg px-6 py-8 text-sm text-soft">
        请先登录后查看个人中心。
      </div>
    );
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="glass-panel hero-glow relative overflow-hidden p-5">
        <div className="relative z-10">
          {user.avatar ? (
            <img src={resolveAssetUrl(user.avatar)} alt={user.username} className="h-20 w-20 rounded-2xl border border-white/20 object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-xl font-black text-white">
              {user.username?.[0]?.toUpperCase() || "U"}
            </div>
          )}

          <h1 className="mt-4 text-2xl font-black text-white">{user.username}</h1>
          <p className="mt-1 text-xs text-soft">{user.email || "未绑定邮箱"}</p>
          {user.wallet && <p className="mt-2 break-all text-[11px] text-[#a6b6e8]">钱包地址: {user.wallet}</p>}

          <div className="mt-5">
            {editing ? (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-[#d6e0ff]">新用户名</label>
                <input className="input-neo" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    className="btn-primary px-3 py-1.5 text-xs"
                    onClick={async () => {
                      if (!newName.trim()) return;
                      setSaving(true);
                      try {
                        await updateProfile({ username: newName.trim() });
                        const updated = { ...user, username: newName.trim() };
                        setUser(updated);
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem("current_user", JSON.stringify(updated));
                        }
                        setEditing(false);
                      } catch (err) {
                        alert(err.message || "更新失败");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    className="btn-outline px-3 py-1.5 text-xs"
                    onClick={() => {
                      setNewName(user.username || "");
                      setEditing(false);
                    }}
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
                修改用户名
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel space-y-6 p-5">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">我的 NFT</h2>
            <span className="badge">{nfts.length} 件</span>
          </div>

          {loadingNfts && <p className="status-message info">正在同步你的 NFT 列表...</p>}
          {listError && <p className="status-message error">{listError}</p>}

          {!loadingNfts && !listError && nfts.length === 0 ? (
            <p className="text-xs text-soft">你还没有持有 NFT。</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {nfts.map((nft) => (
                <Link key={nft.id} href={`/nfts/${nft.id}`} className="block">
                  <div className="card-hover overflow-hidden rounded-xl border border-white/15 bg-[#0b1020] p-3 text-xs">
                    <ProfileMedia nft={nft} />
                    <p className="truncate text-sm font-bold text-white">{nft.name || "未命名"}</p>
                    <p className="line-clamp-2 mt-1 text-[11px] text-soft">{nft.description || "暂无描述"}</p>
                    <p className="mt-1 text-[11px] text-[#9db1ea]">分类: {(nft.category || "other").toUpperCase()}</p>
                    <p className="mt-1 text-[11px] text-[#9db1ea]">{formatPrice(nft.price, nft.priceUnit)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">已购入</h2>
            <span className="badge">{boughtOrders.length} 笔</span>
          </div>

          {loadingBought && <p className="status-message info">正在加载已购入订单...</p>}
          {boughtError && <p className="status-message error">{boughtError}</p>}

          {!loadingBought && !boughtError && boughtOrders.length === 0 ? (
            <p className="text-xs text-soft">你还没有买入记录。</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {boughtOrders.map((order) => (
                <Link key={order.id} href={`/nfts/${order.nftId}`} className="block" title="查看 NFT 详情">
                  <div className="card-hover rounded-xl border border-white/15 bg-[#0b1020] p-3 text-xs">
                    <OrderMedia order={order} />
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-white">{order.nftName || `NFT #${order.nftId}`}</p>
                      <p className="text-[11px] text-[#9db1ea]">{formatPrice(order.price, "ETH")}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-soft">卖家: {order.sellerName || shortWallet(order.sellerWallet)}</p>
                    <p className="mt-1 text-[11px] text-soft">成交时间: {formatOrderTime(order.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">已售出</h2>
            <span className="badge">{soldOrders.length} 笔</span>
          </div>

          {loadingSold && <p className="status-message info">正在加载已售出订单...</p>}
          {soldError && <p className="status-message error">{soldError}</p>}

          {!loadingSold && !soldError && soldOrders.length === 0 ? (
            <p className="text-xs text-soft">你还没有售出记录。</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {soldOrders.map((order) => (
                <Link key={order.id} href={`/nfts/${order.nftId}`} className="block" title="查看 NFT 详情">
                  <div className="card-hover rounded-xl border border-white/15 bg-[#0b1020] p-3 text-xs">
                    <OrderMedia order={order} />
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-white">{order.nftName || `NFT #${order.nftId}`}</p>
                      <p className="text-[11px] text-[#9db1ea]">{formatPrice(order.price, "ETH")}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-soft">买家: {order.buyerName || shortWallet(order.buyerWallet)}</p>
                    <p className="mt-1 text-[11px] text-soft">成交时间: {formatOrderTime(order.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
