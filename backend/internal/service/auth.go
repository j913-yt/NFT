// 本文件实现认证业务：钱包地址规范化、nonce 生成、签名校验、JWT 签发和资料更新。
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

// AuthService 负责认证相关业务，依赖数据库和配置。
type AuthService struct {
	db  *gorm.DB       // db 用来读写用户、nonce 等认证数据。
	cfg *config.Config // cfg 提供 JWTSecret 等认证配置。
}

// NewAuthService 创建认证服务。
func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

// normalizeWalletAddress 校验钱包地址格式，并统一成小写校验和地址字符串。
func normalizeWalletAddress(wallet string) (string, error) {
	// addr 是去掉空白后的钱包地址。
	addr := strings.TrimSpace(wallet)
	if addr == "" {
		return "", errors.New("钱包地址不能为空")
	}
	if !common.IsHexAddress(addr) {
		return "", errors.New("钱包地址格式不正确")
	}
	return strings.ToLower(common.HexToAddress(addr).Hex()), nil
}

// GenerateNonce 为钱包地址生成登录用随机 nonce；如果用户不存在会自动创建用户。
func (s *AuthService) GenerateNonce(wallet string) (string, error) {
	// addr 是规范化后的钱包地址，也是数据库查询使用的值。
	addr, err := normalizeWalletAddress(wallet)
	if err != nil {
		return "", err
	}

	// user 是钱包地址对应的用户记录。
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

	// nonceBytes 是 16 字节随机数，转成 hex 后给前端签名。
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", err
	}
	nonce := hex.EncodeToString(nonceBytes) // nonce 是本次登录挑战字符串。

	if err := s.db.Model(&user).Update("nonce", nonce).Error; err != nil {
		return "", err
	}
	return nonce, nil
}

// WalletLogin 校验钱包签名，成功后清空 nonce 并返回 JWT。
func (s *AuthService) WalletLogin(wallet, signature string) (string, *model.User, error) {
	if strings.TrimSpace(signature) == "" {
		return "", nil, errors.New("签名不能为空")
	}

	// addr 是前端提交的钱包地址，后面会和签名恢复出的地址比较。
	addr, err := normalizeWalletAddress(wallet)
	if err != nil {
		return "", nil, err
	}

	// user 是数据库里保存的登录用户，必须先通过 GenerateNonce 创建或刷新 nonce。
	var user model.User
	if err := s.db.Where("lower(wallet) = ?", addr).First(&user).Error; err != nil {
		return "", nil, errors.New("用户不存在，请先获取 nonce")
	}
	if user.Nonce == "" {
		return "", nil, errors.New("nonce 已失效，请重新获取后再签名")
	}

	// message 必须和前端让钱包签名的文案完全一致，否则验签会失败。
	message := fmt.Sprintf("NovaNFT Login\nnonce: %s", user.Nonce)
	// prefixed 是以太坊个人签名前缀后的哈希，和 MetaMask personal_sign 规则匹配。
	prefixed := accounts.TextHash([]byte(message))

	// sig 是去掉 0x 前缀后的签名 hex 文本。
	sig := strings.TrimPrefix(strings.TrimSpace(signature), "0x")
	// sigBytes 是签名的 65 字节原始数据：r(32) + s(32) + v(1)。
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

	// pubKey 是从签名和消息哈希恢复出来的公钥。
	pubKey, err := crypto.SigToPub(prefixed, sigBytes)
	if err != nil {
		return "", nil, errors.New("签名校验失败")
	}
	// recoveredAddr 是恢复出来的钱包地址，必须和前端提交的钱包地址一致。
	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	if strings.ToLower(recoveredAddr.Hex()) != addr {
		return "", nil, errors.New("钱包地址与签名不匹配")
	}

	_ = s.db.Model(&user).Update("nonce", "")

	// token 是后端登录态，前端后续请求会放到 Authorization: Bearer 中。
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.ID,
		"exp":    time.Now().Add(24 * time.Hour).Unix(),
	})
	// signed 是最终返回给前端保存的 JWT 字符串。
	signed, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", nil, err
	}

	return signed, &user, nil
}

// UpdateProfile 更新用户昵称和头像；空字段不会覆盖原值。
func (s *AuthService) UpdateProfile(userID uint, username, avatar string) (*model.User, error) {
	// username/avatar 是前端提交的新资料值。
	username = strings.TrimSpace(username)
	avatar = strings.TrimSpace(avatar)
	if username == "" && avatar == "" {
		return nil, errors.New("没有可更新的资料字段")
	}

	// user 是当前要更新的用户记录。
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
