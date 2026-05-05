# NFT 系统流程串联文档

这份文档不是讲某一个文件的注释，而是把“用户操作、前端代码、后端接口、合约方法、数据库记录”串起来看。读代码时可以先看这里，知道一条业务链路经过哪些文件，再跳到对应文件看具体注释。

## 一、系统整体分工

这个项目可以先按三层理解：

1. 前端负责用户操作、钱包连接、签名、发起合约交易、调用后端 API。
2. 后端负责登录态、IPFS 上传、NFT 链下镜像数据、订单记录、个人中心数据。
3. 合约负责真正的链上 NFT 所有权、铸造、上架、下架、购买、版税分账。

一个很重要的原则：

后端不会替用户铸造、上架、购买 NFT。凡是会改变链上状态的操作，都必须由前端拿到钱包 signer 后调用合约，并且需要用户在钱包里确认。后端只在链上交易成功后保存一份链下记录，方便页面展示和查询。

## 二、主要文件地图

### 前端入口

| 功能 | 主要文件 | 作用 |
| --- | --- | --- |
| 顶部钱包按钮 | `frontend/components/AppHeader.js` | 页面头部引入 `WalletConnectButton` |
| 钱包连接按钮 | `frontend/components/WalletConnectButton.js` | 点击“连接钱包”，读取 wagmi 钱包状态，触发登录流程 |
| 钱包登录流程 | `frontend/components/wallet/useWalletLoginFlow.js` | 控制连接、请求 nonce、签名、登录、取消流程 |
| 钱包签名登录封装 | `frontend/lib/wallet/login.js` | 调后端获取 nonce，拼签名消息，调用钱包签名，再调后端登录 |
| 本地登录态 | `frontend/lib/wallet/session.js` | 从 localStorage 读取 `jwt_token` 和 `current_user` |
| 后端 API 封装 | `frontend/lib/api.js` | 统一调用 `/api/v1/...`，自动带上 JWT |
| 合约交易入口 | `frontend/lib/web3/mint-transactions.js`、`frontend/lib/web3/market-transactions.js` | 铸造、上架、下架、购买的前端封装 |
| 合约对象创建 | `frontend/lib/web3/contracts.js` | 用 ethers 创建合约对象、解析事件、读取 listing |
| 钱包 signer 获取 | `frontend/lib/web3/wallet.js` | 获取 provider、signer、account，并校验登录钱包和交易钱包一致 |
| 创建 NFT 页面 | `frontend/app/nfts/create/page.js` | 上传 IPFS、调用合约铸造、同步后端 |
| NFT 详情业务 | `frontend/app/nfts/[id]/use-nft-detail.js` | 详情页购买、重新上架、下架、订单历史 |

### 后端入口

| 功能 | 主要文件 | 作用 |
| --- | --- | --- |
| 服务启动 | `backend/cmd/server/main.go` | 启动 HTTP 服务 |
| 路由注册 | `backend/internal/router/router.go` | 把 URL 路径绑定到 handler 方法 |
| JWT 鉴权 | `backend/internal/middleware/auth.go` | 解析 `Authorization: Bearer <token>`，写入当前用户 ID |
| 钱包登录接口 | `backend/internal/handler/auth.go`、`backend/internal/service/auth.go` | 生成 nonce、校验签名、签发 JWT |
| IPFS 上传接口 | `backend/internal/handler/ipfs.go`、`backend/internal/service/ipfs.go` | 上传 NFT 媒体和 metadata 到 Pinata/IPFS |
| NFT 数据接口 | `backend/internal/handler/nft.go`、`backend/internal/service/nft.go` | 保存 NFT 链下记录，查询列表和详情，更新上架状态 |
| 订单接口 | `backend/internal/handler/order.go`、`backend/internal/service/order.go` | 购买成功后创建订单，更新 NFT 本地拥有者 |
| 数据库模型 | `backend/internal/model/models.go` | 定义 `User`、`NFT`、`Order` 三张核心表 |

### 合约入口

