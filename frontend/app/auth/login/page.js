"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await login(email, password);
      setMessage("登录成功，正在跳转到个人中心...");
      console.log("login result", res);
      setTimeout(() => {
        router.push("/profile");
      }, 600);
    } catch (err) {
      setMessage(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="glass-panel px-6 py-7">
        <h1 className="mb-1 text-2xl font-semibold text-slate-50">欢迎回来</h1>
        <p className="mb-5 text-xs text-slate-300">
          使用你在平台注册的邮箱密码登录，登录后可进入个人中心查看和管理自己的 NFT
          藏品。
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
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        {message && (
          <p className="mt-3 text-xs text-slate-200">
            {message}
          </p>
        )}
      </div>
      <p className="text-center text-[11px] text-slate-400">
        还没有账号？{" "}
        <a href="/auth/register" className="text-sky-300 hover:underline">
          立即注册
        </a>
      </p>
    </div>
  );
}

