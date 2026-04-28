# 任务目标

根据 `docs/contract-redeployment-demo-implementation.md` 优化系统，使答辩演示环境能够在重部署合约后稳定运行，同时不污染现有业务数据。

# 交付边界

- 前端链上读写支持按 NFT 自身 `contract` 执行
- NFT 详情页把 `nft.contract` 透传给链上调用
- 后端支持通过 `ACTIVE_NFT_CONTRACT` 过滤市场列表
- 补充 demo 环境样例文件，覆盖前端、后端、Hardhat

# 验收标准

- 未传入合约地址时，前端保持现有默认合约行为
- NFT 详情页的版税查询、购买、重新上架、下架均可按 `nft.contract` 执行
- `ACTIVE_NFT_CONTRACT` 为空时后端行为不变，非空时仅返回指定合约下的 NFT
- 仓库中存在可直接填写的 demo 环境样例文件
