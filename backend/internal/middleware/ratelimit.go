package middleware

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateLimitEntry struct {
	count   int
	resetAt time.Time
}

func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	var mu sync.Mutex
	store := map[string]*rateLimitEntry{}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if limit <= 0 || window <= 0 {
				next.ServeHTTP(w, r)
				return
			}

			key := rateLimitKey(r)
			now := time.Now()

			mu.Lock()
			entry, ok := store[key]
			if !ok || now.After(entry.resetAt) {
				store[key] = &rateLimitEntry{
					count:   1,
					resetAt: now.Add(window),
				}
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

func rateLimitKey(r *http.Request) string {
	if uid, ok := UserIDFromContext(r.Context()); ok && uid > 0 {
		return fmt.Sprintf("user:%d", uid)
	}

	addr := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if addr != "" {
		parts := strings.Split(addr, ",")
		if len(parts) > 0 {
			return "ip:" + strings.TrimSpace(parts[0])
		}
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return "ip:" + host
	}
	if r.RemoteAddr != "" {
		return "ip:" + r.RemoteAddr
	}

	return "anonymous"
}
