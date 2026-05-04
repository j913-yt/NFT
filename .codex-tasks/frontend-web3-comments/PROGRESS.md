# 进度

## 当前状态

- 已定位合约交互集中在 `frontend/lib/web3`。
- 页面入口主要是创建页调用 `mintNFTWithWallet`，详情页调用 `buyNFTWithWallet`。
- 已补充中文注释，并把过长的 `transactions.js` 按职责拆成铸造、市场交易和交易进度三个小文件。

## 验证

- `node --check`：核心 web3 文件和相关页面文件通过。
- `npm run lint`：通过，有项目既有 warning。
- `git diff --check`：通过，仅有 CRLF 换行提示。
- `npm run build`：未完成，失败于 `frontend/.next/trace` 权限拒绝，并伴随 RainbowKit 相关可选依赖 warning。
