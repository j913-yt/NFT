"use client";

import { useEffect, useState } from "react";
import { getNFTs, updateProfile } from "@/lib/api";

const BACKEND_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

const formatPrice = (value) => {
  if (!value) return "未定价";
  const num = Number(value);
  if (!isFinite(num) || num === 0) return "未定价";
  if (num < 0.00000001) return "< 0.00000001";
  return parseFloat(num.toFixed(8)).toString();
};

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("current_user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          setUser(u);
          setNewName(u.username || "");
        } catch {
          setUser(null);
        }
      }
    }
  }, []);

  useEffect(() => {
    const fetchNFTs = async () => {
      const list = await getNFTs();
      if (user?.id) {
        setNfts(list.filter((n) => n.ownerId === user.id));
      } else {
        setNfts([]);
      }
    };
    fetchNFTs();
  }, [user]);

  if (!user) {
    return (
      <div className="glass-panel mx-auto max-w-md px-6 py-6 text-sm text-slate-100">
        请先登录后再查看个人中心。
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row">
      <section className="glass-panel flex w-full flex-col gap-4 px-6 py-6 lg:w-72">
        {user.avatar ? (
          <img
            src={
              user.avatar.startsWith("/static/")
                ? `${BACKEND_BASE}${user.avatar}`
                : user.avatar
            }
            alt={user.username}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-lg font-semibold text-blue-700">
            {user.username?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <div className="text-sm">
          <p className="font-semibold text-slate-50">{user.username}</p>
          <p className="text-xs text-slate-300">{user.email || "未绑定邮箱"}</p>
          {user.wallet && (
            <p className="mt-1 break-all text-[11px] text-slate-400">
              钱包：{user.wallet}
            </p>
          )}
        </div>
        <div className="mt-2 text-xs text-slate-300 space-y-2">
          {editing ? (
            <>
              <label className="block text-[11px] text-slate-400">
                新用户名
              </label>
              <input
                className="w-full rounded-xl border border-slate-600/70 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-sky-400"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  className="btn-primary px-3 py-1.5 text-[11px]"
                  onClick={async () => {
                    if (!newName.trim()) return;
                    setSaving(true);
                    try {
                      await updateProfile({ username: newName.trim() });
                      const updated = { ...user, username: newName.trim() };
                      setUser(updated);
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                          "current_user",
                          JSON.stringify(updated)
                        );
                      }
                      setEditing(false);
                    } catch (err) {
                      alert(err.message || "更新用户名失败");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
                <button
                  type="button"
                  className="btn-outline px-3 py-1.5 text-[11px]"
                  onClick={() => {
                    setNewName(user.username || "");
                    setEditing(false);
                  }}
                >
                  取消
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="btn-outline px-3 py-1.5 text-[11px]"
              onClick={() => setEditing(true)}
            >
              修改用户名
            </button>
          )}
        </div>
      </section>

      <section className="glass-panel flex-1 px-6 py-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-100">
          我发布的 NFT
        </h2>
        {nfts.length === 0 ? (
          <p className="text-xs text-slate-300">
            还没有任何 NFT，可以先在「创建 NFT」页面铸造一件作品。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {nfts.map((nft) => (
              <div
                key={nft.id}
                className="glass-panel card-hover border border-white/10 bg-slate-950/70 p-3 text-xs"
              >
                {nft.imageUrl && (
                  <img
                    src={
                      nft.imageUrl.startsWith("/static/")
                        ? `${BACKEND_BASE}${nft.imageUrl}`
                        : nft.imageUrl
                    }
                    alt={nft.name}
                    className="mb-1 h-32 w-full rounded-md object-cover"
                  />
                )}
                <p className="text-sm font-semibold text-slate-50">
                  {nft.name}
                </p>
                <p className="line-clamp-2 text-[11px] text-slate-300">
                  {nft.description}
                </p>
                {nft.category && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    类别：{nft.category}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  价格：{formatPrice(nft.price)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

