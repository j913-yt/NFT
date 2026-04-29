"use client";

const STAGE_TEXT = Object.freeze({
  connect: "请选择钱包并完成连接...",
  nonce: "正在请求 nonce...",
  sign: "等待签名确认...",
  login: "正在创建登录会话...",
});

export default function WalletStatusModal({ stage, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm overlay-fade-enter">
      <div className="glass-panel w-full max-w-sm p-5 text-xs text-soft modal-popup-enter">
        <h2 className="mb-2 text-sm font-black text-white">钱包身份验证</h2>
        <p className="mb-3 leading-6">请在钱包中完成连接和签名，不会产生链上手续费。</p>
        <button
          type="button"
          disabled
          className="mb-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-[#cfd8ff]"
        >
          {STAGE_TEXT[stage] || "处理中..."}
        </button>
        <div className="flex justify-end">
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={onCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
