// 本文件处理 NFT 相关 HTTP 接口：列表、详情、创建链下镜像记录、更新上架价格。
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

// allowedNFTCategories 是后端允许保存的 NFT 分类。
var allowedNFTCategories = map[string]bool{
	"art":   true,
	"music": true,
	"video": true,
	"other": true,
}

// maxRoyaltyFeeBps 是允许录入的最高版税比例，2500 表示 25%。
const maxRoyaltyFeeBps uint16 = 2500

// NFTHandler 持有 NFTService，负责把 HTTP 请求转换成业务调用。
type NFTHandler struct {
	svc *service.NFTService // svc 处理 NFT 数据库读写和上架状态更新。
}

// NewNFTHandler 创建 NFT 接口处理器。
func NewNFTHandler(svc *service.NFTService) *NFTHandler {
	return &NFTHandler{svc: svc}
}

// parseListedFlag 解析 listed 查询参数；nil 表示不按上架状态过滤。
func parseListedFlag(v string) (*bool, bool) {
	// q 是标准化后的查询参数值，支持 true/false、1/0、yes/no。
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

// List 返回 NFT 列表，可按分类和是否已上架过滤。
func (h *NFTHandler) List(w http.ResponseWriter, r *http.Request) {
	// category 是前端筛选分类，listedOnly 是是否只看已上架/未上架的筛选条件。
	category := r.URL.Query().Get("category")
	listedOnly, ok := parseListedFlag(r.URL.Query().Get("listed"))
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "listed 参数无效"})
		return
	}

	// nfts 是服务层查出的 NFT 镜像列表。
	nfts, err := h.svc.List(category, listedOnly)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "获取列表失败"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"list": nfts})
}

// Create 保存一个 NFT 的链下记录；铸造动作已经由前端调用合约完成，这里只记录结果。
func (h *NFTHandler) Create(w http.ResponseWriter, r *http.Request) {
	// nft 是前端提交的 NFT 数据，其中 contract/tokenId/tokenUri 来自合约铸造结果和元数据上传结果。
	var nft model.NFT
	if err := json.NewDecoder(r.Body).Decode(&nft); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	// uid 是当前登录用户，创建后的 NFT 归这个用户所有。
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

	// name 是页面展示名称；contract/tokenId 是链上唯一定位一个 NFT 的关键字段。
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

	// royaltyFeeBps 和 royaltyReceiver 对应合约铸造时设置的版税信息。
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

	// MediaURL/MediaType/Storage/TokenURI 的默认值用于兼容本地上传或旧数据。
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

	// priceWei 是合约价格精确值，displayPrice 是页面展示用 ETH 小数。
	priceWei, displayPrice, err := util.ResolveWeiAndDisplay(nft.PriceWei, nft.Price)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "价格信息无效"})
		return
	}

	nft.PriceWei = priceWei
	nft.Price = displayPrice
	nft.PriceUnit = "ETH"
	nft.OwnerID = uid

	// Create 只写数据库，不会再次调用合约铸造。
	if err := h.svc.Create(&nft); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "创建失败"})
		return
	}
	writeJSON(w, http.StatusOK, nft)
}

// Get 根据后端数据库 ID 返回 NFT 详情和当前拥有者信息。
func (h *NFTHandler) Get(w http.ResponseWriter, r *http.Request) {
	// id64 来自路由 /nfts/{id}，这里的 id 是后端数据库 NFT.ID。
	id64, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	// nft 是 NFT 记录，owner 是拥有者用户记录；owner 可能为空。
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

// updateListingReq 是更新上架价格的请求体。
type updateListingReq struct {
	PriceWei string  `json:"priceWei"` // priceWei 是前端传来的精确 wei 价格；"0" 表示下架。
	Price    float64 `json:"price"`    // price 是旧版展示价格字段，仅在没有 priceWei 时兜底推导。
}

// UpdateListing 更新后端记录里的上架价格；链上 list/delist 已经由前端合约交易完成。
func (h *NFTHandler) UpdateListing(w http.ResponseWriter, r *http.Request) {
	// uid 是当前登录用户，只有 NFT 当前拥有者才能更新上架状态。
	uid, ok := middleware.UserIDFromContext(r.Context())
	if !ok || uid == 0 {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "未登录"})
		return
	}

	// id64 是后端 NFT.ID，不是合约 tokenId。
	id64, err := strconv.ParseUint(mux.Vars(r)["id"], 10, 64)
	if err != nil || id64 == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	// req 保存前端传来的新价格。
	var req updateListingReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "参数错误"})
		return
	}

	// priceWei 优先使用精确 wei；没有时才从旧 price 字段推导。
	priceWei := strings.TrimSpace(req.PriceWei)
	if priceWei == "" {
		var convErr error
		priceWei, _, convErr = util.ResolveWeiAndDisplay("", req.Price)
		if convErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "价格信息无效"})
			return
		}
	}

	// nft 是更新后的 NFT 记录，会返回给前端刷新详情页或个人中心。
	nft, err := h.svc.UpdateListing(uint(id64), uid, priceWei)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, nft)
}
