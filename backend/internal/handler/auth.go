// 本文件处理认证相关 HTTP 接口：获取钱包登录 nonce、校验签名登录、更新用户资料。
package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"nft-backend/internal/middleware"
	"nft-backend/internal/service"
)

// AuthHandler 持有认证服务，HTTP 层只负责收参和返回 JSON。
type AuthHandler struct {
	svc *service.AuthService // svc 执行钱包登录、JWT 生成、资料更新等认证业务。
}

// NewAuthHandler 创建认证接口处理器。
func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// walletLoginReq 是钱包登录请求体。
type walletLoginReq struct {
	Wallet    string `json:"wallet"`    // wallet 是前端当前连接的钱包地址。
	Signature string `json:"signature"` // signature 是钱包对 nonce 登录消息的签名结果。
}

// updateProfileReq 是更新个人资料请求体。
type updateProfileReq struct {
	Username string `json:"username"` // username 是用户想展示的新昵称。
	Avatar   string `json:"avatar"`   // avatar 是头像 URL，通常来自头像上传接口返回值。
}

// writeJSON 统一写 JSON 响应，避免每个 handler 重复设置 Header。
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// WalletNonce 接收钱包地址，生成一次性 nonce；前端拿到 nonce 后再让钱包签名。
func (h *AuthHandler) WalletNonce(w http.ResponseWriter, r *http.Request) {
	// wallet 来自查询参数 ?wallet=0x...。
	wallet := strings.TrimSpace(r.URL.Query().Get("wallet"))
	if wallet == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "钱包地址不能为空"})
		return
	}

	// nonce 会存入数据库用户记录，用于后续 WalletLogin 校验签名。
	nonce, err := h.svc.GenerateNonce(wallet)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"nonce": nonce})
}

// WalletLogin 校验钱包签名，成功后返回 JWT 和用户信息。
func (h *AuthHandler) WalletLogin(w http.ResponseWriter, r *http.Request) {
	// req 包含钱包地址和签名，来自前端 JSON 请求体。
	var req walletLoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "请求参数错误"})
		return
	}

	// token 是后端 JWT；user 是当前钱包对应的用户记录。
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

// UpdateProfile 更新当前登录用户的昵称或头像。
func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	// uid 来自 Auth 中间件解析出的 JWT，代表当前登录用户。
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	// req 是前端提交的新资料字段。
	var req updateProfileReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "请求参数错误"})
		return
	}

	// user 是更新后的用户记录，会直接返回给前端刷新页面状态。
	user, err := h.svc.UpdateProfile(uid, req.Username, req.Avatar)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user": user,
	})
}
