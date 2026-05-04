// 本文件处理本地头像上传：校验文件类型和大小，把头像保存到 uploads/avatars 并返回静态访问 URL。
package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"nft-backend/internal/util"
)

// avatarMaxBytes 是头像文件最大体积，5 << 20 等于 5MB。
const avatarMaxBytes = 5 << 20

// UploadHandler 处理普通文件上传，目前只包含头像上传。
type UploadHandler struct{}

// NewUploadHandler 创建上传接口处理器。
func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// UploadAvatar 接收 multipart/form-data 里的 file 字段，保存头像并返回 URL。
func (h *UploadHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	// MaxBytesReader 限制整个请求体大小，额外 1024 字节给 multipart 边界和头信息。
	r.Body = http.MaxBytesReader(w, r.Body, avatarMaxBytes+1024)
	if err := r.ParseMultipartForm(avatarMaxBytes + 1024); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "上传数据错误或文件过大"})
		return
	}

	// file/header 分别是上传文件内容和文件头信息。
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "未选择文件"})
		return
	}
	defer file.Close()

	if header.Size <= 0 || header.Size > avatarMaxBytes {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "头像文件不能超过 5MB"})
		return
	}

	// content 是头像完整字节内容，后面会用于 MIME 检测和写入磁盘。
	content, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "读取头像失败"})
		return
	}
	if len(content) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "头像文件为空"})
		return
	}

	// ext 是根据真实文件类型决定的保存扩展名，例如 .jpg 或 .png。
	_, ext, err := util.DetectAvatarFile(header.Header.Get("Content-Type"), content)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "头像仅支持 JPG、PNG、GIF、WEBP"})
		return
	}

	// dir 是头像保存目录，对外通过 /static/avatars/... 访问。
	dir := filepath.Join("uploads", "avatars")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "创建目录失败"})
		return
	}

	// filename 使用纳秒时间戳降低重名概率；targetPath 是本地磁盘保存路径。
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	targetPath := filepath.Join(dir, filename)
	if err := os.WriteFile(targetPath, content, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "保存头像失败"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"url": "/static/avatars/" + filename,
	})
}
