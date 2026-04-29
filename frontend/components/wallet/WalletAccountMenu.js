"use client";

function WalletCard({ account, walletLabel, shortAddress }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#1a2944] to-[#152136] p-4">
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-[#4b86ff2b]" />
      <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-[#2bbf9c1e]" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-2 text-[11px] font-bold leading-4 text-white">
          钱包地址
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-3xl font-black text-white">{shortAddress}</p>
          <p className="mt-1 text-[11px] text-[#b8c8ee]">{walletLabel}</p>
        </div>
        <span className="rounded-full border border-[#57d88a88] bg-[#57d88a22] px-2 py-1 text-[10px] font-semibold text-[#ddffea]">
          已连接
        </span>
      </div>
      <p className="relative z-10 mt-3 break-all rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-[#c7d6ff]">
        {account}
      </p>
    </div>
  );
}

function MenuButton({ children, onClick }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-[12px] font-semibold text-[#d6e0ff] transition hover:bg-white/10"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuActions({ copied, onCopy, onProfile, onLogout, onClose }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <MenuButton onClick={onCopy}>{copied ? "已复制" : "复制地址"}</MenuButton>
      <MenuButton onClick={onProfile}>个人中心</MenuButton>
      <MenuButton onClick={onLogout}>退出登录</MenuButton>
      <MenuButton onClick={onClose}>取消</MenuButton>
    </div>
  );
}

export default function WalletAccountMenu({
  account,
  copied,
  onClose,
  onCopy,
  onLogout,
  onProfile,
  shortAddress,
  walletLabel,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-24 backdrop-blur-sm overlay-fade-enter"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-md p-5 text-xs text-soft modal-popup-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <WalletCard account={account} shortAddress={shortAddress} walletLabel={walletLabel} />
        <p className="mt-3 text-[11px] text-[#9eb1df]">
          可以在这里快速复制地址、进入个人中心或退出登录。
        </p>
        <MenuActions
          copied={copied}
          onClose={onClose}
          onCopy={onCopy}
          onLogout={onLogout}
          onProfile={onProfile}
        />
      </div>
    </div>
  );
}
