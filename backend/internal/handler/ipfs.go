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
)

type IPFSHandler struct {
	svc *service.IPFSService
}

func NewIPFSHandler(svc *service.IPFSService) *IPFSHandler {
	return &IPFSHandler{svc: svc}
}

func isAllowedCategory(category string) bool {
	switch strings.ToLower(strings.TrimSpace(category)) {
	case "art", "music", "video", "other":
		return true
	default:
		return false
	}
}

func validateCategoryMedia(category, mediaType string) error {
	category = strings.ToLower(strings.TrimSpace(category))
	if !isAllowedCategory(category) {
		return errors.New("不支持的 NFT 类别")
	}

	switch category {
	case "music":
		if mediaType != "audio" {
			return errors.New("音乐类别只能上传音频文件")
		}
	case "video":
		if mediaType != "video" {
			return errors.New("视频类别只能上传视频文件")
		}
	case "art":
		if mediaType != "image" {
			return errors.New("艺术类别只能上传图片文件")
		}
	}
	return nil
}

func (h *IPFSHandler) UploadNFT(w http.ResponseWriter, r *http.Request) {
	if !h.svc.Enabled() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"message": "IPFS 服务未配置，请在后端设置 Pinata 鉴权信息",
		})
		return
	}

	if err := r.ParseMultipartForm(220 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "上传参数错误"})
		return
	}

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
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "不支持的 NFT 类别"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "请先选择媒体文件"})
		return
	}
	defer file.Close()

	if header.Size > 100<<20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "媒体文件大小不能超过 100MB"})
		return
	}

	content, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "读取媒体文件失败"})
		return
	}
	if len(content) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "上传文件为空"})
		return
	}

	mimeType := strings.TrimSpace(header.Header.Get("Content-Type"))
	if mimeType == "" {
		mimeType = http.DetectContentType(content)
	}
	mediaType := service.DetectMediaType(mimeType)

	if err := validateCategoryMedia(category, mediaType); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}

	assetCID, err := h.svc.UploadFile(header.Filename, mimeType, content)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	assetURI := h.svc.IPFSURI(assetCID)
	assetURL := h.svc.GatewayURL(assetCID)

	coverCID := ""
	coverURI := ""
	coverURL := ""

	if mediaType == "audio" || mediaType == "video" {
		coverFile, coverHeader, coverErr := r.FormFile("cover")
		if coverErr == nil {
			defer coverFile.Close()
			if coverHeader.Size > 20<<20 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面大小不能超过 20MB"})
				return
			}

			coverBytes, err := io.ReadAll(coverFile)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "读取封面失败"})
				return
			}
			if len(coverBytes) == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面文件为空"})
				return
			}

			coverMime := strings.TrimSpace(coverHeader.Header.Get("Content-Type"))
			if coverMime == "" {
				coverMime = http.DetectContentType(coverBytes)
			}
			if !strings.HasPrefix(strings.ToLower(coverMime), "image/") {
				writeJSON(w, http.StatusBadRequest, map[string]string{"message": "封面必须是图片格式"})
				return
			}

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

	if mediaType == "image" {
		metadata["image"] = assetURI
	} else {
		metadata["animation_url"] = assetURI
		if coverURI != "" {
			metadata["image"] = coverURI
		}
	}

	metadataName := strings.TrimSuffix(filepath.Base(header.Filename), filepath.Ext(header.Filename))
	if metadataName == "" {
		metadataName = "nft-metadata"
	}
	metadataFile := fmt.Sprintf("%s-%d.json", metadataName, time.Now().Unix())
	metadataCID, err := h.svc.UploadJSON(metadataFile, metadata)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	metadataURI := h.svc.IPFSURI(metadataCID)
	metadataURL := h.svc.GatewayURL(metadataCID)

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
