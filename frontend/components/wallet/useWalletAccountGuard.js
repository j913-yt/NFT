"use client";

import { useEffect } from "react";
import { sameAddress } from "@/lib/wallet/session";

export default function useWalletAccountGuard({ address, clearLocalLogin, session }) {
  useEffect(() => {
    if (!session.loggedIn || !address || !session.account) {
      return;
    }
    if (!sameAddress(address, session.account)) {
      clearLocalLogin(false);
    }
  }, [address, clearLocalLogin, session.account, session.loggedIn]);
}
