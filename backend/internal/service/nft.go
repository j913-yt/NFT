// 本文件实现 NFT 链下数据业务：列表筛选、创建镜像记录、查询详情、更新拥有者和上架价格。
package service

import (
	"errors"
	"strings"

	"nft-backend/internal/model"
	"nft-backend/internal/util"

	"gorm.io/gorm"
)

// NFTService 负责 NFT 数据库读写，并记录当前启用的合约地址。
type NFTService struct {
	db             *gorm.DB // db 是 GORM 数据库连接。
	activeContract string   // activeContract 是当前正在使用的 NFT 合约地址，用于过滤旧合约数据。
}

// NewNFTService 创建 NFT 服务。
func NewNFTService(db *gorm.DB, activeContract string) *NFTService {
	return &NFTService{
		db:             db,
		activeContract: strings.TrimSpace(activeContract),
	}
}

// List 查询 NFT 列表；可按分类、当前合约地址和上架状态过滤。
func (s *NFTService) List(category string, listedOnly *bool) ([]model.NFT, error) {
	// nfts 是查询结果，按 id 倒序让新创建的 NFT 排在前面。
	var nfts []model.NFT
	// query 是逐步拼接的 GORM 查询。
	query := s.db.Order("id desc")
	if s.activeContract != "" {
		query = query.Where("contract = ?", s.activeContract)
	}
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

// Create 保存 NFT 链下镜像记录；这里不调用合约，只保存前端合约交易后的结果。
func (s *NFTService) Create(nft *model.NFT) error {
	// priceWei 是精确 wei 字符串，displayPrice 是 ETH 展示值。
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

// GetByID 根据后端 NFT.ID 查询 NFT 记录。
func (s *NFTService) GetByID(id uint) (*model.NFT, error) {
	// nft 是数据库中的 NFT 镜像记录。
	var nft model.NFT
	if err := s.db.First(&nft, id).Error; err != nil {
		return nil, err
	}
	return &nft, nil
}

// GetWithOwner 查询 NFT 详情，同时尽量查出当前拥有者用户。
func (s *NFTService) GetWithOwner(id uint) (*model.NFT, *model.User, error) {
	// nft 是数据库中的 NFT 镜像记录。
	var nft model.NFT
	if err := s.db.First(&nft, id).Error; err != nil {
		return nil, nil, err
	}

	// owner 是 nft.OwnerID 对应的用户；历史数据可能找不到 owner。
	var owner model.User
	if err := s.db.First(&owner, nft.OwnerID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &nft, nil, nil
		}
		return nil, nil, err
	}

	return &nft, &owner, nil
}

// UpdateOwnerAndDelist 把 NFT 拥有者改成新用户并下架；成交后使用。
func (s *NFTService) UpdateOwnerAndDelist(id uint, ownerID uint) error {
	return s.db.Model(&model.NFT{}).Where("id = ?", id).Updates(map[string]interface{}{
		"owner_id":   ownerID,
		"price_wei":  "0",
		"price":      0,
		"price_unit": "ETH",
	}).Error
}

// UpdateListing 更新 NFT 的链下上架价格；priceWei 为 "0" 时表示下架。
func (s *NFTService) UpdateListing(nftID uint, ownerID uint, priceWei string) (*model.NFT, error) {
	if nftID == 0 || ownerID == 0 {
		return nil, errors.New("参数错误")
	}

	// normalizedWei 是规范化后的上架价格，必须是非负 wei 整数字符串。
	normalizedWei, err := util.NormalizeWeiString(priceWei)
	if err != nil {
		return nil, errors.New("priceWei 必须是非负整数")
	}

	// displayPrice 是前端显示用的 ETH 小数。
	displayPrice := util.DisplayETHFromWeiString(normalizedWei)

	// res 会根据 nftID 和 ownerID 同时匹配，防止非拥有者修改别人的 NFT 上架状态。
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

// NormalizeNFTCategory 统一 NFT 分类格式。
func NormalizeNFTCategory(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
