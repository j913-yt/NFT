// 本文件提供开发环境跨域中间件：允许前端从浏览器请求后端 API。
package middleware

import "net/http"

// CORS 给响应添加跨域头，并直接处理浏览器的 OPTIONS 预检请求。
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// origin 是浏览器请求来源；开发阶段直接回写来源，方便本地不同端口联调。
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		// reqHeaders 是预检请求声明的请求头，回写它可以避免浏览器因为头不匹配拦截请求。
		reqHeaders := r.Header.Get("Access-Control-Request-Headers")
		if reqHeaders != "" {
			w.Header().Set("Access-Control-Allow-Headers", reqHeaders)
		} else {
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		w.Header().Add("Vary", "Origin")
		w.Header().Add("Vary", "Access-Control-Request-Method")
		w.Header().Add("Vary", "Access-Control-Request-Headers")

		// OPTIONS 是浏览器预检请求，返回 204 即可，不进入真正业务 handler。
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
