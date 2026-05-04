// NFT 详情页业务 Hook。
// 负责加载详情数据，并封装购买、上架、下架、读取链上版税等交互流程。
import { useEffect, useMemo, useState } from "react";

import {
  createOrder,
  getNFTById,
  getNFTOrderHistory,
  updateNFTListing,
} from "@/lib/api";
import {
  buyNFTWithWallet,
  delistNFTWithWallet,
  formatEth,
  getRoyaltyInfoOnChain,
  listNFTWithWallet,
} from "@/lib/web3";

import {
  applyTradeError,
  applyTradeStage,
  createFallbackRoyaltyInfo,
  createOrderHistoryEntry,
  createStageHandler,
  createTradeProgress,
} from "./detail-helpers";
import { hasWalletLogin, readCurrentUser } from "./detail-utils";

export function useNFTDetail(id) {
  const [nft, setNft] = useState(null);
  const [owner, setOwner] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [buying, setBuying] = useState(false);
  const [relisting, setRelisting] = useState(false);
  const [delisting, setDelisting] = useState(false);
  const [listingPrice, setListingPrice] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [tradeProgress, setTradeProgress] = useState(null);
  const [royaltyInfo, setRoyaltyInfo] = useState(null);

  useEffect(() => {
    setCurrentUser(readCurrentUser());
  }, []);

  useEffect(() => {
    if (!id) return;

    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setMessage("");
        setHistoryError("");
        const data = await getNFTById(id);
        if (!active) return;

        const detail = data.nft || data;
        setNft(detail);
        setOwner(data.owner || null);
        setListingPrice(Number(detail?.price || 0) > 0 ? String(detail.price) : "");
      } catch (err) {
        if (!active) return;
        setMessageType("error");
        setMessage(err.message || "加载失败");
      } finally {
        if (active) setLoading(false);
      }

      try {
        setLoadingHistory(true);
        const list = await getNFTOrderHistory(id);
        if (!active) return;
        setOrderHistory(list || []);
      } catch (err) {
        if (!active) return;
        setHistoryError(err.message || "加载交易记录失败");
      } finally {
        if (active) setLoadingHistory(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!nft?.tokenId) {
      setRoyaltyInfo(null);
      return;
    }

    let active = true;
    const loadRoyalty = async () => {
      try {
        const chainInfo = await getRoyaltyInfoOnChain({
          // 用后台保存的 tokenId 和价格查询链上版税；优先传 priceWei，避免 ETH 小数精度误差。
          contractAddress: nft.contract,
          tokenId: nft.tokenId,
          salePriceWei: nft.priceWei || "",
          salePriceEth: Number(nft.price || 0),
        });
        if (active) setRoyaltyInfo(chainInfo);
      } catch {
        if (active) setRoyaltyInfo(createFallbackRoyaltyInfo(nft));
      }
    };

    loadRoyalty();
    return () => {
      active = false;
    };
  }, [nft]);

  const isOwner = useMemo(() => {
    if (!currentUser?.id || !nft?.ownerId) return false;
    return Number(currentUser.id) === Number(nft.ownerId);
  }, [currentUser, nft]);

  const handleBuy = async () => {
    if (!nft) return;
    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法购买");
      return;
    }
    if (!hasWalletLogin()) {
      setMessageType("error");
      setMessage("请先连接钱包并完成登录后再购买");
      return;
    }

    setBuying(true);
    setMessage("");
    setTradeProgress(createTradeProgress("buy", "请在钱包中确认购买交易..."));

    try {
      const purchase = await buyNFTWithWallet({
        // 购买时会先读取链上 listing，再用 listing.priceWei 作为交易 value 调用 buy(tokenId)。
        contractAddress: nft.contract,
        tokenId: nft.tokenId,
        fallbackPriceWei: nft.priceWei || "0",
        fallbackPriceEth: Number(nft.price || 0),
        onStage: createStageHandler(setTradeProgress, "请在钱包中确认购买交易..."),
      });
      applyTradeStage(
        setTradeProgress,
        "sync",
        "链上确认完成，正在写入订单记录...",
        purchase.txHash,
      );

      const order = await createOrder({
        nftId: nft.id,
        priceWei: purchase.priceWei,
        price: purchase.priceEth,
        txHash: purchase.txHash,
      });

      applyTradeStage(
        setTradeProgress,
        "done",
        `购买完成，订单 #${order.id} 已创建`,
        purchase.txHash,
      );

      const feeBps = Number(royaltyInfo?.feeBps ?? nft.royaltyFeeBps ?? 0);
      const royaltyText =
        feeBps > 0
          ? `，本次交易版税约 ${formatEth(Number(royaltyInfo?.royaltyEth || 0))} ETH`
          : "";
      setMessageType("success");
      setMessage(`购买成功，订单号 #${order.id}${royaltyText}`);
      setOwner((prev) => ({ ...prev, wallet: purchase.account }));
      setNft((prev) =>
        prev
          ? {
              ...prev,
              ownerId: currentUser?.id || prev.ownerId,
              priceWei: "0",
              price: 0,
              priceUnit: "ETH",
            }
          : prev,
      );
      setListingPrice("");
      setCurrentUser(readCurrentUser());
      setOrderHistory((prev) => [
        createOrderHistoryEntry({ nft, order, owner, purchase }),
        ...prev,
      ]);
    } catch (err) {
      const errMessage = err.message || "购买失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      applyTradeError(setTradeProgress, errMessage);
    } finally {
      setBuying(false);
    }
  };

  const handleRelist = async () => {
    if (!nft) return;
    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法上架");
      return;
    }
    if (!hasWalletLogin()) {
      setMessageType("error");
      setMessage("请先连接钱包并完成登录后再上架");
      return;
    }

    const nextPrice = Number(listingPrice);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      setMessageType("error");
      setMessage("请输入大于 0 的 ETH 价格");
      return;
    }

    setRelisting(true);
    setMessage("");
    setTradeProgress(createTradeProgress("list", "请在钱包中确认上架交易..."));

    try {
      const listed = await listNFTWithWallet({
        // 上架会把 nextPrice 从 ETH 转成 wei，然后调用合约 listToken(tokenId, priceWei)。
        contractAddress: nft.contract,
        tokenId: nft.tokenId,
        priceEth: nextPrice,
        onStage: createStageHandler(setTradeProgress, "请在钱包中确认上架交易..."),
      });
      applyTradeStage(
        setTradeProgress,
        "sync",
        "链上确认完成，正在同步后台上架状态...",
        listed.txHash,
      );

      const updated = await updateNFTListing(nft.id, {
        priceWei: listed.priceWei,
        price: nextPrice,
        priceUnit: "ETH",
      });

      setNft(updated);
      applyTradeStage(
        setTradeProgress,
        "done",
        Number(nft.priceWei || 0) > 0 ? "上架价格已更新" : "NFT 已重新上架",
        listed.txHash,
      );
      setMessageType("success");
      setMessage(Number(nft.priceWei || 0) > 0 ? "上架价格已更新" : "NFT 已重新上架");
    } catch (err) {
      const errMessage = err.message || "上架失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      applyTradeError(setTradeProgress, errMessage);
    } finally {
      setRelisting(false);
    }
  };

  const handleDelist = async () => {
    if (!nft) return;
    if (!nft.tokenId) {
      setMessageType("error");
      setMessage("该 NFT 尚未上链，无法下架");
      return;
    }
    if (!hasWalletLogin()) {
      setMessageType("error");
      setMessage("请先连接钱包并完成登录后再下架");
      return;
    }
    if (!String(nft.priceWei || "").replace(/^0+/, "")) {
      setMessageType("error");
      setMessage("该 NFT 当前未上架");
      return;
    }

    setDelisting(true);
    setMessage("");
    setTradeProgress(createTradeProgress("delist", "请在钱包中确认下架交易..."));

    try {
      const delisted = await delistNFTWithWallet({
        // 下架只调用 cancelListing(tokenId)，不会销毁 NFT，也不会修改 tokenURI。
        contractAddress: nft.contract,
        tokenId: nft.tokenId,
        onStage: createStageHandler(setTradeProgress, "请在钱包中确认下架交易..."),
      });
      applyTradeStage(
        setTradeProgress,
        "sync",
        "链上确认完成，正在同步后台下架状态...",
        delisted.txHash,
      );

      const updated = await updateNFTListing(nft.id, {
        priceWei: "0",
        price: 0,
        priceUnit: "ETH",
      });

      setNft(updated);
      setListingPrice("");
      applyTradeStage(setTradeProgress, "done", "NFT 已下架", delisted.txHash);
      setMessageType("success");
      setMessage("NFT 已下架");
    } catch (err) {
      const errMessage = err.message || "下架失败，请稍后重试";
      setMessageType("error");
      setMessage(errMessage);
      applyTradeError(setTradeProgress, errMessage);
    } finally {
      setDelisting(false);
    }
  };

  return {
    buying, currentUser, delisting, handleBuy, handleDelist, handleRelist,
    historyError, isOwner, listingPrice, loading, loadingHistory, message,
    messageType, nft, orderHistory, owner, relisting, royaltyInfo,
    setListingPrice, tradeProgress,
  };
}
