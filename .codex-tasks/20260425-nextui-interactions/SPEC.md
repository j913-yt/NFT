# NextUI Interaction Upgrade

## Goal

在当前 `frontend` 引入与参考项目兼容的 NextUI 组件体系，并围绕首页、市场、NFT 卡片、筛选、详情/创建/个人中心等功能点增加更完整的交互反馈与动画体验。

## Dependency Decision

- 当前项目: React 18.3.1 + Next.js 14.2.5 + Tailwind CSS 3.4。
- HeroUI 3.x 要求 React 19 和 Tailwind 4，不适合当前项目。
- 采用参考项目同路线的 `@nextui-org/react` 2.x，当前 npm 版本为 `2.6.11`。
- `@nextui-org/react@2.6.11` peer dependency 要求 `framer-motion >=11.5.6`，需一起安装。

## Scope

- 配置 `NextUIProvider` 和 Tailwind `nextui()` 插件。
- 保留当前业务逻辑和接口调用，不改后端、合约、钱包交易逻辑。
- 用 NextUI 替换适合的通用交互组件：Button、Card、Chip、Tabs、Input、Select、Checkbox、Tooltip、Skeleton、Modal、Progress 等。
- 增强关键状态：加载、空态、收藏、筛选、交易进度、创建流程、资料页 tab 等。
- 不添加模拟成功、兜底交易或静默降级。

## Validation

- `npm run lint`
- `npm run build`
- 本地访问 `/`、`/nfts`、`/nfts/create`、`/profile` 返回 200 或清晰错误。

