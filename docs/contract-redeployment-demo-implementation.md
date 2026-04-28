# 合约重部署答辩演示实现文档

## 1. 背景与目标

### 1.1 背景

当前系统的 NFT 市场数据既依赖链上合约，也依赖后端 MySQL 数据库。创建 NFT 时，前端会先完成链上铸造，再将 `contract`、`tokenId`、`priceWei`、`royalty` 等数据写入后端数据库。

这意味着“重新部署合约”不是单纯替换一个前端地址的问题，而是一个同时涉及：

- 前端链上交互地址
- 后端市场数据
- 历史 NFT 记录
- tokenId 重新计数

的系统一致性问题。

### 1.2 当前风险

当前系统存在以下结构性风险：

1. 前端链上读写默认只使用全局合约地址 `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`。
2. 数据库中的 NFT 记录虽然存储了 `contract` 字段，但详情、购买、上下架等链上操作没有按 NFT 自身的 `contract` 去访问链。
3. 新合约重新部署后，`tokenId` 会从 1 重新开始，历史数据和新数据容易产生混淆。
4. 如果环境切换不彻底，创建 NFT 时可能因为 `(contract, token_id)` 唯一索引冲突而失败。

### 1.3 目标

本方案的目标不是“在现有生产/开发数据上无缝热切换新合约”，而是实现一套**适合答辩演示的稳定方案**：

1. 答辩时可以部署新合约并完成演示。
2. 不影响当前已有商城数据。
3. 可以创建、上架、购买、查看交易记录。
4. 系统能够同时兼容历史 NFT 和答辩环境 NFT，不发生串链。

## 2. 总体方案

推荐采用“两层隔离 + 一层修复”的实现方式：

### 2.1 第一层：答辩环境隔离

为答辩单独准备一套环境：

- 前端使用新的合约地址
- 后端使用独立数据库，例如 `nft_demo`
- 答辩时只操作 demo 数据

这样可以避免历史数据和答辩数据互相污染。

### 2.2 第二层：链上访问按 NFT 自身合约地址执行

前端链上交互逻辑需要从“只认全局合约地址”改为：

- **创建 NFT 时**：仍然使用当前环境配置的默认合约地址
- **查看详情 / 查询版税 / 查询上架状态 / 购买 / 重新上架 / 下架时**：
  优先使用 `nft.contract`

这样即使数据库里同时存在旧合约 NFT 和新合约 NFT，也不会访问错链。

### 2.3 第三层：可选的后端演示过滤

后端增加一个“当前激活合约”配置，仅在列表接口中过滤出指定合约的数据。  
这不是必须项，但对于答辩环境非常有帮助，可以确保首页市场中只出现演示资产。

## 3. 改造范围

## 3.1 前端

核心文件：

- `frontend/lib/web3.js`
- `frontend/app/nfts/[id]/page.js`
- `frontend/app/nfts/create/page.js`

### 3.1.1 `frontend/lib/web3.js`

当前问题：

- `NFT_CONTRACT_ADDRESS` 是全局常量
- 多个函数内部直接使用该常量创建合约实例

需要改造的函数：

- `getTokenOwnerOnChain`
- `getRoyaltyInfoOnChain`
- `getOnChainListing`
- `mintNFTWithWallet`
- `listNFTWithWallet`
- `delistNFTWithWallet`
- `buyNFTWithWallet`

#### 改造目标

为上述函数增加可选参数 `contractAddress`，并统一通过辅助方法解析实际地址：

```js
function resolveContractAddress(contractAddress = "") {
  const address = String(contractAddress || NFT_CONTRACT_ADDRESS).trim();
  if (!ethers.isAddress(address)) {
    throw new Error("合约地址无效");
  }
  return address;
}
```

同时新增统一的合约实例创建函数：

```js
function createNFTContract({ contractAddress = "", runner }) {
  const address = resolveContractAddress(contractAddress);
  return new ethers.Contract(address, NFT_CONTRACT_ABI, runner);
}
```

这样可避免在多个函数里重复写死 `NFT_CONTRACT_ADDRESS`。

#### 修改原则

1. 所有读链函数都支持外部传入 `contractAddress`
2. 所有交易函数都支持外部传入 `contractAddress`
3. 未传入时回退到 `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`
4. 创建页不受影响，仍使用默认答辩合约

### 3.1.2 `frontend/app/nfts/[id]/page.js`

当前问题：

- 页面拿到了 `nft.contract`
- 但版税查询、购买、上架、下架并没有把这个字段传给 `web3.js`

