package repository

import (
	"log"
	"fmt"

	"nft-backend/internal/config"
	"nft-backend/internal/model"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// NewDB 初始化 GORM 数据库（MySQL），并在启动时自动创建数据库与表结构。
func NewDB(cfg *config.Config) *gorm.DB {
	// 先连接到 MySQL server（不指定 DB），确保数据库存在
	dsnNoDB := fmt.Sprintf("%s:%s@tcp(%s:%d)/?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort)
	serverDB, err := gorm.Open(mysql.Open(dsnNoDB), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	if err := serverDB.Exec("CREATE DATABASE IF NOT EXISTS `" + cfg.MySQLDB + "` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;").Error; err != nil {
		log.Fatalf("failed to create database: %v", err)
	}

	// 再连接到具体数据库
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=true&loc=Local",
		cfg.MySQLUser, cfg.MySQLPass, cfg.MySQLHost, cfg.MySQLPort, cfg.MySQLDB)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	if err := db.AutoMigrate(&model.User{}, &model.NFT{}, &model.Order{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

