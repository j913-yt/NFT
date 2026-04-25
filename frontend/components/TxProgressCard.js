"use client";

import { Card, CardBody, Chip, Progress, Snippet } from "@nextui-org/react";

const DEFAULT_STEP_LABELS = Object.freeze({
  ipfs: "IPFS 上传",
  wallet: "钱包确认",
  chain: "链上确认",
  sync: "后台同步",
  done: "完成"
});

function resolveStepLabel(step) {
  if (typeof step === "string") return DEFAULT_STEP_LABELS[step] || step;
  return step?.label || DEFAULT_STEP_LABELS[step?.id] || String(step?.id || "");
}

function normalizeSteps(steps) {
  return steps
    .map((step) => ({ id: typeof step === "string" ? step : step?.id, label: resolveStepLabel(step) }))
    .filter((step) => step.id);
}

function progressValue(activeIndex, count, hasError) {
  if (hasError) return Math.max((activeIndex / count) * 100, 8);
  return Math.min(((activeIndex + 1) / count) * 100, 100);
}

function stepChip(index, activeIndex, hasError) {
  if (hasError && index === activeIndex) return { color: "danger", label: "失败" };
  if (index < activeIndex) return { color: "success", label: "已完成" };
  if (index === activeIndex) return { color: "primary", label: "进行中" };
  return { color: "default", label: "等待中" };
}

export default function TxProgressCard({
  title = "交易进度",
  steps = ["wallet", "chain", "sync", "done"],
  currentStep = "wallet",
  detail = "",
  txHash = "",
  error = ""
}) {
  const normalizedSteps = normalizeSteps(steps);
  if (!normalizedSteps.length) return null;

  const activeIndex = Math.max(0, normalizedSteps.findIndex((step) => step.id === currentStep));
  const hasError = Boolean(error);

  return (
    <Card className="mt-3 border border-white/10 bg-white/[0.06]" shadow="none">
      <CardBody className="gap-4 p-4 text-xs text-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <Chip color={hasError ? "danger" : "primary"} size="sm" variant="flat">
            {hasError ? "流程中断" : normalizedSteps[activeIndex]?.label}
          </Chip>
        </div>

        <Progress
          aria-label={title}
          color={hasError ? "danger" : "primary"}
          value={progressValue(activeIndex, normalizedSteps.length, hasError)}
        />

        <div className="grid gap-2 sm:grid-cols-4">
          {normalizedSteps.map((step, index) => {
            const chip = stepChip(index, activeIndex, hasError);
            return (
              <div key={step.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <p className="font-semibold text-white">{step.label}</p>
                <Chip className="mt-2" color={chip.color} size="sm" variant="flat">{chip.label}</Chip>
              </div>
            );
          })}
        </div>

        {detail && <p className="text-[11px] text-[#cfe0ff]">{detail}</p>}
        {txHash && <Snippet hideSymbol size="sm" variant="flat">{txHash}</Snippet>}
        {hasError && <p className="status-message error">{error}</p>}
      </CardBody>
    </Card>
  );
}
