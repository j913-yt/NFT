"use client";

import { useCallback, useRef, useState } from "react";
import {
  buildCursorKey,
  buildNotificationKey,
  createDefaultCursor,
  createSafeCursor,
  readJSON,
  writeJSON,
} from "./notification-utils";
import {
  createIncomingNotifications,
  createNextCursor,
  mergeNotifications,
  normalizeList,
} from "./notification-state";

function useNotificationAtoms() {
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState("");

  return { error, items, lastSyncAt, refreshing, setError, setItems, setLastSyncAt, setRefreshing, setWallet, wallet };
}

function useNotificationRefs() {
  return {
    cursorRef: useRef(createDefaultCursor()),
    fetchingRef: useRef(false),
    itemsRef: useRef([]),
    walletRef: useRef(""),
  };
}

function useSetItemsSync({ itemsRef, setItems }) {
  return useCallback((nextItems) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, [itemsRef, setItems]);
}

function usePersistState() {
  return useCallback((targetWallet, nextItems, nextCursor) => {
    if (!targetWallet) return;
    writeJSON(buildNotificationKey(targetWallet), nextItems);
    writeJSON(buildCursorKey(targetWallet), nextCursor);
  }, []);
}

function useLoadStateForWallet({ cursorRef, setItemsSync }) {
  return useCallback((targetWallet) => {
    const savedItems = readJSON(buildNotificationKey(targetWallet), []);
    const savedCursor = readJSON(buildCursorKey(targetWallet), createDefaultCursor());
    cursorRef.current = createSafeCursor(savedCursor);
    setItemsSync(normalizeList(savedItems));
  }, [cursorRef, setItemsSync]);
}

function useSwitchWallet({
  cursorRef,
  loadStateForWallet,
  setError,
  setItemsSync,
  setWallet,
  walletRef,
}) {
  return useCallback((nextWallet) => {
    if (walletRef.current === nextWallet) return;
    walletRef.current = nextWallet;
    setWallet(nextWallet);
    setError("");

    if (!nextWallet) {
      cursorRef.current = createDefaultCursor();
      setItemsSync([]);
      return;
    }

    loadStateForWallet(nextWallet);
  }, [cursorRef, loadStateForWallet, setError, setItemsSync, setWallet, walletRef]);
}

function useApplySnapshot({ cursorRef, itemsRef, persistState, setItemsSync, setLastSyncAt }) {
  return useCallback(({ currentWallet, snapshot }) => {
    const cursor = cursorRef.current || createDefaultCursor();
    const nextCursor = createNextCursor({ cursor, ...snapshot });

    if (!cursor.initialized) {
      cursorRef.current = nextCursor;
      persistState(currentWallet, itemsRef.current, nextCursor);
      setLastSyncAt(new Date().toISOString());
      return;
    }

    const incoming = createIncomingNotifications({ ...snapshot, cursor });
    const nextItems = incoming.length
      ? mergeNotifications({ currentItems: itemsRef.current, incoming })
      : itemsRef.current;
    if (incoming.length) setItemsSync(nextItems);
    cursorRef.current = nextCursor;
    persistState(currentWallet, nextItems, nextCursor);
    setLastSyncAt(new Date().toISOString());
  }, [cursorRef, itemsRef, persistState, setItemsSync, setLastSyncAt]);
}

function useReadActions({ cursorRef, itemsRef, persistState, setItemsSync, walletRef }) {
  const markAllRead = useCallback(() => {
    if (!walletRef.current) return;
    const nextItems = itemsRef.current.map((item) => (item.read ? item : { ...item, read: true }));
    setItemsSync(nextItems);
    persistState(walletRef.current, nextItems, cursorRef.current);
  }, [cursorRef, itemsRef, persistState, setItemsSync, walletRef]);

  const clearRead = useCallback(() => {
    if (!walletRef.current) return;
    const nextItems = itemsRef.current.filter((item) => !item.read);
    setItemsSync(nextItems);
    persistState(walletRef.current, nextItems, cursorRef.current);
  }, [cursorRef, itemsRef, persistState, setItemsSync, walletRef]);

  const markOneRead = useCallback((targetId) => {
    if (!walletRef.current) return;
    const nextItems = itemsRef.current.map((item) =>
      item.id === targetId && !item.read ? { ...item, read: true } : item,
    );
    setItemsSync(nextItems);
    persistState(walletRef.current, nextItems, cursorRef.current);
  }, [cursorRef, itemsRef, persistState, setItemsSync, walletRef]);

  return { clearRead, markAllRead, markOneRead };
}

export default function useNotificationStore() {
  const atoms = useNotificationAtoms();
  const refs = useNotificationRefs();
  const setItemsSync = useSetItemsSync({ itemsRef: refs.itemsRef, setItems: atoms.setItems });
  const persistState = usePersistState();
  const loadStateForWallet = useLoadStateForWallet({ cursorRef: refs.cursorRef, setItemsSync });
  const switchWalletIfNeeded = useSwitchWallet({
    cursorRef: refs.cursorRef,
    loadStateForWallet,
    setError: atoms.setError,
    setItemsSync,
    setWallet: atoms.setWallet,
    walletRef: refs.walletRef,
  });
  const applySnapshot = useApplySnapshot({ ...refs, persistState, setItemsSync, setLastSyncAt: atoms.setLastSyncAt });
  const readActions = useReadActions({ ...refs, persistState, setItemsSync });

  return { ...atoms, ...refs, ...readActions, applySnapshot, switchWalletIfNeeded };
}
