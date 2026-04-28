"use client";

import { Button, ScrollShadow } from "@nextui-org/react";
import { CATEGORY_TABS } from "@/lib/marketplace";

const ICONS = Object.freeze({
  all: "#",
  art: "A",
  music: "M",
  video: "V",
  other: "..."
});

function PillIcon({ id }) {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/15 text-[10px] font-black">
      {ICONS[id] || ICONS.other}
    </span>
  );
}

export default function NFTTypeTabs({
  selected = "all",
  onChange,
  items = CATEGORY_TABS,
  compact = false
}) {
  return (
    <ScrollShadow orientation="horizontal" hideScrollBar className="w-full max-w-full">
      <div className="flex min-w-max items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {items.map((item) => {
          const active = selected === item.id;
          return (
            <Button
              key={item.id}
              className="shrink-0 font-semibold"
              color={active ? "primary" : "default"}
              radius="full"
              size={compact ? "sm" : "md"}
              startContent={<PillIcon id={item.id} />}
              variant={active ? "flat" : "light"}
              onPress={() => onChange?.(item.id)}
            >
              {item.label}
            </Button>
          );
        })}
      </div>
    </ScrollShadow>
  );
}
