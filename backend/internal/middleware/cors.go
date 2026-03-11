package middleware

import "net/http"

// CORS is a simple dev-friendly CORS middleware.
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// dev: allow all origins, and reflect requested headers to avoid preflight mismatch.
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		reqHeaders := r.Header.Get("Access-Control-Request-Headers")
		if reqHeaders != "" {
			w.Header().Set("Access-Control-Allow-Headers", reqHeaders)
		} else {
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		w.Header().Add("Vary", "Origin")
		w.Header().Add("Vary", "Access-Control-Request-Method")
		w.Header().Add("Vary", "Access-Control-Request-Headers")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

