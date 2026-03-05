package service

import (
	"errors"

	"nft-backend/internal/model"

	"gorm.io/gorm"
)

type NFTService struct {
	db *gorm.DB
}

func NewNFTService(db *gorm.DB) *NFTService {
	return &NFTService{db: db}
}

func (s *NFTService) List(category string) ([]model.NFT, error) {
	var nfts []model.NFT
	query := s.db.Order("id desc")
	if category != "" {
		query = query.Where("category = ?", category)
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

// GetWithOwner 返回 NFT 以及拥有者信息（如果存在）。
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

func (s *NFTService) UpdateOwner(id uint, ownerID uint) error {
	return s.db.Model(&model.NFT{}).Where("id = ?", id).Update("owner_id", ownerID).Error
}
