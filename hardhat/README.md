## Hardhat 部署（Ethereum Sepolia / 11155111）

### 1) 安装依赖

在项目根目录打开 PowerShell：

```powershell
cd D:\AStudy\NFT\hardhat
npm install
```

### 2) 配置环境变量

复制 `env.example` 为 `.env`，并填入：

- `SEPOLIA_RPC_URL`: 你的 Sepolia RPC（Alchemy / Infura / QuickNode 等）
- `DEPLOYER_PRIVATE_KEY`: 部署钱包私钥（**不要带 `0x`**）

> 注意：不要把私钥提交到 git。

### 3) 编译

```powershell
npm run compile
```

### 4) 部署到 Ethereum Sepolia

```powershell
npm run deploy:sepolia
```

部署成功后终端会输出：

```text
NFTCollection deployed to: 0x......
```

### 5) 把合约地址写入前端

在 `D:\AStudy\NFT\frontend\.env.local` 写入：

```text
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x你的合约地址
```

然后重启前端：

```powershell
cd D:\AStudy\NFT\frontend
npm run dev
```