#### 需要改造的调用点

1. 查询版税
2. 购买 NFT
3. 重新上架
4. 下架

#### 修改方式

所有链上相关调用统一补充：

```js
contractAddress: nft.contract
```

例如：

```js
const purchase = await buyNFTWithWallet({
  contractAddress: nft.contract,
  tokenId: nft.tokenId,
  fallbackPriceWei: nft.priceWei || "0",
  fallbackPriceEth: Number(nft.price || 0),
  onStage: ...
});
```

这样详情页将始终对应该 NFT 自身所属合约。

### 3.1.3 `frontend/app/nfts/create/page.js`

创建页保留当前逻辑，但需要明确：

1. 创建时使用当前答辩环境的默认合约地址
2. 写回后端时继续将 `contract: NFT_CONTRACT_ADDRESS` 写入数据库

这部分不需要复杂改造，因为创建行为本身就是“面向当前环境的合约”。

## 3.2 后端

核心文件：

- `backend/internal/config/config.go`
- `backend/internal/service/nft.go`

### 3.2.1 `backend/internal/config/config.go`

新增配置项：

```go
ActiveNFTContract string
```

从环境变量读取：

```go
activeNFTContract := strings.TrimSpace(os.Getenv("ACTIVE_NFT_CONTRACT"))
```

加入返回配置：

```go
ActiveNFTContract: activeNFTContract,
```

### 3.2.2 `backend/internal/service/nft.go`

在 NFT 列表查询中增加按激活合约过滤的能力。

建议改造方式：

1. `NFTService` 结构体新增 `activeContract` 字段
2. `NewNFTService` 接收配置中的 `ActiveNFTContract`
3. `List` 查询时，如果配置不为空，则加上：

```go
query = query.Where("contract = ?", s.activeContract)
```

#### 目的

答辩环境中首页市场只展示当前答辩合约下的数据，避免把旧环境 NFT 一起展示出来。

### 3.2.3 是否需要改创建接口

不需要。  
后端创建接口当前已经接收前端传入的 `contract` 和 `tokenId`，这对于 demo 环境是足够的。

## 4. 环境设计

## 4.1 前端环境

建议新增答辩专用环境文件，例如：

- `frontend/.env.local.demo`

