const BACKEND_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

function inferMediaType(url = "", mimeType = "") {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";

  const lowerUrl = (url || "").toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/.test(lowerUrl)) return "image";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lowerUrl)) return "audio";
  if (/\.(mp4|webm|mov|m4v|mkv)$/.test(lowerUrl)) return "video";
  return "file";
}

export function resolveAssetUrl(url = "") {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("ipfs://")) {
    const cid = url.replace("ipfs://", "");
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  if (url.startsWith("/static/")) {
    return `${BACKEND_BASE}${url}`;
  }
  return url;
}

export function getNFTMedia(nft) {
  const rawMediaUrl = nft?.mediaUrl || nft?.imageUrl || "";
  const mediaUrl = resolveAssetUrl(rawMediaUrl);

  const rawCover =
    nft?.mediaType === "image"
      ? nft?.mediaUrl || nft?.imageUrl || ""
      : nft?.imageUrl || "";
  const coverUrl = resolveAssetUrl(rawCover);

  const mediaType =
    nft?.mediaType || inferMediaType(mediaUrl, nft?.mimeType || "");

  return {
    mediaUrl,
    coverUrl,
    mediaType,
    mimeType: nft?.mimeType || ""
  };
}
