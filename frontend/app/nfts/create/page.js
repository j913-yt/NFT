"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createNFT, uploadNFTToIPFS } from "@/lib/api";
import {
  convertPriceToEth,
  formatEth,
  mintNFTWithWallet,
  NFT_CONTRACT_ADDRESS
} from "@/lib/web3";
import TxProgressCard from "@/components/TxProgressCard";

const MAX_MAIN_FILE_MB = 100;
const MAX_COVER_FILE_MB = 20;

const categoryOptions = [
  { value: "art", label: "艺术" },
  { value: "music", label: "音乐" },
  { value: "video", label: "视频" },
  { value: "other", label: "其他" }
];

const categoryLabelMap = {
  art: "艺术",
  music: "音乐",
  video: "视频",
  other: "其他"
};

const priceUnits = ["ETH", "WEI", "GWEI", "BNB", "MATIC", "USDT", "USDC", "USD", "CNY"];

function detectMediaType(file) {
  const type = file?.type?.toLowerCase?.() || "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return "file";
}

function getAcceptByCategory(category) {
  if (category === "music") return "audio/*";
  if (category === "video") return "video/*";
  if (category === "art") return "image/*,.gif";
  return "image/*,.gif,audio/*,video/*";
}

function validateFileByCategory(category, file) {
  const mediaType = detectMediaType(file);
  if (category === "music" && mediaType !== "audio") return "音乐分类仅支持音频文件";
  if (category === "video" && mediaType !== "video") return "视频分类仅支持视频文件";
  if (category === "art" && mediaType !== "image") return "艺术分类仅支持图片文件";
  return "";
}

function getCategoryUploadTip(category) {
  if (category === "music") return "当前分类仅支持音频";
  if (category === "video") return "当前分类仅支持视频";
  if (category === "art") return "当前分类仅支持图片（支持 GIF）";
  return "支持图片（含 GIF）、音频和视频";
}

function hasWalletLogin() {
  if (typeof window === "undefined") return false;
  const token = window.localStorage.getItem("jwt_token");
  const raw = window.localStorage.getItem("current_user");
  if (!token || !raw) return false;
  try {
    const user = JSON.parse(raw);
    return Boolean(user?.wallet);
  } catch {
    return false;
  }
}

function exceedsSizeLimit(file, maxMB) {
  return file && file.size > maxMB * 1024 * 1024;
}

