// 本文件处理 NFT 资源上传到 IPFS：上传主媒体、可选封面，并生成 ERC721 tokenURI 指向的元数据 JSON。
package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"nft-backend/internal/service"
	"nft-backend/internal/util"
)

const (
	maxNFTMainBytes    = 100 << 20 // NFT 主媒体最大 100MB。
	maxNFTCoverBytes   = 20 << 20  // 音频/视频封面最大 20MB。
	maxNFTRequestBytes = 125 << 20 // 整个 multipart 请求最大 125MB，包含主文件、封面和表单字段。
)

// IPFSHandler 持有 IPFSService，负责处理上传接口的入参校验和响应组装。
type IPFSHandler struct {
	svc *service.IPFSService // svc 负责真正调用 Pinata，把文件或 JSON pin 到 IPFS。
}

// NewIPFSHandler 创建 IPFS 上传接口处理器。
func NewIPFSHandler(svc *service.IPFSService) *IPFSHandler {
	return &IPFSHandler{svc: svc}
}

// isAllowedCategory 判断前端传来的 NFT 分类是否在系统允许范围内。
func isAllowedCategory(category string) bool {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "art", "music", "video", "other":
		return true
	default:
		return false
	}
}

// validateCategoryMedia 校验分类和媒体类型是否匹配，例如 music 必须上传音频。
func validateCategoryMedia(category, mediaType string) error {
	// category 是前端选择的分类，mediaType 是根据文件 MIME 识别出的媒体大类。
	category = strings.ToLower(strings.TrimSpace(category))
	if !isAllowedCategory(category) {
		return errors.New("不支持的 NFT 分类")
	}

	switch category {
	case "music":
		if mediaType != "audio" {
			return errors.New("音乐分类仅支持音频文件")
		}
	case "video":
		if mediaType != "video" {
			return errors.New("视频分类仅支持视频文件")
		}
	case "art":
		if mediaType != "image" {
			return errors.New("艺术分类仅支持图片文件")
		}
	}

	return nil
}

