// 本文件负责读取后端运行配置：优先加载 .env，再把数据库、JWT、合约地址和 IPFS 配置整理成 Config。
package config

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Config 保存后端启动时需要的全部配置项。
type Config struct {
	JWTSecret         string // JWT 签名密钥，用来生成和校验登录 token。
	MySQLHost         string // MySQL 主机地址。
	MySQLPort         int    // MySQL 端口号。
	MySQLUser         string // MySQL 用户名。
	MySQLPass         string // MySQL 密码。
	MySQLDB           string // 当前项目使用的数据库名。
	ActiveNFTContract string // 当前前后端正在使用的 NFT 合约地址，用于过滤旧合约数据。
	PinataJWT         string // Pinata JWT 鉴权方式，和 API Key/Secret 二选一即可。
	PinataAPIKey      string // Pinata API Key 鉴权方式的 key。
	PinataAPISecret   string // Pinata API Key 鉴权方式的 secret。
	IPFSGateway       string // IPFS 网关地址，用来把 cid 拼成浏览器能访问的 URL。
}

// collectDotEnvCandidates 从当前目录一路向上收集可能存在的 .env 路径。
func collectDotEnvCandidates() []string {
	seen := map[string]struct{}{} // seen 用来去重，避免同一个 .env 路径重复读取。
	var candidates []string       // candidates 是按优先级排列的候选 .env 文件列表。

	// add 清洗并加入一个候选路径；空路径和重复路径会被跳过。
	add := func(path string) {
		if path == "" {
			return
		}
		clean := filepath.Clean(path)
		if _, ok := seen[clean]; ok {
			return
		}
		seen[clean] = struct{}{}
		candidates = append(candidates, clean)
	}

	// wd 是当前运行目录；从不同目录启动后端时，都尽量找到项目里的 backend/.env。
	wd, err := os.Getwd()
	if err != nil || wd == "" {
		add(".env")
		add("backend/.env")
		return candidates
	}

	// dir 从当前目录开始逐级向父目录查找，兼容在 backend 或项目根目录启动服务。
	dir := wd
	for {
		add(filepath.Join(dir, ".env"))
		add(filepath.Join(dir, "backend", ".env"))

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return candidates
}

// loadDotEnvIfPresent 把找到的 .env 键值写入环境变量，但不会覆盖已经存在的系统环境变量。
func loadDotEnvIfPresent() {
	candidates := collectDotEnvCandidates() // candidates 是这次会尝试读取的 .env 路径列表。

	for _, file := range candidates {
		// f 是当前候选 .env 文件；打不开说明不存在或不可读，直接看下一个候选。
		f, err := os.Open(file)
		if err != nil {
			continue
		}

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}

			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue
			}

			key := strings.TrimSpace(parts[0]) // key 是等号左边的环境变量名。
			key = strings.TrimPrefix(key, "\uFEFF")
			if key == "" {
				continue
			}
			if _, exists := os.LookupEnv(key); exists {
				continue
			}

			value := strings.TrimSpace(parts[1]) // value 是等号右边的配置值，支持去掉首尾引号。
			if len(value) >= 2 {
				if (value[0] == '"' && value[len(value)-1] == '"') ||
					(value[0] == '\'' && value[len(value)-1] == '\'') {
					value = value[1 : len(value)-1]
				}
			}

			_ = os.Setenv(key, value)
		}

		_ = f.Close()
	}
}

// Load 从环境变量加载配置；没有配置时使用本地开发默认值。
func Load() *Config {
	loadDotEnvIfPresent()

	secret := os.Getenv("JWT_SECRET") // secret 用于 JWT 签名，生产环境应该在 .env 中显式配置。
	if secret == "" {
		secret = "dev-secret-change-in-prod"
	}

	host := os.Getenv("MYSQL_HOST") // host 是数据库服务地址。
	if host == "" {
		host = "127.0.0.1"
	}
	portStr := os.Getenv("MYSQL_PORT") // portStr 是字符串形式端口，下面会转成 int。
	port := 3306                       // port 是最终使用的 MySQL 端口。
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	user := os.Getenv("MYSQL_USER") // user 是数据库用户名。
	if user == "" {
		user = "root"
	}
	pass := os.Getenv("MYSQL_PASS") // pass 是数据库密码。
	if pass == "" {
		pass = "123456"
	}
	db := os.Getenv("MYSQL_DB") // db 是数据库名。
	if db == "" {
		db = "nft"
	}
	activeNFTContract := strings.TrimSpace(os.Getenv("ACTIVE_NFT_CONTRACT")) // activeNFTContract 用来只展示当前合约的数据。

	pinataJWT := os.Getenv("PINATA_JWT")              // pinataJWT 是 Pinata 的 JWT 鉴权凭证。
	pinataAPIKey := os.Getenv("PINATA_API_KEY")       // pinataAPIKey 是 Pinata API Key。
	pinataAPISecret := os.Getenv("PINATA_API_SECRET") // pinataAPISecret 是 Pinata API Secret。

	gateway := os.Getenv("IPFS_GATEWAY") // gateway 是把 ipfs://cid 转成 HTTPS 访问地址的网关。
	if gateway == "" {
		gateway = "https://gateway.pinata.cloud"
	}

	log.Printf("using mysql at %s", fmt.Sprintf("%s:%d/%s", host, port, db))

	return &Config{
		JWTSecret:         secret,
		MySQLHost:         host,
		MySQLPort:         port,
		MySQLUser:         user,
		MySQLPass:         pass,
		MySQLDB:           db,
		ActiveNFTContract: activeNFTContract,
		PinataJWT:         pinataJWT,
		PinataAPIKey:      pinataAPIKey,
		PinataAPISecret:   pinataAPISecret,
		IPFSGateway:       gateway,
	}
}
