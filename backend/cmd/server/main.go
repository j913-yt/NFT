// 本文件是后端服务的启动入口：创建路由、套上跨域中间件，并监听 HTTP 端口。
package main

import (
	"log"
	"net/http"

	"nft-backend/internal/middleware"
	"nft-backend/internal/router"
)

func main() {
	// r 是整个后端的主路由，里面已经注册了认证、NFT、订单、上传等接口。
	r := router.New()

	// server 是标准库 HTTP 服务实例；Addr 指定监听端口，Handler 指向实际处理请求的路由。
	server := &http.Server{
		Addr:    ":8080",
		Handler: middleware.CORS(r),
	}

	// ListenAndServe 会一直阻塞运行；如果出现非正常关闭错误，就直接暴露并终止进程。
	log.Println("NFT backend server listening on :8080")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
