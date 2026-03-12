package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"nft-backend/internal/config"
	"nft-backend/internal/model"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

func normalizeWalletAddress(wallet string) (string, error) {
	addr := strings.TrimSpace(wallet)
	if addr == "" {
		return "", errors.New("钱包地址不能为空")
	}
	if !common.IsHexAddress(addr) {
		return "", errors.New("钱包地址格式不正确")
	}
	return strings.ToLower(common.HexToAddress(addr).Hex()), nil
}

func (s *AuthService) GenerateNonce(wallet string) (string, error) {
	addr, err := normalizeWalletAddress(wallet)
	if err != nil {
		return "", err
	}

	var user model.User
	err = s.db.Where("lower(wallet) = ?", addr).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			user = model.User{
				Wallet:   addr,
				Username: fmt.Sprintf("user_%s", addr[2:8]),
			}
			if err := s.db.Create(&user).Error; err != nil {
				return "", err
			}
		} else {
			return "", err
		}
	}

	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", err
	}
	nonce := hex.EncodeToString(nonceBytes)

	if err := s.db.Model(&user).Update("nonce", nonce).Error; err != nil {
		return "", err
	}
	return nonce, nil
}

func (s *AuthService) WalletLogin(wallet, signature string) (string, *model.User, error) {
	if strings.TrimSpace(signature) == "" {
		return "", nil, errors.New("签名不能为空")
	}

	addr, err := normalizeWalletAddress(wallet)
	if err != nil {
		return "", nil, err
	}

	var user model.User
	if err := s.db.Where("lower(wallet) = ?", addr).First(&user).Error; err != nil {
		return "", nil, errors.New("用户不存在，请先获取 nonce")
	}
	if user.Nonce == "" {
		return "", nil, errors.New("nonce 已失效，请重新获取后再签名")
	}

	message := fmt.Sprintf("NovaNFT Login\nnonce: %s", user.Nonce)
	prefixed := accounts.TextHash([]byte(message))

	sig := strings.TrimPrefix(strings.TrimSpace(signature), "0x")
	sigBytes, err := hex.DecodeString(sig)
	if err != nil {
		return "", nil, errors.New("签名格式错误")
	}
	if len(sigBytes) != 65 {
		return "", nil, errors.New("签名长度错误")
	}
	if sigBytes[64] == 27 || sigBytes[64] == 28 {
		sigBytes[64] -= 27
	}

	pubKey, err := crypto.SigToPub(prefixed, sigBytes)
	if err != nil {
		return "", nil, errors.New("签名校验失败")
	}
	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	if strings.ToLower(recoveredAddr.Hex()) != addr {
		return "", nil, errors.New("钱包地址与签名不匹配")
	}

	_ = s.db.Model(&user).Update("nonce", "")

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.ID,
		"exp":    time.Now().Add(24 * time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", nil, err
	}

	return signed, &user, nil
}

func (s *AuthService) UpdateProfile(userID uint, username, avatar string) (*model.User, error) {
	username = strings.TrimSpace(username)
	avatar = strings.TrimSpace(avatar)
	if username == "" && avatar == "" {
		return nil, errors.New("没有可更新的资料字段")
	}

	var user model.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	if username != "" {
		user.Username = username
	}
	if avatar != "" {
		user.Avatar = avatar
	}

	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}
