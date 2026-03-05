package handler

import (
	"encoding/json"
	"net/http"

	"nft-backend/internal/middleware"
	"nft-backend/internal/service"
)

type OrderHandler struct {
	svc *service.OrderService
}

func NewOrderHandler(svc *service.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

type createOrderReq struct {
	NFTID  uint    `json:"nftId"`
	Price  float64 `json:"price"`
	TxHash string  `json:"txHash"`
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

	order, err := h.svc.CreateOrder(uid, req.NFTID, req.Price, req.TxHash)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, order)
}

