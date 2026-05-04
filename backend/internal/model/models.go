// 本文件定义数据库模型：GORM 会根据这些结构体创建 users、nfts、orders 三张核心表。
package model

import "time"

// User 是登录用户表；本系统主要通过钱包地址登录，email/password 字段保留但当前不是主登录方式。
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`               // 用户主键 ID。
	Email     *string   `gorm:"uniqueIndex;size:255" json:"email"`  // 邮箱，可为空。
	Username  string    `gorm:"size:255" json:"username"`           // 页面展示的用户名。
	Avatar    string    `gorm:"size:512" json:"avatar"`             // 头像 URL。
	Password  string    `json:"-"`                                  // 密码字段不会返回给前端。
	Wallet    string    `gorm:"size:255;uniqueIndex" json:"wallet"` // 钱包地址，登录和链上身份绑定靠它。
	Nonce     string    `gorm:"size:255" json:"-"`                  // 钱包签名登录前生成的一次性随机字符串。
	CreatedAt time.Time `json:"createdAt"`                          // 用户创建时间。
}

// NFT 是后端保存的 NFT 镜像数据；链上 tokenId/contract 是它和合约 Token 对应的关键字段。
type NFT struct {
	ID              uint      `gorm:"primaryKey" json:"id"`                                                 // 后端数据库里的 NFT 主键，不等于链上 tokenId。
	Contract        string    `gorm:"size:255;not null;uniqueIndex:idx_nft_contract_token" json:"contract"` // NFT 合约地址。
	TokenID         string    `gorm:"size:255;not null;uniqueIndex:idx_nft_contract_token" json:"tokenId"`  // 合约里返回的 tokenId。
	Name            string    `gorm:"size:255" json:"name"`                                                 // NFT 名称。
	Description     string    `gorm:"size:1000" json:"description"`                                         // NFT 描述。
	ImageURL        string    `gorm:"size:1000" json:"imageUrl"`                                            // 封面图 URL；图片类 NFT 通常也是主资源。
	MediaURL        string    `gorm:"size:1000" json:"mediaUrl"`                                            // 主媒体资源 URL，可为图片、音频或视频。
	MediaType       string    `gorm:"size:50" json:"mediaType"`                                             // 媒体大类：image/audio/video。
	MimeType        string    `gorm:"size:100" json:"mimeType"`                                             // 文件 MIME 类型，例如 image/png。
	TokenURI        string    `gorm:"size:1000" json:"tokenUri"`                                            // 写入合约的 tokenURI，通常是 ipfs:// 开头的元数据地址。
	MetadataURL     string    `gorm:"size:1000" json:"metadataUrl"`                                         // 元数据的 HTTP 网关地址，方便前端直接访问。
	Storage         string    `gorm:"size:50" json:"storage"`                                               // 存储方式，例如 local 或 ipfs。
	Category        string    `gorm:"size:100;index" json:"category"`                                       // 前端分类：art/music/video/other。
	OwnerID         uint      `gorm:"index" json:"ownerId"`                                                 // 当前拥有者的后端用户 ID。
	PriceWei        string    `gorm:"size:78;type:varchar(78);not null;default:'0';index" json:"priceWei"`  // 上架价格的 wei 整数字符串，和合约 msg.value 精确对应。
	Price           float64   `json:"price"`                                                                // 给页面展示用的 ETH 小数，不用于合约精确计算。
	PriceUnit       string    `gorm:"size:20" json:"priceUnit"`                                             // 价格单位，目前固定为 ETH。
	RoyaltyReceiver string    `gorm:"size:255" json:"royaltyReceiver"`                                      // 版税接收钱包地址。
	RoyaltyFeeBps   uint16    `gorm:"default:0" json:"royaltyFeeBps"`                                       // 版税比例，单位是基点：100 = 1%。
	CreatedAt       time.Time `gorm:"index" json:"createdAt"`                                               // NFT 入库时间。
}

// Order 是成交订单表；它记录链上购买交易哈希和买卖双方，但不直接执行链上转账。
type Order struct {
	ID        uint      `gorm:"primaryKey" json:"id"`                                                // 订单主键 ID。
	NFTID     uint      `gorm:"index;uniqueIndex:idx_order_txhash_nft" json:"nftId"`                 // 成交的后端 NFT 记录 ID。
	BuyerID   uint      `gorm:"index" json:"buyerId"`                                                // 买家用户 ID。
	SellerID  uint      `gorm:"index" json:"sellerId"`                                               // 卖家用户 ID。
	PriceWei  string    `gorm:"size:78;type:varchar(78);not null;default:'0';index" json:"priceWei"` // 成交价格 wei 字符串，来自前端合约购买交易。
	Price     float64   `json:"price"`                                                               // 成交价格的 ETH 展示值。
	TxHash    string    `gorm:"size:255;not null;uniqueIndex:idx_order_txhash_nft" json:"txHash"`    // 链上交易哈希，用来证明确实发生过购买交易。
	Status    string    `gorm:"size:50" json:"status"`                                               // 订单状态，目前成功订单写 success。
	CreatedAt time.Time `gorm:"index" json:"createdAt"`                                              // 订单创建时间。
}
