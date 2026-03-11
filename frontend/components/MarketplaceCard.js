"use client";

import Link from "next/link";
import { getNFTMedia } from "@/lib/media";

const categoryLabelMap = {
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他"
};

function formatPrice(value, unit = "ETH") {
  const safeUnit = unit || "ETH";
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return `未上架 (${safeUnit})`;
  if (num < 0.00000001) return `< 0.00000001 ${safeUnit}`;
  return `${num.toFixed(8).replace(/\.?0+$/, "")} ${safeUnit}`;
}

function CardMedia({ nft }) {
  const { mediaType, mediaUrl, coverUrl } = getNFTMedia(nft);

  if (!mediaUrl) {
    return (
      <div className="card-media-empty">
        <span>暂无预览</span>
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        src={mediaUrl}
        poster={coverUrl || undefined}
        className="card-media"
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <img
      src={coverUrl || mediaUrl}
      alt={nft?.name || "NFT"}
      className="card-media"
      loading="lazy"
      decoding="async"
    />
  );
}

export default function MarketplaceCard({
  nft,
  href,
  isFavorite = false,
  onToggleFavorite,
  showFavorite = false
}) {
  const category = categoryLabelMap[nft?.category] || categoryLabelMap.other;
  const tokenLabel = nft?.tokenId ? `#${nft.tokenId}` : "#待上链";

  return (
    <Link href={href || `/nfts/${nft?.id}`} className="market-card card-hover">
      <div className="market-card-media-wrap">
        <CardMedia nft={nft} />

        <div className="market-card-top">
          <span className="market-card-collection">
            {nft?.contract ? String(nft.contract).slice(0, 14) : "NFT 合集"}
          </span>
          <span className="market-card-badge">{category}</span>
        </div>

        {showFavorite && (
          <button
            type="button"
            className={`market-fav-btn ${isFavorite ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite?.(nft?.id);
            }}
            aria-label={isFavorite ? "取消收藏" : "收藏"}
          >
            {isFavorite ? "已收藏" : "收藏"}
          </button>
        )}

        <div className="market-card-bottom">
          <p className="market-card-title">{nft?.name || "未命名"}</p>
          <p className="market-card-desc">{nft?.description || "暂无描述"}</p>
        </div>
      </div>

      <div className="market-card-meta">
        <span>{tokenLabel}</span>
        <strong>{formatPrice(nft?.price, nft?.priceUnit)}</strong>
      </div>
    </Link>
  );
}
