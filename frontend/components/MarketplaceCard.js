"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const linkRef = useRef(null);
  const navTimerRef = useRef(null);
  const category = categoryLabelMap[nft?.category] || categoryLabelMap.other;
  const targetHref = href || `/nfts/${nft?.id}`;
  const tokenLabel = nft?.tokenId ? `#${nft.tokenId}` : "#待上链";

  useEffect(() => {
    return () => {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
      }
    };
  }, []);

  const spawnRipple = (clientX, clientY) => {
    const el = linkRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.35;
    const ripple = document.createElement("span");
    ripple.className = "market-card-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;

    const hasPoint = Number.isFinite(clientX) && Number.isFinite(clientY);
    const left = hasPoint ? clientX - rect.left - size / 2 : rect.width / 2 - size / 2;
    const top = hasPoint ? clientY - rect.top - size / 2 : rect.height / 2 - size / 2;
    ripple.style.left = `${left}px`;
    ripple.style.top = `${top}px`;

    el.appendChild(ripple);
    ripple.addEventListener(
      "animationend",
      () => {
        ripple.remove();
      },
      { once: true }
    );
  };

  const shouldDelayNavigation = (event) => {
    if (event.defaultPrevented) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (event.button !== 0) return false;
    const target = event.currentTarget.getAttribute("target");
    return !target || target === "_self";
  };

  const prefersReducedMotion = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (prefersReducedMotion()) return;
    spawnRipple(event.clientX, event.clientY);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (prefersReducedMotion()) return;
    spawnRipple(Number.NaN, Number.NaN);
  };

  const handleCardClick = (event) => {
    if (!shouldDelayNavigation(event)) return;
    if (!targetHref) return;
    if (prefersReducedMotion()) return;

    event.preventDefault();
    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
    }

    navTimerRef.current = setTimeout(() => {
      router.push(targetHref);
    }, 230);
  };

  const contractText = nft?.contract ? String(nft.contract).slice(0, 14) : "NFT Collection";

  return (
    <Link
      ref={linkRef}
      href={targetHref}
      className="market-card card-hover"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onClick={handleCardClick}
    >
      <div className="market-card-media-wrap">
        <CardMedia nft={nft} />

        <div className="market-card-top">
          <span className="market-card-collection">{contractText}</span>
          <span className="market-card-badge">{category}</span>
        </div>

        {showFavorite && (
          <button
            type="button"
            className={`market-fav-btn ${isFavorite ? "active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite?.(nft?.id);
            }}
            aria-label={isFavorite ? "取消收藏" : "加入收藏"}
          >
            {isFavorite ? "已收藏" : "收藏"}
          </button>
        )}

        <div className="market-card-bottom">
          <p className="market-card-title">{nft?.name || "未命名 NFT"}</p>
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
