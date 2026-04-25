# NFT 项目数据库 E-R 图

说明：本图依据项目当前数据库模型生成，核心实体来自 `backend/internal/model/models.go`，包含 `users`、`nfts`、`orders` 三张表。

```mermaid
erDiagram
    USERS {
        uint id PK
        string email UK "nullable"
        string username
        string avatar
        string password
        string wallet UK
        string nonce
        datetime created_at
    }

    NFTS {
        uint id PK
        string contract "unique with token_id"
        string token_id "unique with contract"
        string name
        string description
        string image_url
        string media_url
        string media_type
        string mime_type
        string token_uri
        string metadata_url
        string storage
        string category
        uint owner_id FK
        string price_wei
        float price
        string price_unit
        string royalty_receiver
        uint16 royalty_fee_bps
        datetime created_at
    }

    ORDERS {
        uint id PK
        uint nft_id FK
        uint buyer_id FK
        uint seller_id FK
        string price_wei
        float price
        string tx_hash "unique with nft_id"
        string status
        datetime created_at
    }

    USERS ||--o{ NFTS : owns
    USERS ||--o{ ORDERS : buys
    USERS ||--o{ ORDERS : sells
    NFTS ||--o{ ORDERS : has_trade_history
```

## 关系说明

1. `USERS` 与 `NFTS` 是一对多关系。
   `nfts.owner_id` 指向 `users.id`，表示一个用户可以拥有多个 NFT。

2. `USERS` 与 `ORDERS` 有两组一对多关系。
   `orders.buyer_id` 指向 `users.id`，表示用户作为买家参与的订单。
   `orders.seller_id` 指向 `users.id`，表示用户作为卖家参与的订单。

3. `NFTS` 与 `ORDERS` 是一对多关系。
   `orders.nft_id` 指向 `nfts.id`，表示一个 NFT 在历史上可以对应多笔成交订单。

## 约束说明

1. `users.wallet` 为唯一索引。
2. `users.email` 为唯一索引，但允许为空。
3. `nfts.contract + nfts.token_id` 构成联合唯一索引，用于唯一标识某个链上 NFT。
4. `orders.nft_id + orders.tx_hash` 构成联合唯一索引，用于避免同一 NFT 的同一链上交易重复入库。
