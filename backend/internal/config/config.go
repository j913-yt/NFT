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

type Config struct {
	JWTSecret         string
	MySQLHost         string
	MySQLPort         int
	MySQLUser         string
	MySQLPass         string
	MySQLDB           string
	ActiveNFTContract string
	PinataJWT         string
	PinataAPIKey      string
	PinataAPISecret   string
	IPFSGateway       string
}

func collectDotEnvCandidates() []string {
	seen := map[string]struct{}{}
	var candidates []string

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

	wd, err := os.Getwd()
	if err != nil || wd == "" {
		add(".env")
		add("backend/.env")
		return candidates
	}

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

func loadDotEnvIfPresent() {
	candidates := collectDotEnvCandidates()

	for _, file := range candidates {
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

			key := strings.TrimSpace(parts[0])
			key = strings.TrimPrefix(key, "\uFEFF")
			if key == "" {
				continue
			}
			if _, exists := os.LookupEnv(key); exists {
				continue
			}

			value := strings.TrimSpace(parts[1])
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

// Load loads configuration from environment variables with sensible defaults.
func Load() *Config {
	loadDotEnvIfPresent()

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-in-prod"
	}

	host := os.Getenv("MYSQL_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	portStr := os.Getenv("MYSQL_PORT")
	port := 3306
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	user := os.Getenv("MYSQL_USER")
	if user == "" {
		user = "root"
	}
	pass := os.Getenv("MYSQL_PASS")
	if pass == "" {
		pass = "123456"
	}
	db := os.Getenv("MYSQL_DB")
	if db == "" {
		db = "nft"
	}
	activeNFTContract := strings.TrimSpace(os.Getenv("ACTIVE_NFT_CONTRACT"))

	pinataJWT := os.Getenv("PINATA_JWT")
	pinataAPIKey := os.Getenv("PINATA_API_KEY")
	pinataAPISecret := os.Getenv("PINATA_API_SECRET")

	gateway := os.Getenv("IPFS_GATEWAY")
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