| 功能 | 合约方法 | 作用 |
| --- | --- | --- |
| 只铸造 | `safeMint(...)` | 创建 NFT，写入 tokenURI，不上架 |
| 铸造并上架 | `mintAndList(...)` | 创建 NFT，同时写入 `_listings[tokenId]` |
| 上架已有 NFT | `listToken(tokenId, priceWei)` | 当前 owner 设置固定价格 |
| 下架 | `cancelListing(tokenId)` | 删除上架信息，不销毁 NFT |
| 购买 | `buy(tokenId)` | 校验付款、转移 NFT、分配版税和卖家收入 |
| 查询上架 | `getListing(tokenId)` | 返回 seller、priceWei、active |
| 查询版税 | `getRoyaltyInfo(tokenId, salePriceWei)` | 返回 receiver、royaltyAmount、royaltyFeeBps |

## 三、钱包连接和签名登录流程

用户看到的是“连接钱包”，实际分成两件事：

1. 连接浏览器钱包，让前端拿到钱包地址。
2. 用钱包对后端 nonce 签名，证明“我确实控制这个地址”，后端再发 JWT 登录态。

### 1. 用户点击连接钱包

入口：

```text
frontend/components/AppHeader.js
  -> WalletConnectButton
```

按钮本体在：

```text
frontend/components/WalletConnectButton.js
```

这里用到了 wagmi/RainbowKit：

```js
const { address, connector, isConnected, status } = useAccount();
const { signMessageAsync } = useSignMessage();
const { openConnectModal } = useConnectModal();
```

这几个变量的含义：

| 变量 | 意思 |
| --- | --- |
| `address` | 当前钱包返回的钱包地址 |
| `connector` | 当前连接的钱包插件，例如 MetaMask、WalletConnect |
| `isConnected` | 浏览器钱包是否已经连接 |
| `signMessageAsync` | 让钱包签名普通文本消息的方法 |
| `openConnectModal` | 打开选择钱包弹窗的方法 |

按钮点击后会走：

```text
WalletConnectButton.js
  -> useWalletLoginFlow(...)
  -> handlePrimaryClick()
```

### 2. 前端判断是否已经连接钱包

文件：

```text
frontend/components/wallet/useWalletLoginFlow.js
```

`handlePrimaryClick` 的判断逻辑：

1. 如果正在登录，直接返回。
2. 如果已经登录，就打开/关闭账户菜单。
3. 如果钱包已连接且有 `address`，直接调用 `loginConnectedWallet(address)`。
4. 如果钱包未连接，调用 `openConnectModal()` 让用户选择钱包。
5. 用户在弹窗里连上钱包后，`usePendingLoginEffect` 会继续调用 `loginConnectedWallet(address)`。

### 3. 前端向后端请求 nonce

文件：

```text
frontend/lib/wallet/login.js
```

核心函数：

```js
loginWithWallet({ address, signMessageAsync, setStage })
```

第一步：

```js
setStage("nonce");
const { nonce } = await getWalletNonce(address);
```

`getWalletNonce` 在：

```text
frontend/lib/api.js
```

它请求后端：

```http
GET /api/v1/auth/wallet/nonce?wallet=0x...
```

后端路由在：

```text
backend/internal/router/router.go
```

对应：

```go
api.HandleFunc("/auth/wallet/nonce", authHandler.WalletNonce).Methods(http.MethodGet)
```

然后进入：

```text
backend/internal/handler/auth.go
  -> AuthHandler.WalletNonce
backend/internal/service/auth.go
  -> AuthService.GenerateNonce
```

后端做的事：

1. 校验钱包地址格式。
2. 如果这个钱包没有用户记录，就创建一个 `User`。
3. 生成随机 nonce。
4. 把 nonce 写入 `users.nonce` 字段。
5. 返回给前端。

数据库字段在：

```text
backend/internal/model/models.go
```

关键字段：

| 字段 | 含义 |
| --- | --- |
| `User.Wallet` | 用户绑定的钱包地址 |
| `User.Nonce` | 本次登录要签名的一次性随机字符串 |

### 4. 前端让钱包签名 nonce

拿到 nonce 后，前端拼出固定登录消息：

```js
function buildLoginMessage(nonce) {
  return `NovaNFT Login\nnonce: ${nonce}`;
}
```

然后执行：

```js
setStage("sign");
const signature = await signMessageAsync({ message: buildLoginMessage(nonce) });
```

这里会弹出钱包签名窗口。用户点确认后，钱包返回 `signature`。

注意：这里不是发链上交易，不需要 gas。它只是对一段文本签名，用来证明“当前用户控制这个钱包地址”。

### 5. 前端把签名交给后端登录

签名完成后：

```js
setStage("login");
const data = await walletLogin(address, signature);
```

