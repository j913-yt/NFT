package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"nft-backend/internal/middleware"
	"nft-backend/internal/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type walletLoginReq struct {
	Wallet    string `json:"wallet"`
	Signature string `json:"signature"`
}

type updateProfileReq struct {
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (h *AuthHandler) WalletNonce(w http.ResponseWriter, r *http.Request) {
	wallet := strings.TrimSpace(r.URL.Query().Get("wallet"))
	if wallet == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "钱包地址不能为空"})
		return
	}

	nonce, err := h.svc.GenerateNonce(wallet)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"nonce": nonce})
}

func (h *AuthHandler) WalletLogin(w http.ResponseWriter, r *http.Request) {
	var req walletLoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "请求参数错误"})
		return
	}

	token, user, err := h.svc.WalletLogin(req.Wallet, req.Signature)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	var req updateProfileReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "请求参数错误"})
		return
	}

	user, err := h.svc.UpdateProfile(uid, req.Username, req.Avatar)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user": user,
	})
}
