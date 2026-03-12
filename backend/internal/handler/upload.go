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

const avatarMaxBytes = 5 << 20

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

func (h *UploadHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, avatarMaxBytes+1024)
	if err := r.ParseMultipartForm(avatarMaxBytes + 1024); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "上传数据错误或文件过大"})
		return
	}

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

	content, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "读取头像失败"})
		return
	}
	if len(content) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "头像文件为空"})
		return
	}

	_, ext, err := util.DetectAvatarFile(header.Header.Get("Content-Type"), content)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "头像仅支持 JPG、PNG、GIF、WEBP"})
		return
	}

	dir := filepath.Join("uploads", "avatars")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "创建目录失败"})
		return
	}

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