`walletLogin` 在：

```text
frontend/lib/api.js
```

它请求：

```http
POST /api/v1/auth/wallet/login
Content-Type: application/json

{
  "wallet": "0x...",
  "signature": "0x..."
}
```

后端路由：

```go
api.HandleFunc("/auth/wallet/login", authHandler.WalletLogin).Methods(http.MethodPost)
```

后端进入：

```text
backend/internal/handler/auth.go
  -> AuthHandler.WalletLogin
backend/internal/service/auth.go
  -> AuthService.WalletLogin
```

后端校验过程：

1. 根据 `wallet` 找到用户。
2. 读取数据库里保存的 `user.Nonce`。
3. 用同样格式拼出消息：`NovaNFT Login\nnonce: xxx`。
4. 用以太坊签名规则恢复出签名者地址。
5. 比较恢复出的地址和请求里的 `wallet` 是否一致。
6. 一致则清空 nonce，生成 JWT。
7. 返回 `{ token, user }` 给前端。

### 6. 前端保存登录态

`frontend/lib/api.js` 的 `walletLogin` 收到响应后会写入：

```js
window.localStorage.setItem("jwt_token", res.data.token);
window.localStorage.setItem("current_user", JSON.stringify(res.data.user || {}));
```

后续所有后端请求都会自动带上 JWT：

```js
api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("jwt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

后端受保护接口会经过：

```text
backend/internal/middleware/auth.go
  -> Auth(cfg)
```

它会从 JWT 里解析 `userId`，写入请求上下文。后面的 handler 再用：

```go
middleware.UserIDFromContext(r.Context())
```

拿到当前登录用户 ID。

## 四、创建 NFT 流程

创建 NFT 是本系统最完整的一条链路：

```text
上传媒体到 IPFS
  -> 拿到 metadataUri
  -> 前端调用合约铸造
  -> 等链上确认并解析 tokenId
  -> 调后端保存 NFT 链下记录
```

入口页面：

```text
frontend/app/nfts/create/page.js
```

### 1. 前端先上传媒体和 metadata 到 IPFS

创建页调用：

```js
const ipfs = await uploadNFTToIPFS({
  file,
  cover,
  name,
  description,
  category,
});
```

`uploadNFTToIPFS` 在：

```text
frontend/lib/api.js
```

请求：

```http
POST /api/v1/ipfs/nft
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

后端路由：

```go
api.Handle("/ipfs/nft", middleware.Auth(cfg)(ipfsRateLimit(http.HandlerFunc(ipfsHandler.UploadNFT)))).Methods(http.MethodPost)
```

后端进入：

```text
backend/internal/handler/ipfs.go
  -> IPFSHandler.UploadNFT
backend/internal/service/ipfs.go
  -> IPFSService.UploadFile
  -> IPFSService.UploadJSON
```

后端做的事：

1. 校验 Pinata/IPFS 配置是否可用。
2. 读取表单里的 `file` 主媒体。
3. 识别 MIME 类型，判断是 image/audio/video。
4. 如果是音频或视频，可以额外读取 `cover` 封面。
5. 调 Pinata 上传主媒体，得到 `assetCID`。
6. 如果有封面，上传封面，得到 `coverCID`。
7. 组装 ERC721 metadata JSON。
8. 上传 metadata JSON，得到 `metadataCID`。
9. 返回给前端：

```json
{
  "assetCid": "...",
  "assetUri": "ipfs://...",
  "assetUrl": "https://.../ipfs/...",
  "imageUrl": "...",
  "metadataCid": "...",
  "metadataUri": "ipfs://...",
  "metadataUrl": "https://.../ipfs/...",
  "mediaType": "image",
  "mimeType": "image/png"
}
```

其中最关键的是：

| 字段 | 用途 |
| --- | --- |
| `metadataUri` | 后面写入合约的 `tokenURI` |
| `metadataUrl` | 前端/后端方便直接访问 metadata 的 HTTP 地址 |
| `assetUrl` | 页面展示主媒体 |
| `imageUrl` | 页面卡片封面 |

### 2. 前端调用合约铸造

创建页拿到 IPFS 返回值后调用：

```js
const result = await mintNFTWithWallet({
  tokenURI: ipfs.metadataUri,
  priceEth,
  royaltyFeeBps,
  royaltyReceiver,
});
```

入口文件：

