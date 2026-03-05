package config

import (
	"log"
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	JWTSecret string
	MySQLHost string
	MySQLPort int
	MySQLUser string
	MySQLPass string
	MySQLDB   string
}

// Load loads configuration from environment variables with sensible defaults.
func Load() *Config {
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

	log.Printf("using mysql at %s", fmt.Sprintf("%s:%d/%s", host, port, db))

	return &Config{
		JWTSecret: secret,
		MySQLHost: host,
		MySQLPort: port,
		MySQLUser: user,
		MySQLPass: pass,
		MySQLDB:   db,
	}
}