示例：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0xYourDefenseContractAddress
NEXT_PUBLIC_RPC_URL=https://your-sepolia-rpc
NEXT_PUBLIC_TX_EXPLORER_BASE=https://sepolia.etherscan.io/tx/
```

答辩前将其内容复制到 `frontend/.env.local`，然后重启前端服务。

## 4.2 后端环境

建议新增答辩专用环境文件，例如：

- `backend/.env.demo`

示例：

```env
JWT_SECRET=your-demo-secret
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=your-password
MYSQL_DB=nft_demo
ACTIVE_NFT_CONTRACT=0xYourDefenseContractAddress
PINATA_API_KEY=your-pinata-key
PINATA_API_SECRET=your-pinata-secret
PINATA_JWT=your-pinata-jwt
IPFS_GATEWAY=https://gateway.pinata.cloud
```

说明：

- `MYSQL_DB=nft_demo` 用于隔离答辩数据库
- `ACTIVE_NFT_CONTRACT` 用于过滤首页市场展示数据

## 4.3 Hardhat 环境

部署新合约时仍使用 `hardhat/.env` 或单独准备：

- `hardhat/.env.demo`

确保其中的 RPC 和部署钱包为答辩使用环境。

## 5. 数据库策略

## 5.1 推荐策略

不要复用当前 `nft` 数据库，单独创建：

- `nft_demo`

理由：

1. 新合约重部署后 `tokenId` 从头开始计数
2. 演示数据应该可控、简洁、可重复初始化
3. 避免答辩中误展示历史脏数据

## 5.2 需要保留历史数据吗

不需要迁移到 demo 库。  
答辩目标是演示功能链路，不是展示历史运行沉淀。

demo 库应尽量保持轻量，仅保留：

- 答辩用用户
- 答辩现场创建的 NFT
- 答辩现场产生的订单

## 6. 具体实现步骤

建议按以下顺序实施：

### 步骤 1：前端 `web3.js` 支持 `contractAddress`

实施内容：

1. 提取地址解析函数
2. 提取合约实例工厂函数
3. 修改读链函数签名
4. 修改交易函数签名
5. 替换函数内部对 `NFT_CONTRACT_ADDRESS` 的直接引用

验收标准：

- 不传 `contractAddress` 时，原逻辑不变
- 传入合法地址时，能够针对指定合约读写链上数据

### 步骤 2：NFT 详情页按 `nft.contract` 调用链上函数

实施内容：

1. 版税查询传入 `nft.contract`
2. 购买传入 `nft.contract`
3. 上架传入 `nft.contract`
4. 下架传入 `nft.contract`

验收标准：

- 同一个详情页内所有链上操作都访问该 NFT 所属合约

### 步骤 3：后端增加 `ACTIVE_NFT_CONTRACT`

实施内容：

1. 配置结构新增字段
2. 环境变量读取
3. `NFTService` 构造器增加 `activeContract`
4. 列表接口增加合约过滤
5. 路由初始化时传入配置

验收标准：

- 配置为空时，系统行为与当前一致
- 配置非空时，仅返回指定合约下的 NFT

### 步骤 4：创建 demo 数据库

执行：

1. 创建 `nft_demo`
2. 启动后端后由 Gorm 自动建表
3. 校验 `nfts`、`orders`、`users` 表已生成

### 步骤 5：准备答辩环境变量

执行：

1. 部署新合约
2. 更新前端 demo 环境变量中的 `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`
3. 更新后端 demo 环境变量中的 `ACTIVE_NFT_CONTRACT`
4. 更新后端 demo 环境变量中的 `MYSQL_DB=nft_demo`

### 步骤 6：联调验证

联调路径：

1. 钱包登录
2. 上传媒体到 IPFS
3. 铸造 NFT
4. 自动写入后端
5. 首页展示
6. 详情查看
7. 重新上架 / 下架
8. 使用第二个钱包购买
9. 查看订单记录

## 7. 答辩当天操作流程

建议现场按以下顺序操作：

1. 使用 Hardhat 部署新合约
2. 记录新合约地址
3. 将新地址写入前端 `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`
4. 将新地址写入后端 `ACTIVE_NFT_CONTRACT`
5. 将后端数据库切换为 `nft_demo`
6. 重启后端
7. 重启前端
8. 打开首页确认市场为空或仅有 demo 数据
9. 使用演示钱包登录并创建 NFT
10. 展示 NFT 出现在市场中
11. 使用第二个钱包完成购买
12. 展示订单记录和版税信息

## 8. 注意事项

### 8.1 必须重启前端

Next.js 在开发环境下不会自动重新注入 `.env.local` 中的合约地址。  
修改合约地址后必须重启前端服务，否则页面仍可能继续使用旧地址。

### 8.2 不要在原数据库上直接切换

即使数据库表结构兼容，也不建议在当前 `nft` 库上直接做答辩演示。  
因为老数据、新数据、旧 tokenId、新 tokenId 会混在一起，排查成本高，现场风险大。

### 8.3 不要依赖手工记忆切换

建议显式准备：

- 前端 demo 环境文件
- 后端 demo 环境文件
- 答辩部署记录

避免现场临时手动改错地址或数据库名。

### 8.4 不在源码中记录真实私钥

部署钱包私钥、Pinata 密钥、数据库密码只通过环境变量提供，不写入文档和源码。

## 9. 验收标准

本次改造完成后，应满足以下标准：

1. 系统可以在答辩环境中部署新合约并正常运行。
2. 首页市场只展示答辩合约下的 NFT。
3. NFT 详情页的链上查询、购买、上下架都按 `nft.contract` 执行。
4. 现场重新部署合约后，不需要清理原业务库。
5. 使用独立 demo 库时，可以完整跑通“创建 -> 展示 -> 购买 -> 订单记录”链路。

## 10. 推荐实施优先级

如果时间有限，推荐按优先级实施：

### P0：必须完成

1. 答辩数据库隔离
2. 前端环境切换到新合约
3. 前端重启

### P1：强烈建议完成

1. `web3.js` 支持 `contractAddress`
2. NFT 详情页按 `nft.contract` 调链

### P2：增强稳定性

1. 后端增加 `ACTIVE_NFT_CONTRACT`
2. 首页市场仅展示当前答辩合约资产

## 11. 结论

针对答辩场景，最稳妥的实现方案不是在当前商城数据上直接替换合约地址，而是：

**以独立 demo 数据库承载答辩数据，并将链上访问逻辑改造成按 NFT 自身合约地址执行。**

这样既能保证现场重部署和演示稳定，也能从根源避免历史 NFT 与新合约资产发生串链和错写问题。
