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

    // Observe content roots — not html — so iframe viewport resizes don't
    // re-inflate measured height when switching to a shorter page.
    const ro = new ResizeObserver(publish);
    const main = document.querySelector("main");
    if (main) ro.observe(main);
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement) ro.observe(child);
    }

    const mo = new MutationObserver(() => {
      const nextMain = document.querySelector("main");
      if (nextMain) ro.observe(nextMain);
      publish();
    });
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener("load", publish);

    const timers = [0, 100, 300, 800, 1600].map((ms) =>
      window.setTimeout(publish, ms)
    );

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("load", publish);
      timers.forEach(clearTimeout);
      document.documentElement.classList.remove("usd-embed");
      document.body.classList.remove("usd-embed");
      document.documentElement.style.height = "";
      document.body.style.height = "";
    };
  }, []);

  return null;
}
