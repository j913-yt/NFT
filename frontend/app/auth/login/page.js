"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await login(email, password);
      setMessageType("success");
      setMessage("登录成功，正在跳转...");
      setTimeout(() => router.push("/profile"), 450);
    } catch (err) {
      setMessageType("error");
      setMessage(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass-panel hero-glow relative overflow-hidden p-6">
        <div className="relative z-10">
          <span className="badge">账号登录</span>
          <h1 className="mt-3 text-3xl font-black text-white">欢迎登录</h1>
          <p className="mt-2 text-xs leading-6 text-soft">
            登录后即可管理 NFT 资产并发起创建流程。
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d6e0ff]">邮箱</label>
              <input
                type="email"
                className="input-neo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#d6e0ff]">密码</label>
              <input
                type="password"
                className="input-neo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="至少 6 位"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-55">
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          {message && <p className={`status-message ${messageType}`}>{message}</p>}

          <p className="mt-4 text-center text-[11px] text-soft">
            还没有账号？ <Link href="/auth/register" className="text-[#8fb3ff] hover:underline">立即注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
