import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`
});

function unwrapError(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }
  return (
    data?.message ||
    error?.message ||
    fallback ||
    "请求失败"
  );
}

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
  try {
    const res = await api.post("/auth/register", {
      email,
      password,
      username,
      avatar
    });
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "注册失败"));
  }
}

export async function login(email, password) {
  try {
    const res = await api.post("/auth/login", { email, password });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("jwt_token", res.data.token);
      window.localStorage.setItem(
        "current_user",
        JSON.stringify(res.data.user || {})
      );
    }
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "登录失败"));
  }
}

export async function getNFTs(categoryOrOptions) {
  try {
    let params = {};

    if (typeof categoryOrOptions === "string") {
      if (categoryOrOptions) {
        params.category = categoryOrOptions;
      }
    } else if (categoryOrOptions && typeof categoryOrOptions === "object") {
      const { category, listed } = categoryOrOptions;
      if (category) {
        params.category = category;
      }
      if (typeof listed === "boolean") {
        params.listed = listed;
      }
    }

    if (!Object.keys(params).length) {
      params = undefined;
    }

    const res = await api.get("/nfts", { params });
    return res.data.list || [];
  } catch (error) {
    throw new Error(unwrapError(error, "加载 NFT 列表失败"));
  }
}

export async function getNFTById(id) {
  try {
    const res = await api.get(`/nfts/${id}`);
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "加载 NFT 详情失败"));
  }
}

export async function createNFT(payload) {
  try {
    const res = await api.post("/nfts", payload);
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "创建 NFT 失败"));
  }
}

export async function updateNFTListing(id, payload) {
  try {
    const res = await api.patch(`/nfts/${id}/listing`, payload);
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "更新上架信息失败"));
  }
}

export async function uploadAvatar(file) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post("/upload/avatar", formData);
    const { url } = res.data;
    const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    return { url: fullUrl };
  } catch (error) {
    throw new Error(unwrapError(error, "头像上传失败"));
  }
}

export async function uploadNFTToIPFS({
  file,
  cover,
  name,
  description,
  category,
  onUploadProgress
}) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (cover) {
      formData.append("cover", cover);
    }
    formData.append("name", name || "未命名 NFT");
    formData.append("description", description || "");
    formData.append("category", category || "other");

    const res = await api.post("/ipfs/nft", formData, {
      onUploadProgress
    });
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "上传到 IPFS 失败"));
  }
}

export async function createOrder(payload) {
  try {
    const res = await api.post("/orders", payload);
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "下单失败"));
  }
}

export async function getMySoldOrders() {
  try {
    const res = await api.get("/orders/sold");
    return res.data.list || [];
  } catch (error) {
    throw new Error(unwrapError(error, "加载已售出订单失败"));
  }
}

export async function getMyBoughtOrders() {
  try {
    const res = await api.get("/orders/bought");
    return res.data.list || [];
  } catch (error) {
    throw new Error(unwrapError(error, "加载已购入订单失败"));
  }
}

export async function getNFTOrderHistory(nftId) {
  try {
    const res = await api.get(`/orders/nft/${nftId}`);
    return res.data.list || [];
  } catch (error) {
    throw new Error(unwrapError(error, "加载 NFT 交易记录失败"));
  }
}

export async function getWalletNonce(wallet) {
  try {
    const res = await api.get("/auth/wallet/nonce", { params: { wallet } });
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "获取 nonce 失败"));
  }
}

export async function walletLogin(wallet, signature) {
  try {
    const res = await api.post("/auth/wallet/login", { wallet, signature });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("jwt_token", res.data.token);
      window.localStorage.setItem(
        "current_user",
        JSON.stringify(res.data.user || {})
      );
    }
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "钱包登录失败"));
  }
}

export async function updateProfile(payload) {
  try {
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
          // ignore invalid cache
        }
      }
      window.localStorage.setItem("current_user", JSON.stringify(merged));
    }
    return res.data;
  } catch (error) {
    throw new Error(unwrapError(error, "更新资料失败"));
  }
}

