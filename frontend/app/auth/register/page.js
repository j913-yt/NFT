"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { register, uploadAvatar } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");
    try {
      const res = await uploadAvatar(file);
      setAvatar(res.url);
      setMessageType("success");
      setMessage("头像上传成功");
    } catch (err) {
      setMessageType("error");
      setMessage(err.message || "头像上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await register(email, password, username, avatar);
      setMessageType("success");
      setMessage("注册成功，正在跳转到登录页...");
      setTimeout(() => router.push("/auth/login"), 700);
    } catch (err) {
      setMessageType("error");
      setMessage(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass-panel hero-glow relative overflow-hidden p-6">
        <div className="relative z-10">
          <span className="badge">创建账号</span>
          <h1 className="mt-3 text-3xl font-black text-white">加入 NovaNFT</h1>
          <p className="mt-2 text-xs leading-6 text-soft">
            创建账户后可绑定钱包、发布 NFT 并在市场展示。
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d6e0ff]">邮箱</label>
              <input type="email" className="input-neo" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d6e0ff]">用户名</label>
              <input className="input-neo" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d6e0ff]">头像（可选）</label>
              <input type="file" accept="image/*" className="input-neo file:mr-2 file:rounded-lg file:border-0 file:bg-[#3f7bff66] file:px-2 file:py-1 file:text-xs file:text-white" onChange={handleAvatarChange} />
              {uploading && <p className="mt-1 text-[11px] text-soft">上传中...</p>}
              {avatar && !uploading && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={avatar} alt="avatar" className="h-10 w-10 rounded-full border border-white/20 object-cover" loading="lazy" decoding="async" />
                  <span className="text-[11px] text-soft">已上传</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d6e0ff]">密码</label>
              <input type="password" className="input-neo" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-55">
              {loading ? "注册中..." : "注册"}
            </button>
          </form>

          {message && <p className={`status-message ${messageType}`}>{message}</p>}

          <p className="mt-4 text-center text-[11px] text-soft">
            已有账号？ <Link href="/auth/login" className="text-[#8fb3ff] hover:underline">直接登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
