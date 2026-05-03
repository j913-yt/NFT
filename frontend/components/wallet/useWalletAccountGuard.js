"use client";

import { useEffect } from "react";
import { sameAddress } from "@/lib/wallet/session";

const DISCONNECTED_STATUS = "disconnected";

export default function useWalletAccountGuard({
  address,
  clearLocalLogin,
  session,
  status,
}) {
  useEffect(() => {
    if (!session.loggedIn) {
      return;
    }
    if (status === DISCONNECTED_STATUS) {
      clearLocalLogin(false);
      return;
    }
    if (!address || !session.account) {
      return;
    }
    if (!sameAddress(address, session.account)) {
      clearLocalLogin(false);
    }
  }, [address, clearLocalLogin, session.account, session.loggedIn, status]);
}
