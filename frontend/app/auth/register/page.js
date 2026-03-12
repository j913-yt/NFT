"use client";

import Link from "next/link";
import WalletConnectButton from "@/components/WalletConnectButton";

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glass-panel hero-glow relative overflow-hidden p-6">
        <div className="relative z-10">
          <span className="badge">钱包入驻</span>
          <h1 className="mt-3 text-3xl font-black text-white">首次使用直接连接钱包</h1>
          <p className="mt-2 text-xs leading-6 text-soft">
            平台已经切换为钱包身份体系。第一次连接钱包时，系统会自动为当前地址创建账户并完成登录。
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-soft">
            <p className="font-semibold text-white">首次接入会自动完成</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-xs leading-6 text-[#d6e0ff]">
              <li>校验钱包地址格式</li>
              <li>生成一次性 nonce</li>
              <li>完成签名验证并创建会话</li>
              <li>后续可在个人中心补充用户名和头像</li>
            </ul>
          </div>

          <div className="mt-5 flex justify-center">
            <WalletConnectButton />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-soft">
            <Link href="/profile" className="text-[#8fb3ff] hover:underline">
              查看个人中心
            </Link>
            <Link href="/nfts/create" className="text-[#8fb3ff] hover:underline">
              去创建 NFT
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
