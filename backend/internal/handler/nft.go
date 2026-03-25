package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"nft-backend/internal/middleware"
	"nft-backend/internal/model"
	"nft-backend/internal/service"
	"nft-backend/internal/util"

	"github.com/ethereum/go-ethereum/common"
	"github.com/gorilla/mux"
)

var allowedNFTCategories = map[string]bool{
	"art":   true,
	"music": true,
	"video": true,
	"other": true,
}

const maxRoyaltyFeeBps uint16 = 2500

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
	nft.Contract = strings.TrimSpace(nft.Contract)
	nft.TokenID = strings.TrimSpace(nft.TokenID)
	nft.PriceUnit = strings.ToUpper(strings.TrimSpace(nft.PriceUnit))
	nft.RoyaltyReceiver = strings.ToLower(strings.TrimSpace(nft.RoyaltyReceiver))

	if nft.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "名称不能为空"})
		return
	}
	if nft.Contract == "" || nft.TokenID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "contract 和 tokenId 不能为空"})
		return
	}
	if nft.Category == "" {
		nft.Category = "other"
	}
	if !allowedNFTCategories[nft.Category] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "不支持的 NFT 分类"})
		return
	}

	if nft.RoyaltyFeeBps > maxRoyaltyFeeBps {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "版税比例不能超过 25%"})
		return
	}
	if nft.RoyaltyFeeBps > 0 {
		if nft.RoyaltyReceiver == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "启用版税时需要填写版税接收地址"})
			return
		}
		if !common.IsHexAddress(nft.RoyaltyReceiver) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "版税接收地址格式错误"})
			return
		}
	} else {
		nft.RoyaltyReceiver = ""
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

	priceWei, displayPrice, err := util.ResolveWeiAndDisplay(nft.PriceWei, nft.Price)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "价格信息无效"})
		return
	}

	nft.PriceWei = priceWei
	nft.Price = displayPrice
	nft.PriceUnit = "ETH"
	nft.OwnerID = uid

	if err := h.svc.Create(&nft); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "创建失败"})
		return
	}
	writeJSON(w, http.StatusOK, nft)
}

func (h *NFTHandler) Get(w http.ResponseWriter, r *http.Request) {
	id64, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
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
	PriceWei string  `json:"priceWei"`
	Price    float64 `json:"price"`
}

func (h *NFTHandler) UpdateListing(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	id64, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	var req updateListingReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	priceWei := strings.TrimSpace(req.PriceWei)
	if priceWei == "" {
		var convErr error
		priceWei, _, convErr = util.ResolveWeiAndDisplay("", req.Price)
		if convErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "价格信息无效"})
			return
		}
	}

	nft, err := h.svc.UpdateListing(uint(id64), uid, priceWei)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, nft)
}
