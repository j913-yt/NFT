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

// NewDB initializes MySQL, ensures the database exists, migrates tables,
// and backfills new wei-based price columns for existing rows.
func NewDB(cfg *config.Config) *gorm.DB {
	dsnNoDB := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort)
	serverDB, err := gorm.Open(mysql.Open(dsnNoDB), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	if err := serverDB.Exec("CREATE DATABASE IF NOT EXISTS `" + cfg.MySQLDB + "` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;").Error; err != nil {
		log.Fatalf("failed to create database: %v", err)
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort, cfg.MySQLDB)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	if err := db.AutoMigrate(&model.User{}, &model.NFT{}, &model.Order{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	if err := backfillWeiColumns(db); err != nil {
		log.Fatalf("failed to backfill wei columns: %v", err)
	}

	return db
}

func backfillWeiColumns(db *gorm.DB) error {
	var nfts []model.NFT
	if err := db.Find(&nfts).Error; err != nil {
		return err
	}
	for _, nft := range nfts {
		priceWei, displayPrice, err := normalizeStoredPrice(nft.PriceWei, nft.Price)
		if err != nil {
			return err
		}

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

	var orders []model.Order
	if err := db.Find(&orders).Error; err != nil {
		return err
	}
	for _, order := range orders {
		priceWei, displayPrice, err := normalizeStoredPrice(order.PriceWei, order.Price)
		if err != nil {
			return err
		}

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

func normalizeStoredPrice(rawWei string, fallbackETH float64) (string, float64, error) {
	normalizedWei, err := util.NormalizeWeiString(rawWei)
	if err != nil || strings.TrimSpace(rawWei) == "" {
		normalizedWei, err = util.WeiStringFromETHFloat(fallbackETH)
		if err != nil {
			return "", 0, err
		}
	}

	return normalizedWei, util.DisplayETHFromWeiString(normalizedWei), nil
}
