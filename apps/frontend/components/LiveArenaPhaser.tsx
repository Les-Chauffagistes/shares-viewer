"use client";

import dynamic from "next/dynamic";

const LiveArenaPhaserInner = dynamic(() => import("./LiveArenaPhaserInner"), {
  ssr: false,
});

export function LiveArenaPhaser() {
  return <LiveArenaPhaserInner />;
}