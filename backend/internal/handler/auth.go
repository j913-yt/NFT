package handler

import (
	"encoding/json"
	"net/http"

	"nft-backend/internal/middleware"
	"nft-backend/internal/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type walletNonceReq struct {
	Wallet string `json:"wallet"`
}

type walletLoginReq struct {
	Wallet    string `json:"wallet"`
	Signature string `json:"signature"`
}

type updateProfileReq struct {
	Username string `json:"username"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	if req.Email == "" || req.Password == "" || req.Username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "邮箱、密码和用户名不能为空"})
		return
	}

	if err := h.svc.Register(req.Email, req.Password, req.Username, req.Avatar); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "注册成功"})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	token, user, err := h.svc.Login(req.Email, req.Password)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

// WalletNonce 返回指定钱包的随机 nonce（如果用户不存在会自动创建），用于后续签名。
func (h *AuthHandler) WalletNonce(w http.ResponseWriter, r *http.Request) {
	wallet := r.URL.Query().Get("wallet")
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

// WalletLogin 校验签名并签发 JWT。
func (h *AuthHandler) WalletLogin(w http.ResponseWriter, r *http.Request) {
	var req walletLoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
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

// UpdateProfile 允许已登录用户更新用户名。
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	var req updateProfileReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	user, err := h.svc.UpdateUsername(uid, req.Username)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user": user,
	})
}
