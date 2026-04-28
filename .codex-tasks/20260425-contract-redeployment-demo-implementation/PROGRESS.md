# 当前状态

- 已完成前端链上层拆分，所有相关读写接口均支持可选 `contractAddress`。
- NFT 详情页的版税查询、购买、重新上架、下架已统一按 `nft.contract` 执行。
- 后端已支持 `ACTIVE_NFT_CONTRACT` 过滤市场列表。
- 已补充 `frontend/.env.local.demo`、`backend/.env.demo`、`hardhat/.env.demo`。

# 验证结果

1. `frontend` 执行 `npm run lint` 通过，仅保留仓库原有的 `img` 与 `react-hooks/exhaustive-deps` 警告。
2. `backend` 执行 `go test ./...` 通过。
