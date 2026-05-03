"use client";

import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/notifications/NotificationIcons";
import NotificationPopover from "@/components/notifications/NotificationPopover";
import useNotificationCenter from "@/components/notifications/useNotificationCenter";

function UnreadBadge({ count }) {
  if (count <= 0) return null;

  return (
    <>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff658f] shadow-[0_0_0_4px_rgba(255,101,143,0.24)]" />
      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff5f87] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
        {count > 99 ? "99+" : count}
      </span>
    </>
  );
}

function useOutsideClose({ onClose, open, rootRef }) {
  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [onClose, open, rootRef]);
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const center = useNotificationCenter();
  const unreadCount = center.counts.unreadCount;

  useOutsideClose({
    onClose: () => setOpen(false),
    open,
    rootRef,
  });

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#86a4e746] bg-gradient-to-br from-[#162645] to-[#131f35] text-[#dce7ff] shadow-[0_10px_24px_rgba(6,12,22,0.4)] transition hover:border-[#8fb7ff77] hover:shadow-[0_10px_28px_rgba(63,123,255,0.3)]"
        title={center.wallet ? "通知中心" : "登录后查看通知"}
      >
        <BellIcon />
        <UnreadBadge count={unreadCount} />
      </button>

      {open && (
        <NotificationPopover
          {...center}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
