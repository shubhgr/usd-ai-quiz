"use client";

import { useEffect } from "react";
import { isEmbedded } from "@/lib/embed";

/**
 * Framer URL embed: fill the iframe and scroll inside it
 * (no AutoHeightEmbed / postMessage sizing).
 */
export default function EmbedHeightReporter() {
  useEffect(() => {
    if (!isEmbedded()) return;

    const html = document.documentElement;
    const body = document.body;
    html.classList.add("usd-embed");
    body.classList.add("usd-embed");

    return () => {
      html.classList.remove("usd-embed");
      body.classList.remove("usd-embed");
      html.style.height = "";
      body.style.height = "";
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, []);

  return null;
}
