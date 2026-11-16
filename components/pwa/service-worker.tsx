"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/workspace/offline";

/** Registers the offline service worker (production builds only). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const register = () => void registerServiceWorker();
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