```text
frontend/lib/web3/mint-transactions.js
```

`mintNFTWithWallet` 先调用：

```text
frontend/lib/web3/wallet.js
  -> getProviderAndSigner()
```

它会拿到：

| 变量 | 含义 |
| --- | --- |
| `provider` | 读链、广播交易的对象 |
| `signer` | 能代表用户钱包发交易的签名对象 |
| `account` | 当前用于签名交易的钱包地址 |

然后创建合约对象：

```text
frontend/lib/web3/contracts.js
  -> createNFTContract({ runner: signer })
```

合约地址来自：

```text
frontend/lib/web3/constants.js
  -> NFT_CONTRACT_ADDRESS
```

也就是环境变量：

```text
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS
```

### 3. safeMint 和 mintAndList 的选择

`mintNFTWithWallet` 内部有一个关键分支：

```js
if (priceEth > 0) {
  return executeMintAndList(options);
}

return executeSafeMint(options);
```

含义：

| 页面价格 | 前端调用 | 合约行为 |
| --- | --- | --- |
| `priceEth > 0` | `mintAndList(...)` | 铸造 NFT，并立即上架 |
| `priceEth <= 0` | `safeMint(...)` | 只铸造 NFT，不上架 |

价格注意点：

页面输入的是 ETH 小数，例如 `0.01`。合约不接收 ETH 小数，只接收 wei 整数，所以前端会先转：

```text
priceEth -> priceWei
```

比如：

```text
0.01 ETH = 10000000000000000 wei
```

### 4. 合约铸造时发生什么

合约文件：

```text
contracts/NFTCollection.sol
```

只铸造：

```solidity
safeMint(address to, string memory uri, ...)
```

做的事：

1. `_tokenIdCounter += 1`
2. 得到新的 `tokenId`
3. `_safeMint(to, tokenId)`
4. `_setTokenURI(tokenId, uri)`
5. 可选设置版税
6. 发出 `Minted` 事件

铸造并上架：

```solidity
mintAndList(string memory uri, uint256 priceWei, ...)
```

除了上面的铸造动作，还会：

```solidity
_listings[tokenId] = Listing({
  seller: msg.sender,
  priceWei: priceWei,
  active: true
});
```

然后发出：

```solidity
Listed(tokenId, msg.sender, priceWei)
```

### 5. 前端等链上确认并解析 tokenId

合约交易发出去后，前端会等待：

```js
const receipt = await tx.wait();
```

`receipt` 是交易回执，里面有合约事件日志。前端再用：

```text
frontend/lib/web3/contracts.js
  -> parseMintedTokenId(...)
```

优先从 `Minted` 事件解析 `tokenId`，解析不到再看 ERC721 标准的 `Transfer` 事件。

最后还会调用：

```text
assertTokenOwner(contract, tokenId, account, ...)
```

确认当前钱包确实已经是这个 tokenId 的链上 owner。

### 6. 前端把链上结果保存到后端

链上确认后，创建页组装 payload：

```js
const payload = {
  contract: NFT_CONTRACT_ADDRESS,
  tokenId,
  name,
  description,
  imageUrl,
  mediaUrl,
  mediaType,
  mimeType,
  tokenUri: ipfs.metadataUri,
  metadataUrl: ipfs.metadataUrl,
  storage: "ipfs",
  category,
  priceWei: listedPriceWei || "0",
  price: finalPriceEth,
  priceUnit: "ETH",
  royaltyFeeBps,
  royaltyReceiver,
};
```

然后调用：

```js
const nft = await createNFT(payload);
```

`createNFT` 请求：

```http
POST /api/v1/nfts
Authorization: Bearer <jwt_token>
```

后端进入：

```text
backend/internal/handler/nft.go
  -> NFTHandler.Create
backend/internal/service/nft.go
  -> NFTService.Create
```

后端做的事：

1. 通过 JWT 拿到当前用户 ID。
2. 校验 `name`、`contract`、`tokenId`、分类、版税地址等。
3. 规范化 `priceWei`。
4. 把展示用 `price` 统一成 ETH 小数。
5. 设置 `OwnerID = 当前用户 ID`。
6. 写入 `nfts` 表。

这里保存的是“链下镜像记录”。真正的 NFT 已经在链上铸造完成了。

## 五、NFT 详情、列表和交易历史

列表请求在：

```text
frontend/lib/api.js
  -> getNFTs(...)
```

