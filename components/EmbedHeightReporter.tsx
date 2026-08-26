"use client";

import { useEffect } from "react";
import {
  isEmbedded,
  measureEmbedHeight,
  reportEmbedHeight,
} from "@/lib/embed";

/**
 * When running inside an iframe (Framer), size the document to its content
 * (no internal scroll) and post the height to the parent so Framer can grow
 * the iframe and scroll the page instead.
 */
export default function EmbedHeightReporter() {
  useEffect(() => {
    if (!isEmbedded()) return;

    document.documentElement.classList.add("usd-embed");
    document.body.classList.add("usd-embed");

    let raf = 0;
    let last = 0;

    const publish = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const height = measureEmbedHeight();
        if (height === last) return;
        last = height;
        reportEmbedHeight(height);
      });
    };

    publish();

    const ro = new ResizeObserver(publish);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);

    const mo = new MutationObserver(publish);
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener("load", publish);
    window.addEventListener("resize", publish);

    // Late images / fonts / async leaderboard rows
    const timers = [0, 100, 300, 800, 1600].map((ms) =>
      window.setTimeout(publish, ms)
    );

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("load", publish);
      window.removeEventListener("resize", publish);
      timers.forEach(clearTimeout);
      document.documentElement.classList.remove("usd-embed");
      document.body.classList.remove("usd-embed");
    };
  }, []);

  return null;
}
