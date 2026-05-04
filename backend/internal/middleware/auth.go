// 本文件提供 JWT 登录鉴权中间件：从 Authorization 头解析 token，并把用户 ID 写入请求上下文。
package middleware

import (
	"context"
	"net/http"
	"strings"

	"nft-backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

// ctxKey 是 context key 的专用类型，避免和其他包使用普通字符串时发生冲突。
type ctxKey string

// userIDKey 是 Auth 中间件写入 context 的用户 ID 键。
const userIDKey ctxKey = "userId"

// UserIDFromContext 读取 Auth 中间件注入的当前登录用户 ID。
func UserIDFromContext(ctx context.Context) (uint, bool) {
	// v 是 context 里的原始值，需要断言成 uint 才能作为用户 ID 使用。
	v := ctx.Value(userIDKey)
	if v == nil {
		return 0, false
	}
	id, ok := v.(uint)
	return id, ok
}

// Auth 校验 Authorization: Bearer <token>，通过后才允许访问受保护接口。
func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// auth 是完整的 Authorization 头，格式必须是 Bearer 加 JWT。
			auth := r.Header.Get("Authorization")
			if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			// tokenStr 是去掉 Bearer 前缀后的 JWT 字符串。
			tokenStr := strings.TrimPrefix(auth, "Bearer ")
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			// claims 是 JWT 载荷，登录时写入的 userId 就在这里。
			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			rawID, ok := claims["userId"]
			if !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			// rawID 是 JWT 中的 userId 原始值；JSON 数字解析出来常见类型是 float64。
			var uid uint
			switch v := rawID.(type) {
			case float64:
				uid = uint(v)
			case int:
				uid = uint(v)
			default:
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			// ctx 是带用户 ID 的新 context，后面的 handler 可以通过 UserIDFromContext 获取登录用户。
			ctx := context.WithValue(r.Context(), userIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
