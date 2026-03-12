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

type OrderHandler struct {
	svc *service.OrderService
}

func NewOrderHandler(svc *service.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

type createOrderReq struct {
	NFTID    uint    `json:"nftId"`
	PriceWei string  `json:"priceWei"`
	Price    float64 `json:"price"`
	TxHash   string  `json:"txHash"`
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	var req createOrderReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	priceWei := req.PriceWei
	if priceWei == "" {
		var err error
		priceWei, _, err = util.ResolveWeiAndDisplay("", req.Price)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "价格信息无效"})
			return
		}
	}

	order, err := h.svc.CreateOrder(uid, req.NFTID, priceWei, req.TxHash)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, order)
}

func (h *OrderHandler) ListSold(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	list, err := h.svc.ListSoldOrders(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "加载已售订单失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"list": list})
}

func (h *OrderHandler) ListBought(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	list, err := h.svc.ListBoughtOrders(uid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "加载已购订单失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"list": list})
}

func (h *OrderHandler) ListByNFT(w http.ResponseWriter, r *http.Request) {
	id64, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	list, err := h.svc.ListByNFTID(uint(id64))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "加载交易记录失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"list": list})
}