请求：

```http
GET /api/v1/nfts
GET /api/v1/nfts?category=art&listed=true
```

后端：

```text
backend/internal/handler/nft.go
  -> NFTHandler.List
backend/internal/service/nft.go
  -> NFTService.List
```

详情页业务 hook 在：

```text
frontend/app/nfts/[id]/use-nft-detail.js
```

进入详情页时会请求：

```js
getNFTById(id)
getNFTOrderHistory(id)
```

对应后端：

```http
GET /api/v1/nfts/{id}
GET /api/v1/orders/nft/{id}
```

其中 `{id}` 是后端数据库里的 `NFT.ID`，不是链上 `tokenId`。

## 六、购买 NFT 流程

购买入口在详情页：

```text
frontend/app/nfts/[id]/use-nft-detail.js
  -> handleBuy()
```

完整流程：

```text
handleBuy
  -> buyNFTWithWallet
  -> 合约 buy(tokenId)
  -> 等链上确认
  -> createOrder
  -> 后端创建订单并更新 NFT 本地 owner
```

### 1. 前端购买前检查

`handleBuy` 先检查：

1. 当前 NFT 是否存在。
2. `nft.tokenId` 是否存在。
3. 用户是否已经钱包登录。

然后调用：

```js
const purchase = await buyNFTWithWallet({
  contractAddress: nft.contract,
  tokenId: nft.tokenId,
  fallbackPriceWei: nft.priceWei || "0",
  fallbackPriceEth: Number(nft.price || 0),
});
```

### 2. 前端读取链上 listing

文件：

```text
frontend/lib/web3/market-transactions.js
```

`buyNFTWithWallet` 会先：

1. 获取 `signer/account`。
2. 创建合约对象。
3. 调 `readListingCompat(contract, tokenId)` 读取链上上架信息。
4. 校验 listing 是否 active。
5. 校验买家不是卖家。
6. 校验 listing.seller 仍然是链上 owner，避免页面缓存过期。

正常情况下读取的是合约：

```solidity
getListing(tokenId)
```

返回：

| 返回值 | 含义 |
| --- | --- |
| `seller` | 当前链上上架卖家 |
| `priceWei` | 购买必须支付的精确 wei 金额 |
| `active` | 当前是否仍然有效上架 |

### 3. 前端调用合约 buy

真正购买调用：

```js
const tx = await contract.buy(tokenId, { value: listing.priceWei });
```

这里的 `value` 就是随交易一起支付的链原生币金额，必须和合约里的 `listing.priceWei` 完全一致。

### 4. 合约 buy 做什么

合约方法：

```solidity
buy(uint256 tokenId) external payable nonReentrant
```

主要逻辑：

1. 读取 `_listings[tokenId]`。
2. 要求 listing 存在且 active。
3. 要求当前链上 owner 仍然是 listing.seller。
4. 要求买家不是卖家。
5. 要求 `msg.value == listing.priceWei`。
6. 删除 listing，表示购买后自动下架。
7. `_transfer(listing.seller, msg.sender, tokenId)` 转移 NFT。
8. 根据 EIP-2981 计算版税。
9. 给版税接收方打款。
10. 给卖家打款。
11. 发出 `Purchased` 事件。

### 5. 前端购买成功后创建后端订单

链上确认后，详情页调用：

```js
const order = await createOrder({
  nftId: nft.id,
  priceWei: purchase.priceWei,
  price: purchase.priceEth,
  txHash: purchase.txHash,
});
```

请求：

```http
POST /api/v1/orders
Authorization: Bearer <jwt_token>
```

后端进入：

```text
backend/internal/handler/order.go
  -> OrderHandler.Create
backend/internal/service/order.go
  -> OrderService.CreateOrder
```

后端做的事：

1. 从 JWT 拿买家 `buyerID`。
2. 校验 `txHash` 存在且像链上哈希。
3. 查询本地 `nfts` 表里的 NFT。
4. 防止用户购买自己本地记录里的 NFT。
5. 创建 `orders` 记录。
6. 在同一个数据库事务里，把本地 NFT：
   - `owner_id` 改成买家 ID
   - `price_wei` 改成 `"0"`
   - `price` 改成 `0`
   - `price_unit` 保持 `"ETH"`

注意：这里的本地 owner 更新只是为了页面展示和查询。真正的所有权已经在合约 `buy` 里完成转移。

