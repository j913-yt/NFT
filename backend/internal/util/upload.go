// 本文件负责上传文件类型识别：根据请求头和文件内容判断头像、NFT 媒体、封面是否允许上传。
package util

import (
	"errors"
	"net/http"
	"strings"
)

// avatarMimeToExt 定义头像允许的 MIME 类型，以及保存到本地时对应的扩展名。
var avatarMimeToExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// allowedNFTMediaMIMEs 定义 NFT 主媒体允许的 MIME 类型，覆盖图片、音频和视频。
var allowedNFTMediaMIMEs = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
	"audio/mpeg":      true,
	"audio/wav":       true,
	"audio/x-wav":     true,
	"audio/ogg":       true,
	"audio/flac":      true,
	"audio/x-flac":    true,
	"audio/mp4":       true,
	"audio/aac":       true,
	"video/mp4":       true,
	"video/webm":      true,
	"video/ogg":       true,
	"video/quicktime": true,
}

// normalizeMIME 去掉 Content-Type 里的参数并转成小写，例如 "image/png; charset=utf-8" 会变成 "image/png"。
func normalizeMIME(raw string) string {
	// part 是清理后的 MIME 文本。
	part := strings.TrimSpace(raw)
	if part == "" {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(strings.SplitN(part, ";", 2)[0]))
}

// pickAllowedMIME 优先根据文件内容识别 MIME，再参考请求头，并检查是否在白名单内。
func pickAllowedMIME(headerContentType string, content []byte, allowed map[string]bool) string {
	// detected 是 http.DetectContentType 根据文件前 512 字节推断出的类型。
	detected := normalizeMIME(http.DetectContentType(content))
	if allowed[detected] {
		return detected
	}

	// header 是浏览器上传时声明的 Content-Type，作为内容识别失败时的辅助依据。
	header := normalizeMIME(headerContentType)
	if allowed[header] {
		return header
	}

	return ""
}

// DetectAvatarFile 校验头像文件类型，并返回 MIME 与本地保存扩展名。
func DetectAvatarFile(headerContentType string, content []byte) (mimeType string, extension string, err error) {
	// allowed 是从 avatarMimeToExt 生成的头像白名单。
	allowed := map[string]bool{}
	for mime := range avatarMimeToExt {
		allowed[mime] = true
	}

	// mime 是最终确认可接受的头像 MIME。
	mime := pickAllowedMIME(headerContentType, content, allowed)
	if mime == "" {
		return "", "", errors.New("avatar must be a JPG, PNG, GIF, or WEBP image")
	}

	return mime, avatarMimeToExt[mime], nil
}

// DetectAllowedNFTMedia 校验 NFT 主媒体文件，并返回 MIME 和媒体大类。
func DetectAllowedNFTMedia(headerContentType string, content []byte) (mimeType string, mediaType string, err error) {
	// mime 是最终确认可接受的 NFT 媒体 MIME。
	mime := pickAllowedMIME(headerContentType, content, allowedNFTMediaMIMEs)
	if mime == "" {
		return "", "", errors.New("unsupported media type")
	}

	switch {
	case strings.HasPrefix(mime, "image/"):
		return mime, "image", nil
	case strings.HasPrefix(mime, "audio/"):
		return mime, "audio", nil
	case strings.HasPrefix(mime, "video/"):
		return mime, "video", nil
	default:
		return "", "", errors.New("unsupported media type")
	}
}

// DetectAllowedCoverImage 校验音频/视频 NFT 的封面图，规则和头像图片一致。
func DetectAllowedCoverImage(headerContentType string, content []byte) (string, error) {
	mime, _, err := DetectAvatarFile(headerContentType, content)
	return mime, err
}
