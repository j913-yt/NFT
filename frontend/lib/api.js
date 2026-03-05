import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: {
    "Content-Type": "application/json"
  }
});

// 简单把 token 存在 localStorage，用于后续扩展需要鉴权的接口
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("jwt_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export async function register(email, password, username, avatar) {
  const res = await api.post("/auth/register", {
    email,
    password,
    username,
    avatar
  });
  return res.data;
}

export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password });
  if (typeof window !== "undefined") {
    window.localStorage.setItem("jwt_token", res.data.token);
    window.localStorage.setItem(
      "current_user",
      JSON.stringify(res.data.user || {})
    );
  }
  return res.data;
}

export async function getNFTs(category) {
  const params = category ? { category } : undefined;
  const res = await api.get("/nfts", { params });
  return res.data.list || [];
}

export async function getNFTById(id) {
  const res = await api.get(`/nfts/${id}`);
  return res.data;
}

export async function createNFT(payload) {
  const res = await api.post("/nfts", payload);
  return res.data;
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post("/upload/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  const { url } = res.data;
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  return { url: fullUrl };
}

export async function createOrder(payload) {
  const res = await api.post("/orders", payload);
  return res.data;
}

export async function getWalletNonce(wallet) {
  const res = await api.get("/auth/wallet/nonce", { params: { wallet } });
  return res.data;
}

export async function walletLogin(wallet, signature) {
  const res = await api.post("/auth/wallet/login", { wallet, signature });
  if (typeof window !== "undefined") {
    window.localStorage.setItem("jwt_token", res.data.token);
    window.localStorage.setItem(
      "current_user",
      JSON.stringify(res.data.user || {})
    );
  }
  return res.data;
}

export async function updateProfile(payload) {
  const res = await api.put("/auth/profile", payload);
  if (typeof window !== "undefined") {
    const user = res.data.user || res.data;
    const raw = window.localStorage.getItem("current_user");
    let merged = user;
    if (raw) {
      try {
        const old = JSON.parse(raw);
        merged = { ...old, ...user };
      } catch {
        // ignore
      }
    }
    window.localStorage.setItem("current_user", JSON.stringify(merged));
  }
  return res.data;
}
