import { getNFTMedia } from "@/lib/media";

export default function PrimaryMedia({ nft }) {
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
          <audio controls src={mediaUrl} className="w-full" preload="metadata" />
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
