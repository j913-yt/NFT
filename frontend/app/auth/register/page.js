"use client";

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

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const res = await uploadAvatar(file);
      setAvatar(res.url);
      setMessage("头像上传成功");
    } catch (err) {
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
      setMessage("注册成功，正在跳转到登录页...");
      setTimeout(() => {
        router.push("/auth/login");
      }, 800);
    } catch (err) {
      setMessage(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="glass-panel px-6 py-7">
        <h1 className="mb-1 text-2xl font-semibold text-slate-50">
          创建你的 NovaNFT 账号
        </h1>
        <p className="mb-5 text-xs text-slate-300">
          注册后你可以绑定钱包、创建 NFT 并在市场中展示，所有数据会在个人中心统一管理。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="mb-1 block text-xs text-slate-300">邮箱</label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300">用户名</label>
            <input
              className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="用于在市场中展示的昵称"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300">
              头像上传（可选）
            </label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-sky-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-200 hover:file:bg-sky-500/30"
              onChange={handleAvatarChange}
            />
            {uploading && (
              <p className="mt-1 text-[11px] text-slate-400">头像上传中...</p>
            )}
            {avatar && !uploading && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={avatar}
                  alt="avatar"
                  className="h-10 w-10 rounded-full border border-slate-600 object-cover"
                />
                <span className="text-[11px] text-slate-400 break-all">
                  已上传：{avatar}
                </span>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300">密码</label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="至少 6 位字符"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            {loading ? "注册中..." : "注册并继续"}
          </button>
        </form>
        {message && (
          <p className="mt-3 text-xs text-slate-200">
            {message}
          </p>
        )}
      </div>
      <p className="text-center text-[11px] text-slate-400">
        已有账号？{" "}
        <a href="/auth/login" className="text-sky-300 hover:underline">
          直接登录
        </a>
      </p>
    </div>
  );
}

