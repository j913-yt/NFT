package service

import (
	"errors"

	"nft-backend/internal/model"

	"gorm.io/gorm"
)

type OrderService struct {
	db     *gorm.DB
	nftSvc *NFTService
}

func NewOrderService(db *gorm.DB, nftSvc *NFTService) *OrderService {
	return &OrderService{db: db, nftSvc: nftSvc}
}

// CreateOrder creates an order and (for demo) marks it as success and transfers NFT ownership off-chain.
func (s *OrderService) CreateOrder(buyerID uint, nftID uint, price float64, txHash string) (*model.Order, error) {
	if buyerID == 0 || nftID == 0 {
		return nil, errors.New("参数错误")
	}

	nft, err := s.nftSvc.GetByID(nftID)
	if err != nil {
		return nil, errors.New("NFT 不存在")
	}

	if nft.OwnerID == buyerID {
		return nil, errors.New("不能购买自己的 NFT")
	}

	sellerID := nft.OwnerID
	if price <= 0 {
		price = nft.Price
	}

	order := &model.Order{
		NFTID:    nftID,
		BuyerID:  buyerID,
		SellerID: sellerID,
		Price:    price,
		TxHash:   txHash,
		Status:   "success", // demo: 直接成功，后续接链上确认可改为 pending->success
	}

	if err := s.db.Create(order).Error; err != nil {
		return nil, err
	}

	// demo: 直接把 NFT owner 更新为买家
	if err := s.nftSvc.UpdateOwner(nftID, buyerID); err != nil {
		return nil, err
	}

	return order, nil
}

