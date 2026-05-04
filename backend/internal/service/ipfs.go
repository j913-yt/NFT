// 本文件封装 Pinata/IPFS 上传能力：上传文件、上传元数据 JSON，并把 CID 拼成 ipfs:// 和网关 URL。
package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"time"
)

const (
	pinataFileURL = "https://api.pinata.cloud/pinning/pinFileToIPFS" // Pinata 文件上传接口。
	pinataJSONURL = "https://api.pinata.cloud/pinning/pinJSONToIPFS" // Pinata JSON 上传接口。
)

// IPFSService 保存 Pinata 鉴权信息和 HTTP 客户端。
type IPFSService struct {
	pinataJWT       string       // Pinata JWT 鉴权凭证。
	pinataAPIKey    string       // Pinata API Key 鉴权凭证。
	pinataAPISecret string       // Pinata API Secret 鉴权凭证。
	gateway         string       // IPFS 网关根地址，用于生成 HTTP URL。
	client          *http.Client // client 负责请求 Pinata，设置了超时时间。
}

// NewIPFSService 创建 IPFS 服务，并清理网关和鉴权字符串。
func NewIPFSService(pinataJWT, pinataAPIKey, pinataAPISecret, gateway string) *IPFSService {
	// gateway 为空时使用 Pinata 公共网关。
	gateway = strings.TrimSpace(gateway)
	if gateway == "" {
		gateway = "https://gateway.pinata.cloud"
	}

	return &IPFSService{
		pinataJWT:       strings.TrimSpace(pinataJWT),
		pinataAPIKey:    strings.TrimSpace(pinataAPIKey),
		pinataAPISecret: strings.TrimSpace(pinataAPISecret),
		gateway:         strings.TrimRight(gateway, "/"),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Enabled 判断是否配置了 Pinata 鉴权信息。
func (s *IPFSService) Enabled() bool {
	return (s.pinataAPIKey != "" && s.pinataAPISecret != "") || s.pinataJWT != ""
}

// setAuthHeaders 根据配置给 Pinata 请求设置鉴权头。
func (s *IPFSService) setAuthHeaders(req *http.Request) {
	if s.pinataAPIKey != "" && s.pinataAPISecret != "" {
		req.Header.Set("pinata_api_key", s.pinataAPIKey)
		req.Header.Set("pinata_secret_api_key", s.pinataAPISecret)
		return
	}
	if s.pinataJWT != "" {
		req.Header.Set("Authorization", "Bearer "+s.pinataJWT)
	}
}

// authHint 返回当前使用的鉴权方式，出错时放进错误信息帮助排查。
func (s *IPFSService) authHint() string {
	if s.pinataAPIKey != "" && s.pinataAPISecret != "" {
		return "API Key/Secret"
	}
	if s.pinataJWT != "" {
		return "JWT"
	}
	return "none"
}

// missingAuthErr 返回未配置 Pinata 时的明确错误。
func (s *IPFSService) missingAuthErr() error {
	return errors.New("IPFS 未配置：请设置 PINATA_API_KEY + PINATA_API_SECRET，或设置 PINATA_JWT")
}

// UploadFile 把二进制文件上传到 Pinata，并返回 IPFS CID。
func (s *IPFSService) UploadFile(filename string, contentType string, data []byte) (string, error) {
	if !s.Enabled() {
		return "", s.missingAuthErr()
	}
	if len(data) == 0 {
		return "", errors.New("上传文件为空")
	}
	if filename == "" {
		filename = "asset.bin"
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// body/writer 用来构造 multipart/form-data 请求体。
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	// header 是 multipart 文件字段的头信息，name 必须是 Pinata 接口要求的 file。
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	header.Set("Content-Type", contentType)
	part, err := writer.CreatePart(header)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	// req 是发给 Pinata 文件上传接口的 HTTP 请求。
	req, err := http.NewRequest(http.MethodPost, pinataFileURL, &body)
	if err != nil {
		return "", err
	}
	s.setAuthHeaders(req)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// resp 是 Pinata 返回的响应，状态码非 2xx 时把响应体暴露出来方便排查。
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body) // respBody 保存 Pinata 返回内容。
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Pinata 文件上传失败(%d, auth=%s): %s", resp.StatusCode, s.authHint(), string(respBody))
	}

	// parsed.IPFSHash 就是 Pinata 返回的 CID。
	var parsed struct {
		IPFSHash string `json:"IpfsHash"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", err
	}
	if parsed.IPFSHash == "" {
		return "", errors.New("Pinata 返回中缺少 IpfsHash")
	}
	return parsed.IPFSHash, nil
}

// UploadJSON 把 NFT 元数据 JSON 上传到 Pinata，并返回元数据 CID。
func (s *IPFSService) UploadJSON(name string, payload interface{}) (string, error) {
	if !s.Enabled() {
		return "", s.missingAuthErr()
	}
	if name == "" {
		name = "metadata.json"
	}

	// reqBody 是 Pinata JSON 上传接口要求的结构，pinataContent 才是真正的 NFT 元数据。
	reqBody := map[string]interface{}{
		"pinataMetadata": map[string]string{
			"name": name,
		},
		"pinataContent": payload,
	}
	buf, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	// req 是发给 Pinata JSON 上传接口的 HTTP 请求。
	req, err := http.NewRequest(http.MethodPost, pinataJSONURL, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	s.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	// resp 是 Pinata 返回的响应，状态码非 2xx 时把响应体暴露出来方便排查。
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body) // respBody 保存 Pinata 返回内容。
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Pinata 元数据上传失败(%d, auth=%s): %s", resp.StatusCode, s.authHint(), string(respBody))
	}

	// parsed.IPFSHash 是元数据 JSON 的 CID，也就是 tokenURI 的核心部分。
	var parsed struct {
		IPFSHash string `json:"IpfsHash"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", err
	}
	if parsed.IPFSHash == "" {
		return "", errors.New("Pinata 返回中缺少 IpfsHash")
	}
	return parsed.IPFSHash, nil
}

// IPFSURI 把 CID 拼成合约里常用的 ipfs://cid 格式。
func (s *IPFSService) IPFSURI(cid string) string {
	return "ipfs://" + strings.TrimSpace(cid)
}

// GatewayURL 把 CID 拼成浏览器可以访问的 HTTPS 网关地址。
func (s *IPFSService) GatewayURL(cid string) string {
	// cid 是 IPFS 内容地址，空 cid 不生成 URL。
	cid = strings.TrimSpace(cid)
	if cid == "" {
		return ""
	}
	lower := strings.ToLower(s.gateway)
	if strings.HasSuffix(lower, "/ipfs") {
		return s.gateway + "/" + cid
	}
	return s.gateway + "/ipfs/" + cid
}

// DetectMediaType 根据 MIME 类型粗略判断媒体大类。
func DetectMediaType(mimeType string) string {
	// m 是标准化后的小写 MIME。
	m := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.HasPrefix(m, "image/"):
		return "image"
	case strings.HasPrefix(m, "audio/"):
		return "audio"
	case strings.HasPrefix(m, "video/"):
		return "video"
	default:
		return "file"
	}
}