function bytesToMb(size) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default function CreateNFTPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    priceUnit: "ETH",
    category: "art"
  });

  const [wallet, setWallet] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  const [walletLoggedIn, setWalletLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastSubmitFailed, setLastSubmitFailed] = useState(false);
  const [modal, setModal] = useState(null);
  const [txProgress, setTxProgress] = useState(null);

  const localMediaType = useMemo(() => detectMediaType(selectedFile), [selectedFile]);
  const acceptTypes = useMemo(() => getAcceptByCategory(form.category), [form.category]);

  const convertedPriceEth = useMemo(() => {
    return convertPriceToEth(form.price, form.priceUnit);
  }, [form.price, form.priceUnit]);

  const hasPriceInput = Number(form.price || 0) > 0;
  const hasConversionIssue = hasPriceInput && convertedPriceEth <= 0;

  const updateMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  useEffect(() => {
    setWalletLoggedIn(hasWalletLogin());
    const handleStorage = () => setWalletLoggedIn(hasWalletLogin());
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [localPreview, coverPreview]);

  useEffect(() => {
    if (!selectedFile) return;
    const err = validateFileByCategory(form.category, selectedFile);
    if (!err) return;

    if (localPreview) URL.revokeObjectURL(localPreview);
    setSelectedFile(null);
    setLocalPreview("");
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview("");
    updateMessage(err, "error");
  }, [form.category, selectedFile, localPreview, coverPreview]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const err = validateFileByCategory(form.category, file);
    if (err) {
      e.target.value = "";
      updateMessage(err, "error");
      return;
    }

    if (exceedsSizeLimit(file, MAX_MAIN_FILE_MB)) {
      e.target.value = "";
      updateMessage(`媒体文件不能超过 ${MAX_MAIN_FILE_MB}MB`, "error");
      return;
    }

    if (localPreview) URL.revokeObjectURL(localPreview);
    setSelectedFile(file);
    setLocalPreview(URL.createObjectURL(file));

    if (detectMediaType(file) === "image") {
      setCoverFile(null);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview("");
    }

    setMessage("");
    setLastSubmitFailed(false);
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      e.target.value = "";
      updateMessage("封面必须是图片格式", "error");
      return;
    }

    if (exceedsSizeLimit(file, MAX_COVER_FILE_MB)) {
      e.target.value = "";
      updateMessage(`封面文件不能超过 ${MAX_COVER_FILE_MB}MB`, "error");
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setMessage("");
    setLastSubmitFailed(false);
  };

  const checkWalletAndPrompt = () => {
    const ok = hasWalletLogin();
    setWalletLoggedIn(ok);
    if (!ok) setShowLoginModal(true);
    return ok;
  };

  const resetProgress = () => {
    setUploadProgress(0);
    setTxProgress(null);
  };

  const submitCreate = async () => {
    if (!checkWalletAndPrompt()) return;

    try {
      if (!form.name.trim()) throw new Error("请输入 NFT 名称");
      if (!selectedFile) throw new Error("请先选择媒体文件");

      const categoryErr = validateFileByCategory(form.category, selectedFile);
      if (categoryErr) throw new Error(categoryErr);

      const inputPrice = Number(form.price || 0);
      if (!Number.isFinite(inputPrice) || inputPrice < 0) {
        throw new Error("价格格式不正确");
      }

      const priceEth = convertPriceToEth(inputPrice, form.priceUnit);
      if (inputPrice > 0 && priceEth <= 0) {
        throw new Error("当前汇率配置异常，无法换算到 ETH，请检查单位和环境变量");
      }

      setLoading(true);
      setLastSubmitFailed(false);
      updateMessage("正在上传文件到 IPFS...", "info");
      setUploadProgress(0);
      setTxProgress({
        step: "ipfs",
        detail: "正在上传媒体与元数据到 IPFS...",
        txHash: "",
        error: ""
      });

      const ipfs = await uploadNFTToIPFS({
        file: selectedFile,
        cover: coverFile,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        onUploadProgress: (evt) => {
          const total = Number(evt?.total || 0);
          if (total <= 0) return;
          const percent = Math.min(100, Math.max(0, Math.round((Number(evt.loaded || 0) / total) * 100)));
          setUploadProgress(percent);
        }
      });

      setUploadProgress(100);
      setTxProgress({
        step: "wallet",
        detail: priceEth > 0 ? "IPFS 上传完成，请在钱包中确认铸造并上架交易..." : "IPFS 上传完成，请在钱包中确认铸造交易...",
        txHash: "",
        error: ""
      });

      const { account, txHash, tokenId, listedPriceEth, listedPriceWei } = await mintNFTWithWallet({
        tokenURI: ipfs.metadataUri,
        priceEth,
        onStage: (stage, hash) => {
          if (stage === "wallet") {
            setTxProgress((prev) => ({
              ...(prev || {}),
              step: "wallet",
              detail: priceEth > 0 ? "等待钱包确认（铸造 + 上架）..." : "等待钱包确认（铸造）...",
              txHash: prev?.txHash || "",
              error: ""
            }));
          } else if (stage === "chain") {
            setTxProgress((prev) => ({
              ...(prev || {}),
              step: "chain",
              detail: "交易已广播，正在等待链上打包确认...",
              txHash: hash || prev?.txHash || "",
              error: ""
            }));
          }
        }
      });

      setWallet(account);
      setTxProgress((prev) => ({
        ...(prev || {}),
        step: "sync",
        detail: "链上确认完成，正在同步后台数据...",
        txHash: txHash || prev?.txHash || "",
        error: ""
      }));

      const finalPriceEth = listedPriceEth > 0 ? listedPriceEth : 0;
      const payload = {
        contract: NFT_CONTRACT_ADDRESS,
        tokenId: tokenId || "",
        name: form.name.trim(),
        description: form.description.trim(),
        imageUrl: ipfs.imageUrl || (ipfs.mediaType === "image" ? ipfs.assetUrl : ""),
        mediaUrl: ipfs.assetUrl,
        mediaType: ipfs.mediaType,
        mimeType: ipfs.mimeType,
        tokenUri: ipfs.metadataUri,
        metadataUrl: ipfs.metadataUrl,
        storage: "ipfs",
        category: form.category,
        priceWei: listedPriceWei || "0",
        price: finalPriceEth,
        priceUnit: "ETH"
      };

      const nft = await createNFT(payload);

      setTxProgress((prev) => ({
        ...(prev || {}),
        step: "done",
        detail: `创建完成，NFT #${nft.id} 已写入市场`,
        txHash: txHash || prev?.txHash || "",
        error: ""
      }));

      setModal({
        id: nft.id,
        txHash,
        tokenId: payload.tokenId,
        metadataUri: ipfs.metadataUri,
        name: nft.name,
        ethPrice: finalPriceEth,
        sourcePrice: inputPrice,
        sourceUnit: form.priceUnit
      });
      setMessage("");
    } catch (err) {
      const errMessage = err.message || "创建 NFT 失败";
      updateMessage(errMessage, "error");
      setLastSubmitFailed(true);
      setTxProgress((prev) => ({
        ...(prev || {}),
        step: prev?.step || "ipfs",
        detail: "创建流程已中断，可修正后重试",
        txHash: prev?.txHash || "",
        error: errMessage
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitCreate();
  };

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="glass-panel p-5 sm:p-6">
        <div className="mb-5">
          <p className="badge mb-2">创建</p>
          <h1 className="text-3xl font-black text-white">创建 NFT 作品</h1>
          <p className="mt-2 text-xs leading-6 text-soft">
            价格可按任意单位输入，系统会换算为 ETH 后进行链上上架与市场展示。
          </p>
        </div>

        {!walletLoggedIn && (
          <div className="mb-4 rounded-xl border border-[#ff8f9d55] bg-[#ff8f9d1a] px-3 py-2 text-xs text-[#ffd7dc]">
            你尚未完成钱包登录，提交时会先弹出登录提示。
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#d4deff]">NFT 名称</label>
            <input
              className="input-neo"
              value={form.name}
              onChange={handleChange("name")}
              placeholder="请输入 NFT 名称"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#d4deff]">描述</label>
            <textarea
              className="input-neo min-h-28"
              value={form.description}
              onChange={handleChange("description")}
              placeholder="描述你的 NFT 创作故事"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d4deff]">分类</label>
              <select className="input-neo" value={form.category} onChange={handleChange("category")}>
                {categoryOptions.map((item) => (
                  <option key={item.value} value={item.value} style={{ color: "#0f1320", backgroundColor: "#f4f7ff" }}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-dim">{getCategoryUploadTip(form.category)}</p>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#d4deff]">价格</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input-neo"
                  value={form.price}
                  onChange={handleChange("price")}
                  placeholder="1.2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#d4deff]">单位</label>
                <select className="input-neo" value={form.priceUnit} onChange={handleChange("priceUnit")}>
                  {priceUnits.map((unit) => (
                    <option key={unit} value={unit} style={{ color: "#0f1320", backgroundColor: "#f4f7ff" }}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-[#c9d6ff]">
            {!hasPriceInput && (
              <p>
                换算后上架价: <span className="font-bold text-white">0 ETH（仅铸造不上架）</span>
              </p>
            )}
            {hasPriceInput && !hasConversionIssue && (
              <p>
                换算后上架价: <span className="font-bold text-white">{formatEth(convertedPriceEth)} ETH</span>
              </p>
            )}
            {hasPriceInput && hasConversionIssue && (
              <p className="text-[#ffd7dc]">
                当前汇率配置异常，暂无法换算到 ETH，请检查环境变量。
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#d4deff]">媒体文件</label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center">
              <span className="text-sm font-semibold text-white">上传主文件</span>
              <span className="mt-1 text-[11px] text-dim">{getCategoryUploadTip(form.category)}，限制 {MAX_MAIN_FILE_MB}MB</span>
              <input type="file" accept={acceptTypes} className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {(localMediaType === "audio" || localMediaType === "video") && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d4deff]">封面图（可选）</label>
              <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-3 text-xs text-soft">
                上传封面（图片/GIF，最大 {MAX_COVER_FILE_MB}MB）
                <input type="file" accept="image/*,.gif" className="hidden" onChange={handleCoverChange} />
              </label>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-55">
            {loading ? "处理中，请在钱包确认..." : "上传到 IPFS 并铸造"}
          </button>

          {loading && txProgress?.step === "ipfs" && (
            <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-soft">
              <div className="mb-1 flex items-center justify-between">
                <span>IPFS 上传进度</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#3f7bff] to-[#18d2ff] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {lastSubmitFailed && !loading && (
            <button
              type="button"
              className="btn-outline w-full justify-center"
              onClick={submitCreate}
            >
              重试上次创建
            </button>
          )}
        </form>

        {wallet && <p className="mt-3 break-all text-xs text-[#9eb0e5]">钱包: {wallet}</p>}
        {message && (
          <p className={`status-message ${messageType || "info"}`} aria-live="polite">
            {message}
          </p>
        )}

        {txProgress && (
          <TxProgressCard
            title="创建进度"
            steps={["ipfs", "wallet", "chain", "sync", "done"]}
            currentStep={txProgress.step}
            detail={txProgress.detail}
            txHash={txProgress.txHash}
            error={txProgress.error}
          />
        )}
      </section>

      <section className="glass-panel hero-glow relative overflow-hidden p-5 sm:p-6">
        <div className="relative z-10 mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">实时预览</h2>
          <span className="badge">{categoryLabelMap[form.category] || "其他"}</span>
        </div>

        {!selectedFile && (
          <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-[#0b1020] text-xs text-soft">
            <p>选择媒体文件后可查看预览效果</p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="rounded-full border border-white/15 px-2 py-1 text-[11px]">图片/GIF</span>
              <span className="rounded-full border border-white/15 px-2 py-1 text-[11px]">音频</span>
              <span className="rounded-full border border-white/15 px-2 py-1 text-[11px]">视频</span>
            </div>
          </div>
        )}

        {selectedFile && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black/40">
              {localMediaType === "image" && (
                <img src={localPreview} alt="preview" className="h-[420px] w-full object-cover" />
              )}

              {localMediaType === "audio" && (
                <div className="relative h-[420px]">
                  {coverPreview ? (
                    <img src={coverPreview} alt="cover" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-soft">未上传封面</div>
                  )}
                  <div className="absolute inset-0 bg-black/45" />
                  <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/50 p-2 backdrop-blur-sm">
                    <audio controls src={localPreview} className="w-full" />
                  </div>
                </div>
              )}

              {localMediaType === "video" && (
                <video controls poster={coverPreview || undefined} src={localPreview} className="h-[420px] w-full object-cover" />
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-soft">
              <p>
                名称: <span className="font-semibold text-white">{form.name || "未命名"}</span>
              </p>
              <p className="mt-1">文件: {selectedFile.name}</p>
              <p className="mt-1">输入价格: {form.price || 0} {form.priceUnit}</p>
              <p className="mt-1">链上价格: {hasConversionIssue ? "换算失败" : `${formatEth(convertedPriceEth)} ETH`}</p>
              <p className="mt-1">大小: {bytesToMb(selectedFile.size)}</p>
            </div>
          </div>
        )}
      </section>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-5">
            <h3 className="text-lg font-black text-white">请先完成钱包登录</h3>
            <p className="mt-2 text-xs leading-6 text-soft">
              创建 NFT 需要先完成钱包签名登录。请点击顶部“连接钱包”，完成后继续创建。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setShowLoginModal(false)}>
                关闭
              </button>
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => router.push("/profile")}>
                去登录
              </button>
              <button
                className="btn-primary px-3 py-1.5 text-xs"
                onClick={() => {
                  const ok = hasWalletLogin();
                  setWalletLoggedIn(ok);
                  if (ok) {
                    setShowLoginModal(false);
                    setMessage("");
                  } else {
                    updateMessage("尚未检测到钱包登录", "error");
                  }
                }}
              >
                已登录，继续
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-5">
            <h3 className="text-lg font-black text-white">NFT 创建成功</h3>
            <div className="mt-3 space-y-1 text-xs text-soft">
              <p>名称: {modal.name}</p>
              <p>ID: {modal.id}</p>
              <p>链上编号: {modal.tokenId || "待确认"}</p>
              <p>输入价格: {modal.sourcePrice || 0} {modal.sourceUnit}</p>
              <p>链上价格: {formatEth(modal.ethPrice)} ETH</p>
              <p className="break-all">元数据 URI: {modal.metadataUri}</p>
              <p className="break-all">交易哈希: {modal.txHash}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => setModal(null)}>
                继续
              </button>
              <button
                className="btn-outline px-3 py-1.5 text-xs"
                onClick={() => {
                  setModal(null);
                  resetProgress();
                }}
              >
                关闭进度
              </button>
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => router.push("/nfts")}>
                查看市场
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