## 七、重新上架流程

入口：

```text
frontend/app/nfts/[id]/use-nft-detail.js
  -> handleRelist()
```

前端调用：

```js
const listed = await listNFTWithWallet({
  contractAddress: nft.contract,
  tokenId: nft.tokenId,
  priceEth: nextPrice,
});
```

`listNFTWithWallet` 在：

```text
frontend/lib/web3/market-transactions.js
```

它做的事：

1. 检查 `tokenId`。
2. 把页面输入的 `priceEth` 转成 `priceWei`。
3. 获取 signer 和 account。
4. 调合约 `ownerOf(tokenId)`，确认当前钱包是链上 owner。
5. 调合约：

```solidity
listToken(tokenId, priceWei)
```

合约会写入：

```solidity
_listings[tokenId] = Listing({
  seller: msg.sender,
  priceWei: priceWei,
  active: true
});
```

链上确认后，前端同步后端：

```js
const updated = await updateNFTListing(nft.id, {
  priceWei: listed.priceWei,
  price: nextPrice,
  priceUnit: "ETH",
});
```

请求：

```http
PATCH /api/v1/nfts/{id}/listing
Authorization: Bearer <jwt_token>
```

后端进入：

```text
backend/internal/handler/nft.go
  -> NFTHandler.UpdateListing
backend/internal/service/nft.go
  -> NFTService.UpdateListing
```

后端用 `nftID + ownerID` 同时匹配，保证只有当前本地拥有者能更新这个 NFT 的上架价格。

## 八、下架流程

入口：

```text
frontend/app/nfts/[id]/use-nft-detail.js
  -> handleDelist()
```

前端调用：

```js
const delisted = await delistNFTWithWallet({
  contractAddress: nft.contract,
  tokenId: nft.tokenId,
});
```

`delistNFTWithWallet` 会：

1. 获取 signer/account。
2. 校验当前钱包是链上 owner。
3. 调合约：

```solidity
cancelListing(tokenId)
```

合约会：

```solidity
delete _listings[tokenId];
```

也就是删除上架信息，但不会销毁 NFT，也不会改 tokenURI。

链上确认后，前端同步后端：

```js
const updated = await updateNFTListing(nft.id, {
  priceWei: "0",
  price: 0,
  priceUnit: "ETH",
});
```

后端把本地记录改成未上架状态。

## 九、个人中心相关流程

个人中心主要读取后端数据，不直接读合约。

文件：

```text
frontend/app/profile/page.js
```

常用 API：

| 前端方法 | 后端接口 | 含义 |
| --- | --- | --- |
| `getNFTs(...)` | `GET /api/v1/nfts` | 当前市场或持有 NFT 列表 |
| `getMyBoughtOrders()` | `GET /api/v1/orders/bought` | 当前用户买入历史 |
| `getMySoldOrders()` | `GET /api/v1/orders/sold` | 当前用户卖出历史 |
| `uploadAvatar(file)` | `POST /api/v1/upload/avatar` | 上传头像 |
| `updateProfile(payload)` | `PUT /api/v1/auth/profile` | 更新昵称和头像 |

这些接口需要 JWT 的，会经过后端 `middleware.Auth(cfg)`。

## 十、关键变量对照表

| 变量/字段 | 出现位置 | 含义 |
| --- | --- | --- |
| `address` | 前端钱包状态 | 浏览器钱包当前连接的钱包地址 |
| `wallet` | 前端 API、后端 User | 用户绑定的钱包地址 |
| `nonce` | 后端 User.Nonce、前端登录流程 | 一次性登录随机数，用完清空 |
| `signature` | 前端登录请求 | 钱包对 `NovaNFT Login\nnonce: xxx` 的签名 |
| `jwt_token` | localStorage | 后端签发的登录 token |
| `current_user` | localStorage | 当前登录用户信息 |
| `userId` | JWT claims、后端 context | 后端识别当前登录用户的 ID |
| `tokenURI` / `tokenUri` | 前端、合约、后端 NFT | 写入合约的元数据 URI，通常是 `ipfs://...` |
| `metadataUri` | IPFS 上传返回 | 前端传给合约的 tokenURI |
| `metadataUrl` | IPFS 上传返回、后端 NFT | metadata 的 HTTP 网关访问地址 |
| `contract` | 后端 NFT | NFT 所属合约地址 |
| `tokenId` | 合约、前端、后端 NFT | 链上的 NFT 编号 |
| `NFT.ID` / `nft.id` | 后端数据库 | 后端自己的 NFT 主键，不等于 tokenId |
| `priceEth` | 前端页面 | 用户看到和输入的 ETH 小数 |
| `priceWei` | 前端、合约、后端 | 精确链上价格，单位 wei |
| `txHash` | 前端交易结果、后端 Order | 链上交易哈希 |
| `ownerID` | 后端 NFT | 当前拥有者的后端用户 ID |
| `seller` | 合约 Listing、订单 | 卖家钱包地址或卖家用户 ID |
| `buyer` | 合约 Purchased、订单 | 买家钱包地址或买家用户 ID |
| `royaltyReceiver` | 前端、合约、后端 NFT | 版税接收地址 |
| `royaltyFeeBps` | 前端、合约、后端 NFT | 版税比例，单位基点，100 = 1% |

