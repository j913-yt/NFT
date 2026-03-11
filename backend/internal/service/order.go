package service

import (
	"errors"
	"strings"
	"time"

	"nft-backend/internal/model"

	"gorm.io/gorm"
)

type OrderService struct {
	db     *gorm.DB
	nftSvc *NFTService
}

type SoldOrderItem struct {
	ID           uint      `json:"id"`
	NFTID        uint      `json:"nftId"`
	NFTName      string    `json:"nftName"`
	NFTImageURL  string    `json:"nftImageUrl"`
	NFTMediaURL  string    `json:"nftMediaUrl"`
	NFTMediaType string    `json:"nftMediaType"`
	NFTTokenID   string    `json:"nftTokenId"`
	BuyerID      uint      `json:"buyerId"`
	BuyerWallet  string    `json:"buyerWallet"`
	BuyerName    string    `json:"buyerName"`
	Price        float64   `json:"price"`
	TxHash       string    `json:"txHash"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
}

type BoughtOrderItem struct {
	ID           uint      `json:"id"`
	NFTID        uint      `json:"nftId"`
	NFTName      string    `json:"nftName"`
	NFTImageURL  string    `json:"nftImageUrl"`
	NFTMediaURL  string    `json:"nftMediaUrl"`
	NFTMediaType string    `json:"nftMediaType"`
	NFTTokenID   string    `json:"nftTokenId"`
	SellerID     uint      `json:"sellerId"`
	SellerWallet string    `json:"sellerWallet"`
	SellerName   string    `json:"sellerName"`
	Price        float64   `json:"price"`
	TxHash       string    `json:"txHash"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
}

type NFTOrderHistoryItem struct {
	ID           uint      `json:"id"`
	NFTID        uint      `json:"nftId"`
	Price        float64   `json:"price"`
	TxHash       string    `json:"txHash"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	BuyerID      uint      `json:"buyerId"`
	BuyerWallet  string    `json:"buyerWallet"`
	BuyerName    string    `json:"buyerName"`
	SellerID     uint      `json:"sellerId"`
	SellerWallet string    `json:"sellerWallet"`
	SellerName   string    `json:"sellerName"`
}

func NewOrderService(db *gorm.DB, nftSvc *NFTService) *OrderService {
	return &OrderService{db: db, nftSvc: nftSvc}
}

// CreateOrder creates an order and syncs backend ownership/listing after a successful on-chain tx hash is provided.
func (s *OrderService) CreateOrder(buyerID uint, nftID uint, price float64, txHash string) (*model.Order, error) {
	if buyerID == 0 || nftID == 0 {
		return nil, errors.New("参数错误")
	}

	txHash = strings.TrimSpace(txHash)
	if txHash == "" || !strings.HasPrefix(strings.ToLower(txHash), "0x") {
		return nil, errors.New("缺少有效链上交易哈希")
	}

	nft, err := s.nftSvc.GetByID(nftID)
	if err != nil {
		return nil, errors.New("NFT 不存在")
	}

	if nft.OwnerID == buyerID {
		return nil, errors.New("不能购买自己的 NFT")
	}

	if price <= 0 {
		price = nft.Price
	}
	if price <= 0 {
		return nil, errors.New("NFT 未设置有效价格")
	}

	sellerID := nft.OwnerID
	order := &model.Order{
		NFTID:    nftID,
		BuyerID:  buyerID,
		SellerID: sellerID,
		Price:    price,
		TxHash:   txHash,
		Status:   "success",
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		res := tx.Model(&model.NFT{}).
			Where("id = ? AND owner_id = ?", nftID, sellerID).
			Updates(map[string]interface{}{
				"owner_id":   buyerID,
				"price":      0,
				"price_unit": "ETH",
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("NFT 所有权已变化，请刷新后重试")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return order, nil
}

func (s *OrderService) ListSoldOrders(sellerID uint) ([]SoldOrderItem, error) {
	if sellerID == 0 {
		return nil, errors.New("参数错误")
	}

	var rows []SoldOrderItem
	err := s.db.
		Table("orders AS o").
		Select(`
			o.id,
			o.nft_id,
			o.buyer_id,
			o.price,
			o.tx_hash,
			o.status,
			o.created_at,
			n.name AS nft_name,
			n.image_url AS nft_image_url,
			n.media_url AS nft_media_url,
			n.media_type AS nft_media_type,
			n.token_id AS nft_token_id,
			b.wallet AS buyer_wallet,
			b.username AS buyer_name
		`).
		Joins("LEFT JOIN nfts AS n ON n.id = o.nft_id").
		Joins("LEFT JOIN users AS b ON b.id = o.buyer_id").
		Where("o.seller_id = ?", sellerID).
		Order("o.id DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *OrderService) ListBoughtOrders(buyerID uint) ([]BoughtOrderItem, error) {
	if buyerID == 0 {
		return nil, errors.New("参数错误")
	}

	var rows []BoughtOrderItem
	err := s.db.
		Table("orders AS o").
		Select(`
			o.id,
			o.nft_id,
			o.seller_id,
			o.price,
			o.tx_hash,
			o.status,
			o.created_at,
			n.name AS nft_name,
			n.image_url AS nft_image_url,
			n.media_url AS nft_media_url,
			n.media_type AS nft_media_type,
			n.token_id AS nft_token_id,
			s.wallet AS seller_wallet,
			s.username AS seller_name
		`).
		Joins("JOIN nfts AS n ON n.id = o.nft_id AND n.owner_id = ?", buyerID).
		Joins("LEFT JOIN users AS s ON s.id = o.seller_id").
		Where("o.buyer_id = ?", buyerID).
		Order("o.id DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *OrderService) ListByNFTID(nftID uint) ([]NFTOrderHistoryItem, error) {
	if nftID == 0 {
		return nil, errors.New("参数错误")
	}

	var rows []NFTOrderHistoryItem
	err := s.db.
		Table("orders AS o").
		Select(`
			o.id,
			o.nft_id,
			o.price,
			o.tx_hash,
			o.status,
			o.created_at,
			o.buyer_id,
			o.seller_id,
			b.wallet AS buyer_wallet,
			b.username AS buyer_name,
			s.wallet AS seller_wallet,
			s.username AS seller_name
		`).
		Joins("LEFT JOIN users AS b ON b.id = o.buyer_id").
		Joins("LEFT JOIN users AS s ON s.id = o.seller_id").
		Where("o.nft_id = ?", nftID).
		Order("o.id DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}
