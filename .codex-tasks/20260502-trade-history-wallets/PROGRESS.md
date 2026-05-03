# Progress

## Recovery

任务: Trade history wallet identity display
形态: single-full
进度: 4/4
当前: Complete
验证: `npm run lint` passed with existing warnings; Playwright verified `/nfts/22`
文件: `.codex-tasks/20260502-trade-history-wallets/TODO.csv`
下一步: None.

## Notes

- The selected "成交历史" text is not an interactive tab, so it should be removed.
- Wallet addresses are already returned by `ListByNFTID`; frontend rendering is the missing piece.
- `TradeHistorySection.js` now renders seller and buyer identity blocks with full wallet addresses.
- Browser verification confirmed the empty "成交历史" label is gone and both participant wallet addresses render.
