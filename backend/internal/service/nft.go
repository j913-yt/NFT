package service

import (
	"errors"
	"strings"

	"nft-backend/internal/model"

	"gorm.io/gorm"
)

type NFTService struct {
	db *gorm.DB
}

func NewNFTService(db *gorm.DB) *NFTService {
	return &NFTService{db: db}
}

func (s *NFTService) List(category string, listedOnly *bool) ([]model.NFT, error) {
	var nfts []model.NFT
	query := s.db.Order("id desc")
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if listedOnly != nil {
		if *listedOnly {
			query = query.Where("price > 0")
		} else {
			query = query.Where("price <= 0")
		}
	}
	if err := query.Find(&nfts).Error; err != nil {
		return nil, err
	}
	return nfts, nil
}

func (s *NFTService) Create(nft *model.NFT) error {
	return s.db.Create(nft).Error
}

func (s *NFTService) GetByID(id uint) (*model.NFT, error) {
	var nft model.NFT
	if err := s.db.First(&nft, id).Error; err != nil {
		return nil, err
	}
	return &nft, nil
}

// GetWithOwner returns NFT and owner profile if exists.
func (s *NFTService) GetWithOwner(id uint) (*model.NFT, *model.User, error) {
	var nft model.NFT
	if err := s.db.First(&nft, id).Error; err != nil {
		return nil, nil, err
	}

	var owner model.User
	if err := s.db.First(&owner, nft.OwnerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &nft, nil, nil
		}
		return nil, nil, err
	}

	return &nft, &owner, nil
}

func (s *NFTService) UpdateOwnerAndDelist(id uint, ownerID uint) error {
	return s.db.Model(&model.NFT{}).Where("id = ?", id).Updates(map[string]interface{}{
		"owner_id":   ownerID,
		"price":      0,
		"price_unit": "ETH",
	}).Error
}

func (s *NFTService) UpdateListing(nftID uint, ownerID uint, price float64, priceUnit string) (*model.NFT, error) {
	if nftID == 0 || ownerID == 0 {
		return nil, errors.New("参数错误")
	}
	if price < 0 {
		return nil, errors.New("价格不能小于 0")
	}

	priceUnit = strings.ToUpper(strings.TrimSpace(priceUnit))
	if priceUnit == "" {
		priceUnit = "ETH"
	}

	res := s.db.Model(&model.NFT{}).Where("id = ? AND owner_id = ?", nftID, ownerID).Updates(map[string]interface{}{
		"price":      price,
		"price_unit": priceUnit,
	})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, errors.New("无权限更新该 NFT 上架信息")
	}

	return s.GetByID(nftID)
}
