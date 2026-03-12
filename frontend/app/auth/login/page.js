"use client";

import Link from "next/link";
import WalletConnectButton from "@/components/WalletConnectButton";

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass-panel hero-glow relative overflow-hidden p-6">
        <div className="relative z-10">
          <span className="badge">钱包登录</span>
          <h1 className="mt-3 text-3xl font-black text-white">使用钱包进入平台</h1>
          <p className="mt-2 text-xs leading-6 text-soft">
            邮箱注册和邮箱登录已经下线，现在仅支持通过钱包连接和签名来完成身份验证。
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-soft">
            <p className="font-semibold text-white">登录步骤</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs leading-6 text-[#d6e0ff]">
              <li>选择浏览器中的钱包插件</li>
              <li>授权连接当前钱包地址</li>
              <li>确认签名，系统会自动完成登录</li>
            </ol>
          </div>

          <div className="mt-5 flex justify-center">
            <WalletConnectButton />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-soft">
            <Link href="/" className="text-[#8fb3ff] hover:underline">
              返回首页
            </Link>
            <Link href="/nfts" className="text-[#8fb3ff] hover:underline">
              浏览市场
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
