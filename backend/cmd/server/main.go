package main

import (
	"log"
	"net/http"

	"nft-backend/internal/middleware"
	"nft-backend/internal/router"
)

func main() {
	r := router.New()

	server := &http.Server{
		Addr:    ":8080",
		Handler: middleware.CORS(r),
	}

	log.Println("NFT backend server listening on :8080")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
