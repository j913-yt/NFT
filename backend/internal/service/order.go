// 本文件实现订单业务：记录链上购买成功后的订单、更新 NFT 拥有者，并查询买卖双方交易列表。
package service

import (
	"errors"
	"strings"
	"time"

	"nft-backend/internal/model"
	"nft-backend/internal/util"

	"gorm.io/gorm"
)

// OrderService 负责订单表读写，并在成交时联动 NFTService。
type OrderService struct {
	db     *gorm.DB    // db 是 GORM 数据库连接。
	nftSvc *NFTService // nftSvc 用来读取 NFT 信息和校验当前拥有者。
}

// SoldOrderItem 是“我卖出的”订单列表项，包含订单、NFT 和买家信息。
type SoldOrderItem struct {
	ID           uint      `json:"id"`           // 订单 ID。
	NFTID        uint      `json:"nftId"`        // 成交的后端 NFT.ID。
	NFTName      string    `json:"nftName"`      // NFT 名称。
	NFTImageURL  string    `json:"nftImageUrl"`  // NFT 封面图 URL。
	NFTMediaURL  string    `json:"nftMediaUrl"`  // NFT 主媒体 URL。
	NFTMediaType string    `json:"nftMediaType"` // NFT 媒体大类。
	NFTTokenID   string    `json:"nftTokenId"`   // 链上 tokenId。
	BuyerID      uint      `json:"buyerId"`      // 买家用户 ID。
	BuyerWallet  string    `json:"buyerWallet"`  // 买家钱包地址。
	BuyerName    string    `json:"buyerName"`    // 买家昵称。
	PriceWei     string    `json:"priceWei"`     // 成交价格 wei 字符串。
	Price        float64   `json:"price"`        // 成交价格 ETH 展示值。
	TxHash       string    `json:"txHash"`       // 链上购买交易哈希。
	Status       string    `json:"status"`       // 订单状态。
	CreatedAt    time.Time `json:"createdAt"`    // 成交记录创建时间。
}

// BoughtOrderItem 是“我购入的”订单列表项，包含订单、NFT 和卖家信息。
type BoughtOrderItem struct {
	ID           uint      `json:"id"`           // 订单 ID。
	NFTID        uint      `json:"nftId"`        // 成交的后端 NFT.ID。
	NFTName      string    `json:"nftName"`      // NFT 名称。
	NFTImageURL  string    `json:"nftImageUrl"`  // NFT 封面图 URL。
	NFTMediaURL  string    `json:"nftMediaUrl"`  // NFT 主媒体 URL。
	NFTMediaType string    `json:"nftMediaType"` // NFT 媒体大类。
	NFTTokenID   string    `json:"nftTokenId"`   // 链上 tokenId。
	SellerID     uint      `json:"sellerId"`     // 卖家用户 ID。
	SellerWallet string    `json:"sellerWallet"` // 卖家钱包地址。
	SellerName   string    `json:"sellerName"`   // 卖家昵称。
	PriceWei     string    `json:"priceWei"`     // 成交价格 wei 字符串。
	Price        float64   `json:"price"`        // 成交价格 ETH 展示值。
	TxHash       string    `json:"txHash"`       // 链上购买交易哈希。
	Status       string    `json:"status"`       // 订单状态。
	CreatedAt    time.Time `json:"createdAt"`    // 成交记录创建时间。
}

// NFTOrderHistoryItem 是 NFT 详情页交易历史列表项，包含买卖双方信息。
type NFTOrderHistoryItem struct {
	ID           uint      `json:"id"`           // 订单 ID。
	NFTID        uint      `json:"nftId"`        // 后端 NFT.ID。
	PriceWei     string    `json:"priceWei"`     // 成交价格 wei 字符串。
	Price        float64   `json:"price"`        // 成交价格 ETH 展示值。
	TxHash       string    `json:"txHash"`       // 链上购买交易哈希。
	Status       string    `json:"status"`       // 订单状态。
	CreatedAt    time.Time `json:"createdAt"`    // 成交记录创建时间。
	BuyerID      uint      `json:"buyerId"`      // 买家用户 ID。
	BuyerWallet  string    `json:"buyerWallet"`  // 买家钱包地址。
	BuyerName    string    `json:"buyerName"`    // 买家昵称。
	SellerID     uint      `json:"sellerId"`     // 卖家用户 ID。
	SellerWallet string    `json:"sellerWallet"` // 卖家钱包地址。
	SellerName   string    `json:"sellerName"`   // 卖家昵称。
}

