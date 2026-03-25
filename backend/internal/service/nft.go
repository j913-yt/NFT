package service

import (
	"errors"
	"strings"

	"nft-backend/internal/model"
	"nft-backend/internal/util"

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
			query = query.Where("price_wei IS NOT NULL AND price_wei <> '' AND price_wei <> ?", "0")
		} else {
			query = query.Where("price_wei IS NULL OR price_wei = '' OR price_wei = ?", "0")
		}
	}
	if err := query.Find(&nfts).Error; err != nil {
		return nil, err
	}
	return nfts, nil
}

func (s *NFTService) Create(nft *model.NFT) error {
	priceWei, displayPrice, err := util.ResolveWeiAndDisplay(nft.PriceWei, nft.Price)
	if err != nil {
		return err
	}

	nft.PriceWei = priceWei
	nft.Price = displayPrice
	if nft.PriceUnit == "" {
		nft.PriceUnit = "ETH"
	}
	if nft.RoyaltyFeeBps == 0 {
		nft.RoyaltyReceiver = ""
	}

	return s.db.Create(nft).Error
}

func (s *NFTService) GetByID(id uint) (*model.NFT, error) {
	var nft model.NFT
	if err := s.db.First(&nft, id).Error; err != nil {
		return nil, err
	}
	return &nft, nil
}

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
		"price_wei":  "0",
		"price":      0,
		"price_unit": "ETH",
	}).Error
}

func (s *NFTService) UpdateListing(nftID uint, ownerID uint, priceWei string) (*model.NFT, error) {
	if nftID == 0 || ownerID == 0 {
		return nil, errors.New("参数错误")
	}

	normalizedWei, err := util.NormalizeWeiString(priceWei)
	if err != nil {
		return nil, errors.New("priceWei 必须是非负整数")
	}

	displayPrice := util.DisplayETHFromWeiString(normalizedWei)

	res := s.db.Model(&model.NFT{}).Where("id = ? AND owner_id = ?", nftID, ownerID).Updates(map[string]interface{}{
		"price_wei":  normalizedWei,
		"price":      displayPrice,
		"price_unit": "ETH",
	})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, errors.New("无权限更新该 NFT 上架信息")
	}

	return s.GetByID(nftID)
}

func NormalizeNFTCategory(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
