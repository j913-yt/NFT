package model

import "time"

// User 表示平台用户
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Email     *string   `gorm:"uniqueIndex;size:255" json:"email"`
	Username  string    `gorm:"size:255" json:"username"`
	Avatar    string    `gorm:"size:512" json:"avatar"`
	Password  string    `json:"-"` // 加密后的密码，不返回给前端
	Wallet    string    `gorm:"size:255;uniqueIndex" json:"wallet"`
	Nonce     string    `gorm:"size:255" json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

// NFT 表示一个 NFT 资产的链下记录
type NFT struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Contract    string    `gorm:"size:255" json:"contract"`
	TokenID     string    `gorm:"size:255" json:"tokenId"`
	Name        string    `gorm:"size:255" json:"name"`
	Description string    `gorm:"size:1000" json:"description"`
	ImageURL    string    `gorm:"size:1000" json:"imageUrl"`
	TokenURI    string    `gorm:"size:1000" json:"tokenUri"`
	Category    string    `gorm:"size:100" json:"category"`
	OwnerID     uint      `json:"ownerId"`
	Price       float64   `json:"price"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Order 表示一次 NFT 交易订单
type Order struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	NFTID     uint      `json:"nftId"`
	BuyerID   uint      `json:"buyerId"`
	SellerID  uint      `json:"sellerId"`
	Price     float64   `json:"price"`
	TxHash    string    `gorm:"size:255" json:"txHash"`
	Status    string    `gorm:"size:50" json:"status"` // pending / success / failed
	CreatedAt time.Time `json:"createdAt"`
}

