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
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

func (s *AuthService) Register(email, password, username, avatar string) error {
	var count int64
	if err := s.db.Model(&model.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errors.New("邮箱已被注册")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	emailCopy := email
	user := &model.User{
		Email:    &emailCopy,
		Username: username,
		Avatar:   avatar,
		Password: string(hash),
	}
	return s.db.Create(user).Error
}

func (s *AuthService) Login(email, password string) (string, *model.User, error) {
	var user model.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil, errors.New("邮箱或密码错误")
		}
		return "", nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", nil, errors.New("邮箱或密码错误")
	}

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

// GenerateNonce 为某个钱包生成一次性随机 nonce，并存入数据库。
func (s *AuthService) GenerateNonce(wallet string) (string, error) {
	if wallet == "" {
		return "", errors.New("钱包地址不能为空")
	}
	addr := strings.ToLower(wallet)

	var user model.User
	err := s.db.Where("lower(wallet) = ?", addr).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 自动创建一个仅有钱包信息的用户，用户名用地址前几位占位
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

	// 生成随机 nonce
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	nonce := hex.EncodeToString(b)

	if err := s.db.Model(&user).Update("nonce", nonce).Error; err != nil {
		return "", err
	}
	return nonce, nil
}

// WalletLogin 校验签名并返回 JWT；签名算法按以太坊 personal_sign 规则。
func (s *AuthService) WalletLogin(wallet, signature string) (string, *model.User, error) {
	if wallet == "" || signature == "" {
		return "", nil, errors.New("参数错误")
	}
	addr := strings.ToLower(wallet)

	var user model.User
	if err := s.db.Where("lower(wallet) = ?", addr).First(&user).Error; err != nil {
		return "", nil, errors.New("用户不存在，请先请求 nonce")
	}
	if user.Nonce == "" {
		return "", nil, errors.New("nonce 已失效，请重新登录")
	}

	message := fmt.Sprintf("NovaNFT Login\nnonce: %s", user.Nonce)
	prefixed := accounts.TextHash([]byte(message))

	sig := signature
	sig = strings.TrimPrefix(sig, "0x")
	sigBytes, err := hex.DecodeString(sig)
	if err != nil {
		return "", nil, errors.New("签名格式错误")
	}
	if len(sigBytes) != 65 {
		return "", nil, errors.New("签名长度错误")
	}
	// 修正 V 值
	if sigBytes[64] == 27 || sigBytes[64] == 28 {
		sigBytes[64] -= 27
	}

	pubKey, err := crypto.SigToPub(prefixed, sigBytes)
	if err != nil {
		return "", nil, errors.New("签名验证失败")
	}
	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	if recoveredAddr != common.HexToAddress(addr) {
		return "", nil, errors.New("钱包地址与签名不匹配")
	}

	// 签名通过后清空 nonce，防止重放
	_ = s.db.Model(&user).Update("nonce", "")

	// 签发 JWT
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

// UpdateUsername 更新当前用户的昵称。
func (s *AuthService) UpdateUsername(userID uint, username string) (*model.User, error) {
	if username == "" {
		return nil, errors.New("用户名不能为空")
	}

	var user model.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}

	user.Username = username
	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}
