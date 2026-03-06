package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"nft-backend/internal/middleware"
	"nft-backend/internal/model"
	"nft-backend/internal/service"

	"github.com/gorilla/mux"
)

var allowedNFTCategories = map[string]bool{
	"art":   true,
	"music": true,
	"video": true,
	"other": true,
}

type NFTHandler struct {
	svc *service.NFTService
}

func NewNFTHandler(svc *service.NFTService) *NFTHandler {
	return &NFTHandler{svc: svc}
}

func parseListedFlag(v string) (*bool, bool) {
	q := strings.TrimSpace(strings.ToLower(v))
	if q == "" {
		return nil, true
	}
	if q == "1" || q == "true" || q == "yes" {
		b := true
		return &b, true
	}
	if q == "0" || q == "false" || q == "no" {
		b := false
		return &b, true
	}
	return nil, false
}

func (h *NFTHandler) List(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	listedOnly, ok := parseListedFlag(r.URL.Query().Get("listed"))
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "listed 参数无效"})
		return
	}

	nfts, err := h.svc.List(category, listedOnly)
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

	nft.Name = strings.TrimSpace(nft.Name)
	nft.Description = strings.TrimSpace(nft.Description)
	nft.Category = strings.ToLower(strings.TrimSpace(nft.Category))
	nft.PriceUnit = strings.ToUpper(strings.TrimSpace(nft.PriceUnit))

	if nft.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "名称不能为空"})
		return
	}
	if nft.Category == "" {
		nft.Category = "other"
	}
	if !allowedNFTCategories[nft.Category] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "不支持的 NFT 分类"})
		return
	}

	if nft.MediaURL == "" {
		nft.MediaURL = nft.ImageURL
	}
	if nft.MediaType == "" {
		nft.MediaType = "image"
	}
	if nft.Storage == "" {
		nft.Storage = "local"
	}
	if nft.TokenURI == "" {
		nft.TokenURI = nft.ImageURL
	}
	if nft.PriceUnit == "" {
		nft.PriceUnit = "ETH"
	}

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

type updateListingReq struct {
	Price     float64 `json:"price"`
	PriceUnit string  `json:"priceUnit"`
}

func (h *NFTHandler) UpdateListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	idStr := mux.Vars(r)["id"]
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	var req updateListingReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	nft, err := h.svc.UpdateListing(uint(id64), uid, req.Price, req.PriceUnit)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, nft)
}