// UploadNFT 上传 NFT 主媒体和元数据，返回前端铸造合约需要使用的 metadataUri。
func (h *IPFSHandler) UploadNFT(w http.ResponseWriter, r *http.Request) {
	if !h.svc.Enabled() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"message": "IPFS 服务未配置，请先配置 Pinata 鉴权信息",
		})
		return
	}

	// MaxBytesReader 限制请求体大小，防止超大文件占满内存。
	r.Body = http.MaxBytesReader(w, r.Body, maxNFTRequestBytes)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "上传参数错误或文件过大"})
		return
	}

	// name/description/category 是 NFT 元数据里的基础信息。
	name := strings.TrimSpace(r.FormValue("name"))
	description := strings.TrimSpace(r.FormValue("description"))
	category := strings.ToLower(strings.TrimSpace(r.FormValue("category")))

	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "NFT 名称不能为空"})
		return
	}
	if category == "" {
		category = "other"
	}
	if !isAllowedCategory(category) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "不支持的 NFT 分类"})
		return
	}

	// file/header 是 multipart 表单里的主媒体文件和文件头。
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "请先选择媒体文件"})
		return
	}
	defer file.Close()

	if header.Size <= 0 || header.Size > maxNFTMainBytes {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "媒体文件大小不能超过 100MB"})
		return
	}

	// content 是主媒体完整字节内容，后面会用于 MIME 检测并上传到 Pinata。
	content, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "读取媒体文件失败"})
		return
	}
	if len(content) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "上传文件为空"})
		return
	}

	// mimeType 是文件 MIME，mediaType 是前端展示和分类校验用的大类。
	mimeType, mediaType, err := util.DetectAllowedNFTMedia(header.Header.Get("Content-Type"), content)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "媒体文件类型不在白名单内"})
		return
	}
	if err := validateCategoryMedia(category, mediaType); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	// assetCID 是主媒体上传到 IPFS 后得到的 CID。
	assetCID, err := h.svc.UploadFile(header.Filename, mimeType, content)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	// assetURI 是写入 NFT metadata 的 ipfs:// 地址，assetURL 是页面可直接访问的网关 URL。
	assetURI := h.svc.IPFSURI(assetCID)
	assetURL := h.svc.GatewayURL(assetCID)

	// coverCID/coverURI/coverURL 只在音频或视频 NFT 上传封面时使用。
	coverCID := ""
	coverURI := ""
	coverURL := ""

	if mediaType == "audio" || mediaType == "video" {
		// coverFile/coverHeader 是可选封面图；没有封面时允许继续。
		coverFile, coverHeader, coverErr := r.FormFile("cover")
		if coverErr == nil {
			defer coverFile.Close()

			if coverHeader.Size <= 0 || coverHeader.Size > maxNFTCoverBytes {
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面大小不能超过 20MB"})
				return
			}

			// coverBytes 是封面完整内容。
			coverBytes, err := io.ReadAll(coverFile)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "读取封面失败"})
				return
			}
			if len(coverBytes) == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面文件为空"})
				return
			}

			// coverMime 是封面图 MIME，规则和头像图片相同。
			coverMime, err := util.DetectAllowedCoverImage(coverHeader.Header.Get("Content-Type"), coverBytes)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面仅支持 JPG、PNG、GIF、WEBP"})
				return
			}

			// coverCID 是封面上传后的 CID；coverURI/coverURL 分别服务于 metadata 和页面展示。
			coverCID, err = h.svc.UploadFile(coverHeader.Filename, coverMime, coverBytes)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
				return
			}
			coverURI = h.svc.IPFSURI(coverCID)
			coverURL = h.svc.GatewayURL(coverCID)
		} else if !errors.Is(coverErr, http.ErrMissingFile) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面上传参数错误"})
			return
		}
	}

	// metadata 是 ERC721 tokenURI 指向的 JSON 内容，前端铸造时会把 metadataUri 写入合约。
	metadata := map[string]interface{}{
		"name":        name,
		"description": description,
		"attributes": []map[string]string{
			{"trait_type": "Category", "value": category},
			{"trait_type": "Media Type", "value": mediaType},
			{"trait_type": "MIME Type", "value": mimeType},
		},
		"properties": map[string]interface{}{
			"category":  category,
			"mediaType": mediaType,
			"mimeType":  mimeType,
			"files": []map[string]string{
				{"uri": assetURI, "type": mimeType},
			},
		},
	}

	// 图片 NFT 使用 image 字段；音频/视频使用 animation_url，封面存在时再写 image。
	if mediaType == "image" {
		metadata["image"] = assetURI
	} else {
		metadata["animation_url"] = assetURI
		if coverURI != "" {
			metadata["image"] = coverURI
		}
	}

	// metadataName 用主文件名生成元数据文件名，metadataFile 是上传到 Pinata 时显示的 JSON 文件名。
	metadataName := strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename))
	if metadataName == "" {
		metadataName = "nft-metadata"
	}
	metadataFile := fmt.Sprintf("%s-%d.json", metadataName, time.Now().Unix())
	// metadataCID 是元数据 JSON 上传后的 CID，metadataURI 就是合约 safeMint/mintAndList 使用的 tokenURI。
	metadataCID, err := h.svc.UploadJSON(metadataFile, metadata)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	metadataURI := h.svc.IPFSURI(metadataCID)
	metadataURL := h.svc.GatewayURL(metadataCID)

	// imageURI/imageURL 是前端卡片封面优先使用的资源；音频/视频没有封面时为空。
	imageURI := ""
	imageURL := ""
	if mediaType == "image" {
		imageURI = assetURI
		imageURL = assetURL
	} else if coverURI != "" {
		imageURI = coverURI
		imageURL = coverURL
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"assetCid":    assetCID,
		"assetUri":    assetURI,
		"assetUrl":    assetURL,
		"coverCid":    coverCID,
		"coverUri":    coverURI,
		"coverUrl":    coverURL,
		"imageUri":    imageURI,
		"imageUrl":    imageURL,
		"metadataCid": metadataCID,
		"metadataUri": metadataURI,
		"metadataUrl": metadataURL,
		"mediaType":   mediaType,
		"mimeType":    mimeType,
	})
}
