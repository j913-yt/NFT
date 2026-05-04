// 本文件提供内存限流中间件：按登录用户或 IP 统计窗口期内的请求次数。
package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// rateLimitEntry 保存某个用户或 IP 在一个限流窗口内的访问状态。
type rateLimitEntry struct {
	count   int       // 当前窗口内已经访问的次数。
	resetAt time.Time // 当前窗口结束时间，超过后重新计数。
}

// RateLimit 返回一个中间件，限制同一个 key 在 window 时间内最多请求 limit 次。
func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	// mu 保护 store，避免并发请求同时读写 map。
	var mu sync.Mutex
	// store 以内存保存限流状态；服务重启后会清空。
	store := map[string]*rateLimitEntry{}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// limit/window 小于等于 0 时表示不启用限流。
			if limit <= 0 || window <= 0 {
				next.ServeHTTP(w, r)
				return
			}

			// key 是当前请求的限流身份，优先用户 ID，其次 IP。
			key := rateLimitKey(r)
			// now 是当前时间，用来判断窗口是否过期。
			now := time.Now()

			mu.Lock()
			// entry 是当前 key 的计数记录；不存在或过期时创建新窗口。
			entry, ok := store[key]
			if !ok || now.After(entry.resetAt) {
				store[key] = &rateLimitEntry{
					count:   1,
					resetAt: now.Add(window),
				}
				// 顺手清理已经过期的 key，避免 store 长期增长。
				for k, v := range store {
					if now.After(v.resetAt) {
						delete(store, k)
					}
				}
				mu.Unlock()
				next.ServeHTTP(w, r)
				return
			}

			if entry.count >= limit {
				// retryAfter 告诉前端还要等多少秒才能再次请求。
				retryAfter := int(time.Until(entry.resetAt).Seconds())
				if retryAfter < 1 {
					retryAfter = 1
				}
				mu.Unlock()

				w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
				http.Error(w, "too many requests", http.StatusTooManyRequests)
				return
			}

			entry.count++
			mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}

// rateLimitKey 计算限流身份：已登录用户用 user:<id>，未登录请求用 ip:<address>。
func rateLimitKey(r *http.Request) string {
	if uid, ok := UserIDFromContext(r.Context()); ok && uid > 0 {
		return fmt.Sprintf("user:%d", uid)
	}

	// X-Forwarded-For 通常由代理写入，多个 IP 时第一个是客户端原始 IP。
	addr := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if addr != "" {
		parts := strings.Split(addr, ",")
		if len(parts) > 0 {
			return "ip:" + strings.TrimSpace(parts[0])
		}
	}

	// RemoteAddr 是 Go HTTP 服务看到的远端地址，通常格式是 ip:port。
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return "ip:" + host
	}
	if r.RemoteAddr != "" {
		return "ip:" + r.RemoteAddr
	}

	return "anonymous"
}
