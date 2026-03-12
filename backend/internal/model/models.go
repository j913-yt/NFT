package model

import "time"

type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Email     *string   `gorm:"uniqueIndex;size:255" json:"email"`
	Username  string    `gorm:"size:255" json:"username"`
	Avatar    string    `gorm:"size:512" json:"avatar"`
	Password  string    `json:"-"`
	Wallet    string    `gorm:"size:255;uniqueIndex" json:"wallet"`
	Nonce     string    `gorm:"size:255" json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

type NFT struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Contract    string    `gorm:"size:255;not null;uniqueIndex:idx_nft_contract_token" json:"contract"`
	TokenID     string    `gorm:"size:255;not null;uniqueIndex:idx_nft_contract_token" json:"tokenId"`
	Name        string    `gorm:"size:255" json:"name"`
	Description string    `gorm:"size:1000" json:"description"`
	ImageURL    string    `gorm:"size:1000" json:"imageUrl"`
	MediaURL    string    `gorm:"size:1000" json:"mediaUrl"`
	MediaType   string    `gorm:"size:50" json:"mediaType"`
	MimeType    string    `gorm:"size:100" json:"mimeType"`
	TokenURI    string    `gorm:"size:1000" json:"tokenUri"`
	MetadataURL string    `gorm:"size:1000" json:"metadataUrl"`
	Storage     string    `gorm:"size:50" json:"storage"`
	Category    string    `gorm:"size:100;index" json:"category"`
	OwnerID     uint      `gorm:"index" json:"ownerId"`
	PriceWei    string    `gorm:"size:78;type:varchar(78);not null;default:'0';index" json:"priceWei"`
	Price       float64   `json:"price"`
	PriceUnit   string    `gorm:"size:20" json:"priceUnit"`
	CreatedAt   time.Time `gorm:"index" json:"createdAt"`
}

type Order struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	NFTID     uint      `gorm:"index;uniqueIndex:idx_order_txhash_nft" json:"nftId"`
	BuyerID   uint      `gorm:"index" json:"buyerId"`
	SellerID  uint      `gorm:"index" json:"sellerId"`
	PriceWei  string    `gorm:"size:78;type:varchar(78);not null;default:'0';index" json:"priceWei"`
	Price     float64   `json:"price"`
	TxHash    string    `gorm:"size:255;not null;uniqueIndex:idx_order_txhash_nft" json:"txHash"`
	Status    string    `gorm:"size:50" json:"status"`
	CreatedAt time.Time `gorm:"index" json:"createdAt"`
}
