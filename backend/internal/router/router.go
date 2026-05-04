// 本文件集中注册后端路由：把 service、handler、中间件组装成可访问的 HTTP API。
package router

import (
	"net/http"
	"time"

	"nft-backend/internal/config"
	"nft-backend/internal/handler"
	"nft-backend/internal/middleware"
	"nft-backend/internal/repository"
	"nft-backend/internal/service"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// New 创建后端主路由，并初始化配置、数据库和各业务路由。
func New() *mux.Router {
	// r 是 Gorilla Mux 路由器，后续所有 API 都挂在它下面。
	r := mux.NewRouter()

	// fs 用于把本地 uploads 目录映射成 /static/ 静态资源访问路径。
	fs := http.FileServer(http.Dir("uploads"))
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", fs))

	// cfg 是环境配置，db 是数据库连接；它们会注入到 service 层。
	cfg := config.Load()
	db := repository.NewDB(cfg)

	setupRoutes(r, db, cfg)

	return r
}

// setupRoutes 创建各个业务对象，并把 URL 路径绑定到对应的 handler 方法。
func setupRoutes(r *mux.Router, db *gorm.DB, cfg *config.Config) {
	// authSvc/authHandler 负责钱包 nonce、签名登录、资料更新。
	authSvc := service.NewAuthService(db, cfg)
	authHandler := handler.NewAuthHandler(authSvc)

	// nftSvc/nftHandler 负责 NFT 列表、详情、创建和上架状态更新。
	nftSvc := service.NewNFTService(db, cfg.ActiveNFTContract)
	nftHandler := handler.NewNFTHandler(nftSvc)

	// orderSvc/orderHandler 负责购买完成后的订单记录和交易历史查询。
	orderSvc := service.NewOrderService(db, nftSvc)
	orderHandler := handler.NewOrderHandler(orderSvc)

	// uploadHandler 处理本地头像上传；ipfsHandler 处理 NFT 媒体和元数据上传到 IPFS。
	uploadHandler := handler.NewUploadHandler()
	ipfsSvc := service.NewIPFSService(cfg.PinataJWT, cfg.PinataAPIKey, cfg.PinataAPISecret, cfg.IPFSGateway)
	ipfsHandler := handler.NewIPFSHandler(ipfsSvc)

	// avatarRateLimit/ipfsRateLimit 是针对上传接口的简单限流，避免短时间重复上传。
	avatarRateLimit := middleware.RateLimit(6, time.Minute)
	ipfsRateLimit := middleware.RateLimit(3, 5*time.Minute)

	// api 是统一的 /api/v1 前缀子路由。
	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("pong"))
	}).Methods(http.MethodGet)

	api.HandleFunc("/auth/wallet/nonce", authHandler.WalletNonce).Methods(http.MethodGet)
	api.HandleFunc("/auth/wallet/login", authHandler.WalletLogin).Methods(http.MethodPost)
	api.Handle("/auth/profile", middleware.Auth(cfg)(http.HandlerFunc(authHandler.UpdateProfile))).Methods(http.MethodPut)

	api.HandleFunc("/nfts", nftHandler.List).Methods(http.MethodGet)
	api.HandleFunc("/nfts/{id}", nftHandler.Get).Methods(http.MethodGet)
	api.Handle("/nfts", middleware.Auth(cfg)(http.HandlerFunc(nftHandler.Create))).Methods(http.MethodPost)
	api.Handle("/nfts/{id}/listing", middleware.Auth(cfg)(http.HandlerFunc(nftHandler.UpdateListing))).Methods(http.MethodPatch)

	api.Handle("/orders", middleware.Auth(cfg)(http.HandlerFunc(orderHandler.Create))).Methods(http.MethodPost)
	api.Handle("/orders/sold", middleware.Auth(cfg)(http.HandlerFunc(orderHandler.ListSold))).Methods(http.MethodGet)
	api.Handle("/orders/bought", middleware.Auth(cfg)(http.HandlerFunc(orderHandler.ListBought))).Methods(http.MethodGet)
	api.HandleFunc("/orders/nft/{id}", orderHandler.ListByNFT).Methods(http.MethodGet)

	api.Handle("/upload/avatar", middleware.Auth(cfg)(avatarRateLimit(http.HandlerFunc(uploadHandler.UploadAvatar)))).Methods(http.MethodPost)
	api.Handle("/ipfs/nft", middleware.Auth(cfg)(ipfsRateLimit(http.HandlerFunc(ipfsHandler.UploadNFT)))).Methods(http.MethodPost)
}
