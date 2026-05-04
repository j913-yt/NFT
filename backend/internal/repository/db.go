// 本文件负责数据库连接和表结构初始化：创建数据库、自动迁移表，并修正历史价格字段。
package repository

import (
	"fmt"
	"log"
	"math"
	"strings"

	"nft-backend/internal/config"
	"nft-backend/internal/model"
	"nft-backend/internal/util"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// NewDB 初始化 MySQL 连接，确保数据库存在，迁移表结构，并补齐历史数据里的 wei 价格字段。
func NewDB(cfg *config.Config) *gorm.DB {
	// dsnNoDB 是不带数据库名的连接串，用来先连上 MySQL 服务器本身。
	dsnNoDB := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort)
	// serverDB 是服务器级连接，只用于创建数据库。
	serverDB, err := gorm.Open(mysql.Open(dsnNoDB), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	// cfg.MySQLDB 是项目实际使用的数据库名；这里不存在就自动创建。
	if err := serverDB.Exec("CREATE DATABASE IF NOT EXISTS `" + cfg.MySQLDB + "` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;").Error; err != nil {
		log.Fatalf("failed to create database: %v", err)
	}

	// dsn 是带数据库名的正式连接串，业务读写都会使用这个连接。
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort, cfg.MySQLDB)
	// db 是 GORM 数据库对象，后续会注入到 service 层。
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	// AutoMigrate 会根据 model 结构自动创建或更新 users、nfts、orders 表。
	if err := db.AutoMigrate(&model.User{}, &model.NFT{}, &model.Order{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// backfillWeiColumns 处理旧数据，确保 priceWei 和 price 展示值保持一致。
	if err := backfillWeiColumns(db); err != nil {
		log.Fatalf("failed to backfill wei columns: %v", err)
	}

	return db
}

// backfillWeiColumns 把历史记录中的 ETH 小数价格转换为 wei 字符串，避免新旧价格字段不一致。
func backfillWeiColumns(db *gorm.DB) error {
	// nfts 是所有 NFT 记录；逐条检查价格字段是否需要补齐。
	var nfts []model.NFT
	if err := db.Find(&nfts).Error; err != nil {
		return err
	}
	for _, nft := range nfts {
		// priceWei 是规范化后的 wei 整数字符串，displayPrice 是对应的 ETH 展示值。
		priceWei, displayPrice, err := normalizeStoredPrice(nft.PriceWei, nft.Price)
		if err != nil {
			return err
		}

		// updates 只保存真正需要更新的字段，避免无意义写库。
		updates := map[string]interface{}{}
		if strings.TrimSpace(nft.PriceWei) == "" || priceWei != util.MustNormalizeWeiString(nft.PriceWei) {
			updates["price_wei"] = priceWei
		}
		if math.Abs(nft.Price-displayPrice) > 1e-18 {
			updates["price"] = displayPrice
		}
		if nft.PriceUnit == "" {
			updates["price_unit"] = "ETH"
		}

		if len(updates) == 0 {
			continue
		}
		if err := db.Model(&model.NFT{}).Where("id = ?", nft.ID).Updates(updates).Error; err != nil {
			return err
		}
	}

	// orders 是所有订单记录；订单成交价格也要保持 wei 和 ETH 展示值一致。
	var orders []model.Order
	if err := db.Find(&orders).Error; err != nil {
		return err
	}
	for _, order := range orders {
		// priceWei/displayPrice 的含义和 NFT 记录一致。
		priceWei, displayPrice, err := normalizeStoredPrice(order.PriceWei, order.Price)
		if err != nil {
			return err
		}

		// updates 收集本订单需要修正的价格字段。
		updates := map[string]interface{}{}
		if strings.TrimSpace(order.PriceWei) == "" || priceWei != util.MustNormalizeWeiString(order.PriceWei) {
			updates["price_wei"] = priceWei
		}
		if math.Abs(order.Price-displayPrice) > 1e-18 {
			updates["price"] = displayPrice
		}

		if len(updates) == 0 {
			continue
		}
		if err := db.Model(&model.Order{}).Where("id = ?", order.ID).Updates(updates).Error; err != nil {
			return err
		}
	}

	return nil
}

// normalizeStoredPrice 统一历史价格：优先使用 rawWei，缺失或无效时用旧的 fallbackETH 推导。
func normalizeStoredPrice(rawWei string, fallbackETH float64) (string, float64, error) {
	// normalizedWei 是去掉前导零后的 wei 字符串。
	normalizedWei, err := util.NormalizeWeiString(rawWei)
	if err != nil || strings.TrimSpace(rawWei) == "" {
		normalizedWei, err = util.WeiStringFromETHFloat(fallbackETH)
		if err != nil {
			return "", 0, err
		}
	}

	return normalizedWei, util.DisplayETHFromWeiString(normalizedWei), nil
}
