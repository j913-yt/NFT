// 本文件处理订单相关 HTTP 接口：购买成功后记录订单，以及查询已卖出、已购入、NFT 交易历史。
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"nft-backend/internal/middleware"
	"nft-backend/internal/service"
	"nft-backend/internal/util"

	"github.com/gorilla/mux"
)

// OrderHandler 持有订单服务，负责处理订单 HTTP 请求。
type OrderHandler struct {
	svc *service.OrderService // svc 执行订单创建、成交后改拥有者、订单列表查询。
}

// NewOrderHandler 创建订单接口处理器。
func NewOrderHandler(svc *service.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

// createOrderReq 是前端购买合约交易成功后提交给后端的订单请求体。
type createOrderReq struct {
	NFTID    uint    `json:"nftId"`    // nftId 是后端 NFT.ID，用来找到本地 NFT 记录。
	PriceWei string  `json:"priceWei"` // priceWei 是链上购买时支付的 wei 金额。
	Price    float64 `json:"price"`    // price 是旧版 ETH 展示价格，缺少 priceWei 时才会使用。
	TxHash   string  `json:"txHash"`   // txHash 是前端 buyNFT 合约交易成功后的交易哈希。
}

// Create 记录一笔链上购买成功后的订单，并把 NFT 本地拥有者改为买家。
func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	// uid 是当前登录用户，也就是这笔订单的买家。
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	// req 包含购买的 NFT、本次支付金额和链上交易哈希。
	var req createOrderReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	// priceWei 优先使用链上金额；没有时才从旧 price 字段推导。
	priceWei := req.PriceWei
	if priceWei == "" {
		var err error
		priceWei, _, err = util.ResolveWeiAndDisplay("", req.Price)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "价格信息无效"})
			return
		}
	}

	// order 是创建成功的订单记录；service 内部会同时把 NFT 下架并转给买家。
	order, err := h.svc.CreateOrder(uid, req.NFTID, priceWei, req.TxHash)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, order)
}

// ListSold 返回当前用户卖出的订单列表。
func (h *OrderHandler) ListSold(w http.ResponseWriter, r *http.Request) {
	// uid 是当前登录用户，也就是卖家 ID。
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	// list 是带 NFT 和买家信息的卖出记录。
	list, err := h.svc.ListSoldOrders(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "加载已售订单失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"list": list})
}

// ListBought 返回当前用户购入的订单列表。
func (h *OrderHandler) ListBought(w http.ResponseWriter, r *http.Request) {
	// uid 是当前登录用户，也就是买家 ID。
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	// list 是带 NFT 和卖家信息的购入记录。
	list, err := h.svc.ListBoughtOrders(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "加载已购订单失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"list": list})
}

// ListByNFT 返回某个 NFT 的交易历史。
func (h *OrderHandler) ListByNFT(w http.ResponseWriter, r *http.Request) {
	// id64 是后端 NFT.ID，用来查询该 NFT 的所有订单。
	id64, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	// list 是该 NFT 的历史成交记录，包含买家和卖家信息。
	list, err := h.svc.ListByNFTID(uint(id64))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "加载交易记录失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"list": list})
}
