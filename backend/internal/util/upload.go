package util

import (
	"errors"
	"net/http"
	"strings"
)

var avatarMimeToExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

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

func normalizeMIME(raw string) string {
	part := strings.TrimSpace(raw)
	if part == "" {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(strings.SplitN(part, ";", 2)[0]))
}

func pickAllowedMIME(headerContentType string, content []byte, allowed map[string]bool) string {
	detected := normalizeMIME(http.DetectContentType(content))
	if allowed[detected] {
		return detected
	}

	header := normalizeMIME(headerContentType)
	if allowed[header] {
		return header
	}

	return ""
}

func DetectAvatarFile(headerContentType string, content []byte) (mimeType string, extension string, err error) {
	allowed := map[string]bool{}
	for mime := range avatarMimeToExt {
		allowed[mime] = true
	}

	mime := pickAllowedMIME(headerContentType, content, allowed)
	if mime == "" {
		return "", "", errors.New("avatar must be a JPG, PNG, GIF, or WEBP image")
	}

	return mime, avatarMimeToExt[mime], nil
}

func DetectAllowedNFTMedia(headerContentType string, content []byte) (mimeType string, mediaType string, err error) {
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

func DetectAllowedCoverImage(headerContentType string, content []byte) (string, error) {
	mime, _, err := DetectAvatarFile(headerContentType, content)
	return mime, err
}
