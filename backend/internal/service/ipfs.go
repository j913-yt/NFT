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
	pinataFileURL = "https://api.pinata.cloud/pinning/pinFileToIPFS"
	pinataJSONURL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
)

type IPFSService struct {
	pinataJWT       string
	pinataAPIKey    string
	pinataAPISecret string
	gateway         string
	client          *http.Client
}

func NewIPFSService(pinataJWT, pinataAPIKey, pinataAPISecret, gateway string) *IPFSService {
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

func (s *IPFSService) Enabled() bool {
	return (s.pinataAPIKey != "" && s.pinataAPISecret != "") || s.pinataJWT != ""
}

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

func (s *IPFSService) authHint() string {
	if s.pinataAPIKey != "" && s.pinataAPISecret != "" {
		return "API Key/Secret"
	}
	if s.pinataJWT != "" {
		return "JWT"
	}
	return "none"
}

func (s *IPFSService) missingAuthErr() error {
	return errors.New("IPFS 未配置：请设置 PINATA_API_KEY + PINATA_API_SECRET，或设置 PINATA_JWT")
}

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

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
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

	req, err := http.NewRequest(http.MethodPost, pinataFileURL, &body)
	if err != nil {
		return "", err
	}
	s.setAuthHeaders(req)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Pinata 文件上传失败(%d, auth=%s): %s", resp.StatusCode, s.authHint(), string(respBody))
	}

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

func (s *IPFSService) UploadJSON(name string, payload interface{}) (string, error) {
	if !s.Enabled() {
		return "", s.missingAuthErr()
	}
	if name == "" {
		name = "metadata.json"
	}

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

	req, err := http.NewRequest(http.MethodPost, pinataJSONURL, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	s.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Pinata 元数据上传失败(%d, auth=%s): %s", resp.StatusCode, s.authHint(), string(respBody))
	}

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

func (s *IPFSService) IPFSURI(cid string) string {
	return "ipfs://" + strings.TrimSpace(cid)
}

func (s *IPFSService) GatewayURL(cid string) string {
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

func DetectMediaType(mimeType string) string {
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