## 十一、最常见的阅读路线

### 想看“连接钱包为什么要请求 nonce”

按这个顺序读：

```text
frontend/components/WalletConnectButton.js
frontend/components/wallet/useWalletLoginFlow.js
frontend/lib/wallet/login.js
frontend/lib/api.js
backend/internal/router/router.go
backend/internal/handler/auth.go
backend/internal/service/auth.go
backend/internal/model/models.go
backend/internal/middleware/auth.go
```

### 想看“创建 NFT 到底先上传还是先铸造”

按这个顺序读：

```text
frontend/app/nfts/create/page.js
frontend/lib/api.js -> uploadNFTToIPFS
backend/internal/handler/ipfs.go
backend/internal/service/ipfs.go
frontend/lib/web3/mint-transactions.js
frontend/lib/web3/contracts.js
contracts/NFTCollection.sol -> safeMint / mintAndList
frontend/lib/api.js -> createNFT
backend/internal/handler/nft.go
backend/internal/service/nft.go
backend/internal/model/models.go
```

结论：先上传 IPFS，再铸造合约，最后同步后端。

### 想看“购买 NFT 后为什么还要创建订单”

按这个顺序读：

```text
frontend/app/nfts/[id]/use-nft-detail.js -> handleBuy
frontend/lib/web3/market-transactions.js -> buyNFTWithWallet
frontend/lib/web3/contracts.js -> readListingCompat
contracts/NFTCollection.sol -> buy
frontend/lib/api.js -> createOrder
backend/internal/handler/order.go
backend/internal/service/order.go
backend/internal/model/models.go
```

结论：合约负责真正转移 NFT 和资金，后端订单负责页面展示、个人中心、交易历史。

### 想看“上架和下架为什么要前后端都做”

按这个顺序读：

```text
frontend/app/nfts/[id]/use-nft-detail.js -> handleRelist / handleDelist
frontend/lib/web3/market-transactions.js -> listNFTWithWallet / delistNFTWithWallet
contracts/NFTCollection.sol -> listToken / cancelListing
frontend/lib/api.js -> updateNFTListing
backend/internal/handler/nft.go -> UpdateListing
backend/internal/service/nft.go -> UpdateListing
```

结论：合约保存真实上架状态，后端保存页面查询用的链下镜像状态。

## 十二、一句话总流程

钱包登录：

```text
用户点连接钱包
  -> 前端连接钱包拿 address
  -> 后端生成 nonce
  -> 前端让钱包签名 nonce
  -> 后端验签并发 JWT
  -> 前端保存 jwt_token/current_user
```

创建 NFT：

```text
用户填写 NFT 信息
  -> 前端上传媒体和 metadata 到 IPFS
  -> 前端调用合约 safeMint 或 mintAndList
  -> 合约生成 tokenId 并写 tokenURI
  -> 前端解析 tokenId
  -> 前端调用后端 createNFT 保存链下记录
```

购买 NFT：

```text
用户点购买
  -> 前端读取合约 listing
  -> 前端调用合约 buy(tokenId) 并支付 priceWei
  -> 合约转移 NFT、分账、发 Purchased
  -> 前端调用后端 createOrder
  -> 后端创建订单并更新本地 NFT owner/下架状态
```

上架/下架：

```text
用户点上架或下架
  -> 前端调用合约 listToken 或 cancelListing
  -> 链上确认后
  -> 前端调用后端 updateNFTListing 同步链下展示状态
```
