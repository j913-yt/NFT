 "use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNFT, uploadAvatar } from "@/lib/api";
import { mintNFTWithWallet, NFT_CONTRACT_ADDRESS } from "@/lib/web3";

export default function CreateNFTPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    price: "",
    category: "art"
  });
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState(null);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    try {
      const res = await uploadAvatar(file); // 复用上传接口，实际可拆分为专用 NFT 上传
      setForm((prev) => ({ ...prev, imageUrl: res.url }));
      setMessage("图片上传成功");
    } catch (err) {
      setMessage(err.message || "图片上传失败");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (!form.name) {
        throw new Error("名称不能为空");
      }

      setMinting(true);

      // 如果用户确实没有成功上传图片，给一个占位图，避免直接报错卡住流程
      const imageUrl =
        form.imageUrl ||
        "https://via.placeholder.com/600x400.png?text=NovaNFT+Placeholder";

      // 标准流程：先链上 mint，再把结果写入后端
      const tokenURI = imageUrl; // 简化：用图片地址充当 metadata URI，真实项目可指向 IPFS JSON
      const { account, txHash, tokenId } = await mintNFTWithWallet({
        tokenURI
      });
      setWallet(account);

      const payload = {
        contract: NFT_CONTRACT_ADDRESS,
        tokenId: tokenId || "",
        name: form.name,
        description: form.description,
        imageUrl,
        tokenUri: tokenURI,
        category: form.category,
        price: parseFloat(form.price) || 0
      };

      const nft = await createNFT(payload);
      setModal({
        id: nft.id,
        txHash,
        name: nft.name
      });
    } catch (err) {
      setMessage(err.message || "创建失败");
    } finally {
      setMinting(false);
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel mx-auto max-w-lg px-6 py-6">
      <h1 className="mb-2 text-xl font-semibold text-slate-50">
        创建 NFT（钱包签名 + 链上 mint）
      </h1>
      {wallet && (
        <p className="mb-3 break-all text-xs text-slate-300">
          当前钱包地址：{wallet}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div>
          <label className="block mb-1 text-xs text-slate-300">名称</label>
          <input
            className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
            value={form.name}
            onChange={handleChange("name")}
            required
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-slate-300">描述</label>
          <textarea
            className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
            rows={3}
            value={form.description}
            onChange={handleChange("description")}
          />
        </div>
        <div>
          <label className="block mb-1 text-xs text-slate-300">类别</label>
          <select
            className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none focus:border-sky-400"
            value={form.category}
            onChange={handleChange("category")}
          >
            <option value="art">艺术 Art</option>
            <option value="music">音乐 Music</option>
            <option value="video">视频 Video</option>
            <option value="game">游戏 Game</option>
            <option value="other">其他 Other</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 text-xs text-slate-300">NFT 图片</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-200 hover:file:bg-sky-500/30"
            onChange={handleImageUpload}
          />
          {form.imageUrl && (
            <img
              src={form.imageUrl}
              alt="preview"
              className="mt-2 h-40 w-full rounded-xl border border-slate-700 object-cover"
            />
          )}
        </div>
        <div>
          <label className="block mb-1 text-xs text-slate-300">
            价格（例如 ETH 单位，前端展示用）
          </label>
          <input
            type="number"
            step="0.0001"
            className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
            value={form.price}
            onChange={handleChange("price")}
          />
        </div>
        <button
          type="submit"
          disabled={loading || minting}
          className="btn-primary w-full justify-center disabled:opacity-60"
        >
          {loading || minting ? "创建中（请在钱包中确认交易）..." : "连接钱包并创建 NFT"}
        </button>
      </form>
      {message && !modal && (
        <p className="mt-3 text-xs text-slate-200">{message}</p>
      )}

      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <div className="glass-panel max-w-sm px-6 py-5 text-xs text-slate-100">
            <h2 className="mb-2 text-sm font-semibold">NFT 创建成功</h2>
            <p className="mb-1">
              名称：<span className="font-medium">{modal.name}</span>
            </p>
            <p className="mb-1">ID：{modal.id}</p>
            <p className="mb-3 break-all">
              交易哈希：{modal.txHash || "（本地示例，未记录）"}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline px-3 py-1.5"
                onClick={() => setModal(null)}
              >
                再创建一件
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5"
                onClick={() => router.push("/profile")}
              >
                去我的藏品看看
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

