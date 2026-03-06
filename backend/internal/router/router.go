package router

import (
	"net/http"

	"nft-backend/internal/config"
	"nft-backend/internal/handler"
	"nft-backend/internal/middleware"
	"nft-backend/internal/repository"
	"nft-backend/internal/service"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// New creates the main router for the backend service.
func New() *mux.Router {
	r := mux.NewRouter()

	// static files: /static/avatars/*
	fs := http.FileServer(http.Dir("uploads"))
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", fs))

	cfg := config.Load()
	db := repository.NewDB(cfg)

	setupRoutes(r, db, cfg)

	return r
}

func setupRoutes(r *mux.Router, db *gorm.DB, cfg *config.Config) {
	authSvc := service.NewAuthService(db, cfg)
	authHandler := handler.NewAuthHandler(authSvc)

	nftSvc := service.NewNFTService(db)
	nftHandler := handler.NewNFTHandler(nftSvc)

	orderSvc := service.NewOrderService(db, nftSvc)
	orderHandler := handler.NewOrderHandler(orderSvc)

	uploadHandler := handler.NewUploadHandler()
	ipfsSvc := service.NewIPFSService(cfg.PinataJWT, cfg.PinataAPIKey, cfg.PinataAPISecret, cfg.IPFSGateway)
	ipfsHandler := handler.NewIPFSHandler(ipfsSvc)

	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("pong"))
	}).Methods(http.MethodGet)

	// auth
	api.HandleFunc("/auth/register", authHandler.Register).Methods(http.MethodPost)
	api.HandleFunc("/auth/login", authHandler.Login).Methods(http.MethodPost)
	api.HandleFunc("/auth/wallet/nonce", authHandler.WalletNonce).Methods(http.MethodGet)
	api.HandleFunc("/auth/wallet/login", authHandler.WalletLogin).Methods(http.MethodPost)
	api.Handle("/auth/profile", middleware.Auth(cfg)(http.HandlerFunc(authHandler.UpdateProfile))).Methods(http.MethodPut)

	// nfts
	api.HandleFunc("/nfts", nftHandler.List).Methods(http.MethodGet)
	api.HandleFunc("/nfts/{id}", nftHandler.Get).Methods(http.MethodGet)
	api.Handle("/nfts", middleware.Auth(cfg)(http.HandlerFunc(nftHandler.Create))).Methods(http.MethodPost)
	api.Handle("/nfts/{id}/listing", middleware.Auth(cfg)(http.HandlerFunc(nftHandler.UpdateListing))).Methods(http.MethodPatch)

	// orders
	api.Handle("/orders", middleware.Auth(cfg)(http.HandlerFunc(orderHandler.Create))).Methods(http.MethodPost)
	api.Handle("/orders/sold", middleware.Auth(cfg)(http.HandlerFunc(orderHandler.ListSold))).Methods(http.MethodGet)
	api.Handle("/orders/bought", middleware.Auth(cfg)(http.HandlerFunc(orderHandler.ListBought))).Methods(http.MethodGet)
	api.HandleFunc("/orders/nft/{id}", orderHandler.ListByNFT).Methods(http.MethodGet)

	// upload & ipfs
	api.HandleFunc("/upload/avatar", uploadHandler.UploadAvatar).Methods(http.MethodPost)
	api.Handle("/ipfs/nft", middleware.Auth(cfg)(http.HandlerFunc(ipfsHandler.UploadNFT))).Methods(http.MethodPost)
}
