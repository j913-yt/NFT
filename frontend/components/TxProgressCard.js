"use client";

const defaultStepLabels = {
  ipfs: "IPFS 上传",
  wallet: "钱包确认",
  chain: "链上确认",
  sync: "后台同步",
  done: "完成"
};

function resolveStepLabel(step) {
  if (typeof step === "string") {
    return defaultStepLabels[step] || step;
  }
  return step?.label || defaultStepLabels[step?.id] || String(step?.id || "");
}

function resolveStepId(step) {
  return typeof step === "string" ? step : step?.id;
}

export default function TxProgressCard({
  title = "交易进度",
  steps = ["wallet", "chain", "sync", "done"],
  currentStep = "wallet",
  detail = "",
  txHash = "",
  error = ""
}) {
  const normalizedSteps = steps
    .map((s) => ({ id: resolveStepId(s), label: resolveStepLabel(s) }))
    .filter((s) => s.id);
  if (!normalizedSteps.length) return null;

  const activeIndex = Math.max(
    0,
    normalizedSteps.findIndex((s) => s.id === currentStep)
  );
  const hasError = Boolean(error);

  return (
    <div className="mt-3 rounded-xl border border-white/15 bg-black/30 p-3 text-xs text-soft">
      <p className="text-sm font-black text-white">{title}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {normalizedSteps.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const isPending = index > activeIndex;

          const dotClass = hasError && isActive
            ? "border-[#ff9bad] bg-[#ff567e33]"
            : isDone
              ? "border-[#57d88a] bg-[#57d88a33]"
              : isActive
                ? "border-[#18d2ff] bg-[#18d2ff33]"
                : "border-white/25 bg-white/5";

          const textClass = hasError && isActive
            ? "text-[#ffd8e1]"
            : isDone
              ? "text-[#cbf6d8]"
              : isActive
                ? "text-[#d6f6ff]"
                : "text-soft";

          return (
            <div key={step.id} className={`rounded-lg border px-2 py-2 ${dotClass}`}>
              <p className={`font-semibold ${textClass}`}>{step.label}</p>
              <p className="mt-1 text-[11px] text-dim">
                {hasError && isActive ? "失败" : isDone ? "已完成" : isActive ? "进行中" : isPending ? "等待中" : "等待中"}
              </p>
            </div>
          );
        })}
      </div>

      {detail && <p className="mt-3 text-[11px] text-[#cfe0ff]">{detail}</p>}
      {txHash && (
        <p className="mt-1 break-all text-[11px] text-[#9ab4f4]">
          交易哈希: {txHash}
        </p>
      )}
      {hasError && (
        <p className="mt-2 rounded-lg border border-[#ff8f9d55] bg-[#ff8f9d1a] px-2 py-1 text-[11px] text-[#ffd7dc]">
          {error}
        </p>
      )}
    </div>
  );
}
