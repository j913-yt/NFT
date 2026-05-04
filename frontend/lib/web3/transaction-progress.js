// 链上交易进度通知工具。
// 把钱包确认、交易广播、链上确认这几个阶段统一通知给页面组件。
// 交易阶段通知给页面层使用：
// wallet = 等待用户在钱包确认；chain = 交易已广播；confirmed = 链上已打包确认。
export function notifyStage(onStage, stage, txHash = "") {
  onStage?.(stage, txHash);
}
