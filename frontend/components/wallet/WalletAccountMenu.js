"use client";

import { createPortal } from "react-dom";

const ACTION_BUTTON_STYLES = Object.freeze({
  primary:
    "border-[var(--brand)] bg-[var(--brand)] text-[#071010] shadow-[0_10px_24px_rgba(0,213,200,0.22)] hover:brightness-105",
  secondary:
    "border-white/18 bg-white/[0.06] text-[#eef3ff] hover:border-[var(--line-strong)] hover:bg-white/[0.09]",
  danger:
    "border-[rgba(255,107,122,0.42)] bg-[rgba(255,107,122,0.08)] text-[#ffd8de] hover:bg-[rgba(255,107,122,0.14)]",
  text: "border-transparent bg-transparent text-[#aeb8cc] hover:bg-white/[0.06] hover:text-white",
});

const ADDRESS_ROW_LABEL = "完整地址";

function DialogHeader({ onClose }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase text-[var(--brand)]">Wallet Account</p>
        <h2 id="wallet-account-title" className="mt-1 text-xl font-black text-white">
          钱包账户
        </h2>
      </div>
      <button
        type="button"
        aria-label="关闭钱包账户弹窗"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-lg leading-none text-[#dce5ff] transition hover:bg-white/[0.1]"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

function StatusChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,213,200,0.38)] bg-[rgba(0,213,200,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#dffdfa]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
      已连接
    </span>
  );
}

function WalletSummary({ shortAddress, walletLabel }) {
  return (
    <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#8f9ab0]">当前钱包</p>
          <p className="mt-1 truncate text-2xl font-black leading-tight text-white sm:text-3xl">
            {shortAddress}
          </p>
          <p className="mt-1 truncate text-xs text-[#aab6d0]">{walletLabel}</p>
        </div>
        <StatusChip />
      </div>
    </div>
  );
}

function AddressField({ account }) {
  return (
    <div className="mt-3 rounded-lg border border-white/12 bg-[#0b1018]/80 px-3.5 py-3">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold text-[#8f9ab0]">{ADDRESS_ROW_LABEL}</span>
        <span className="text-[11px] font-semibold text-[#8f9ab0]">EVM</span>
      </div>
      <p className="break-all font-mono text-[12px] leading-5 text-[#d8e4ff]">{account}</p>
    </div>
  );
}

function ActionButton({ children, onClick, tone = "secondary" }) {
  const toneClass = ACTION_BUTTON_STYLES[tone];

  return (
    <button
      type="button"
      className={`min-h-11 rounded-lg border px-3 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${toneClass}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MenuActions({ copied, onCopy, onProfile, onLogout, onClose }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <ActionButton tone="primary" onClick={onCopy}>
        {copied ? "已复制" : "复制地址"}
      </ActionButton>
      <ActionButton onClick={onProfile}>个人中心</ActionButton>
      <ActionButton tone="danger" onClick={onLogout}>
        退出登录
      </ActionButton>
      <ActionButton tone="text" onClick={onClose}>
        取消
      </ActionButton>
    </div>
  );
}

function WalletAccountDialog({
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm overlay-fade-enter"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-account-title"
        className="w-full max-w-[520px] rounded-lg border border-white/12 bg-[#12151d]/95 p-5 text-xs text-soft shadow-[0_24px_80px_rgba(0,0,0,0.54)] modal-popup-enter sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader onClose={onClose} />
        <WalletSummary shortAddress={shortAddress} walletLabel={walletLabel} />
        <AddressField account={account} />
        <p className="mt-3 text-xs leading-5 text-[#a8b3c7]">
          复制地址用于收款或核对身份，进入个人中心可查看账户资料与持有记录。
        </p>
        <MenuActions
          copied={copied}
          onClose={onClose}
          onCopy={onCopy}
          onLogout={onLogout}
          onProfile={onProfile}
        />
      </section>
    </div>
  );
}

export default function WalletAccountMenu(props) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(<WalletAccountDialog {...props} />, document.body);
}
