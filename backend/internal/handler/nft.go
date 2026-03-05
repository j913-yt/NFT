package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"nft-backend/internal/middleware"
	"nft-backend/internal/model"
	"nft-backend/internal/service"

	"github.com/gorilla/mux"
)

type NFTHandler struct {
	svc *service.NFTService
}

func NewNFTHandler(svc *service.NFTService) *NFTHandler {
	return &NFTHandler{svc: svc}
}

func (h *NFTHandler) List(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	nfts, err := h.svc.List(category)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "获取列表失败"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"list": nfts})
}

func (h *NFTHandler) Create(w http.ResponseWriter, r *http.Request) {
	var nft model.NFT
	if err := json.NewDecoder(r.Body).Decode(&nft); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	if nft.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "名称不能为空"})
		return
	}

	// 由登录用户作为 owner，忽略前端传入的 ownerId
	nft.OwnerID = uid

	if err := h.svc.Create(&nft); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "创建失败"})
		return
	}
	writeJSON(w, http.StatusOK, nft)
}

func (h *NFTHandler) Get(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	nft, owner, err := h.svc.GetWithOwner(uint(id64))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "NFT 不存在"})
		return
	}

	resp := map[string]interface{}{
		"nft": nft,
	}
	if owner != nil {
		resp["owner"] = owner
	}

	writeJSON(w, http.StatusOK, resp)
}
