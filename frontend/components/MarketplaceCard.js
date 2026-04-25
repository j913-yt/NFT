"use client";

import Link from "next/link";
import Image from "next/image";
import { getNFTMedia } from "@/lib/media";
import { CATEGORY_LABELS, formatPrice, formatRoyaltyPercent } from "@/lib/marketplace";

function CardMedia({ nft }) {
  const { mediaType, mediaUrl, coverUrl } = getNFTMedia(nft);

  if (!mediaUrl) {
    return <div className="card-media-empty">暂无预览</div>;
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
    <Image
      src={coverUrl || mediaUrl}
      alt={nft?.name || "NFT"}
      className="card-media"
      width={520}
      height={292}
      unoptimized
    />
  );
}

function FavoriteButton({ isFavorite, onClick }) {
  return (
    <button
      type="button"
      className={`market-fav-btn ${isFavorite ? "active" : ""}`}
      onClick={onClick}
      aria-label={isFavorite ? "取消收藏" : "加入收藏"}
    >
      {isFavorite ? "已收藏" : "收藏"}
    </button>
  );
}

function CardMeta({ nft }) {
  const tokenLabel = nft?.tokenId ? `#${nft.tokenId}` : "#待上链";
  const royaltyBps = Number(nft?.royaltyFeeBps || 0);

  return (
    <div className="market-card-meta">
      <div className="flex min-w-0 flex-col gap-1">
        <span>{tokenLabel}</span>
        <span className={royaltyBps > 0 ? "text-[#9ff5ed]" : "text-dim"}>
          {royaltyBps > 0 ? `版税 ${formatRoyaltyPercent(royaltyBps)}%` : "无版税"}
        </span>
      </div>
      <strong>{formatPrice(nft?.price, nft?.priceUnit)}</strong>
    </div>
  );
}

export default function MarketplaceCard({
  nft,
  href,
  isFavorite = false,
  onToggleFavorite,
  showFavorite = false
}) {
  const targetHref = href || `/nfts/${nft?.id}`;
  const category = CATEGORY_LABELS[nft?.category] || CATEGORY_LABELS.other;
  const contractText = nft?.contract ? String(nft.contract).slice(0, 14) : "NFT Collection";

  return (
    <article className="market-card">
      <Link href={targetHref} className="market-card-link">
        <div className="market-card-media-wrap">
          <CardMedia nft={nft} />
          <div className="market-card-top">
            <span className="market-card-collection">{contractText}</span>
            <span className="market-card-badge">{category}</span>
          </div>
          <div className="market-card-bottom">
            <p className="market-card-title">{nft?.name || "未命名 NFT"}</p>
            <p className="market-card-desc">{nft?.description || "暂无描述"}</p>
          </div>
        </div>
        <CardMeta nft={nft} />
      </Link>

      {showFavorite && (
        <FavoriteButton
          isFavorite={isFavorite}
          onClick={() => onToggleFavorite?.(nft?.id)}
        />
      )}
    </article>
  );
}