// NewOrderService 创建订单服务。
func NewOrderService(db *gorm.DB, nftSvc *NFTService) *OrderService {
	return &OrderService{db: db, nftSvc: nftSvc}
}

// CreateOrder 在前端链上购买交易成功后创建订单，并把本地 NFT 拥有者改成买家。
func (s *OrderService) CreateOrder(buyerID uint, nftID uint, priceWei string, txHash string) (*model.Order, error) {
	if buyerID == 0 || nftID == 0 {
		return nil, errors.New("参数错误")
	}

	// txHash 是链上交易哈希，是证明购买交易已发生的关键字段。
	txHash = strings.TrimSpace(txHash)
	if txHash == "" || !strings.HasPrefix(strings.ToLower(txHash), "0x") {
		return nil, errors.New("缺少有效链上交易哈希")
	}

	// nft 是要购买的 NFT 本地镜像记录。
	nft, err := s.nftSvc.GetByID(nftID)
	if err != nil {
		return nil, errors.New("NFT 不存在")
	}
	if nft.OwnerID == buyerID {
		return nil, errors.New("不能购买自己的 NFT")
	}

	// normalizedWei 是本次成交价格；无效或为 0 时使用 NFT 当前上架价。
	normalizedWei, err := util.NormalizeWeiString(priceWei)
	if err != nil || normalizedWei == "0" {
		normalizedWei = util.MustNormalizeWeiString(nft.PriceWei)
	}
	if normalizedWei == "0" {
		return nil, errors.New("NFT 未设置有效价格")
	}

	// sellerID 是交易发生前的 NFT 拥有者。
	sellerID := nft.OwnerID
	// order 是要插入 orders 表的成交记录。
	order := &model.Order{
		NFTID:    nftID,
		BuyerID:  buyerID,
		SellerID: sellerID,
		PriceWei: normalizedWei,
		Price:    util.DisplayETHFromWeiString(normalizedWei),
		TxHash:   txHash,
		Status:   "success",
	}

	// Transaction 确保“创建订单”和“转移本地拥有者/下架”要么都成功，要么都回滚。
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(order).Error; err != nil {
			return err
		}

		// res 使用旧 ownerID 作为条件，避免并发下同一个 NFT 被重复购买。
		res := tx.Model(&model.NFT{}).
			Where("id = ? AND owner_id = ?", nftID, sellerID).
			Updates(map[string]interface{}{
				"owner_id":   buyerID,
				"price_wei":  "0",
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

// ListSoldOrders 查询某个用户卖出的订单，返回带买家和 NFT 信息的列表。
func (s *OrderService) ListSoldOrders(sellerID uint) ([]SoldOrderItem, error) {
	if sellerID == 0 {
		return nil, errors.New("参数错误")
	}

	// rows 接收 SQL join 后的结果。
	var rows []SoldOrderItem
	err := s.db.
		Table("orders AS o").
		Select(`
			o.id,
			o.nft_id,
			o.buyer_id,
			o.price_wei,
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
		// orders 是主表，nfts 提供作品信息，users AS b 提供买家信息。
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

// ListBoughtOrders 查询某个用户购入的订单，返回带卖家和 NFT 信息的列表。
func (s *OrderService) ListBoughtOrders(buyerID uint) ([]BoughtOrderItem, error) {
	if buyerID == 0 {
		return nil, errors.New("参数错误")
	}

	// rows 接收 SQL join 后的结果。
	var rows []BoughtOrderItem
	err := s.db.
		Table("orders AS o").
		Select(`
			o.id,
			o.nft_id,
			o.seller_id,
			o.price_wei,
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
		// orders 是主表，nfts 提供作品信息，users AS s 提供卖家信息。
		Joins("LEFT JOIN nfts AS n ON n.id = o.nft_id").
		Joins("LEFT JOIN users AS s ON s.id = o.seller_id").
		Where("o.buyer_id = ?", buyerID).
		Order("o.id DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

// ListByNFTID 查询某个 NFT 的全部成交历史。
func (s *OrderService) ListByNFTID(nftID uint) ([]NFTOrderHistoryItem, error) {
	if nftID == 0 {
		return nil, errors.New("参数错误")
	}

	// rows 接收 SQL join 后的结果。
	var rows []NFTOrderHistoryItem
	err := s.db.
		Table("orders AS o").
		Select(`
			o.id,
			o.nft_id,
			o.price_wei,
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
		// users AS b/s 分别补充买家和卖家的钱包、昵称信息。
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
