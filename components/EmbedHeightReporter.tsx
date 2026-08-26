"use client";

import { useEffect } from "react";
import {
  isEmbedded,
  measureEmbedHeight,
  reportEmbedHeight,
} from "@/lib/embed";

/**
 * Content-sized iframe for Framer: no internal scroll. Parent scrolls.
 */
export default function EmbedHeightReporter() {
  useEffect(() => {
    if (!isEmbedded()) return;

    const html = document.documentElement;
    const body = document.body;
    html.classList.add("usd-embed");
    body.classList.add("usd-embed");

    let raf = 0;
    let last = 0;

    const publish = (force = false) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const height = measureEmbedHeight();
          if (!force && height === last) return;
          last = height;
          reportEmbedHeight(height);
        });
      });
    };

    const onLoad = () => publish(true);

    publish(true);

    const ro = new ResizeObserver(() => publish());
    const observeTree = () => {
      const root =
        document.querySelector("[data-embed-root]") ||
        document.querySelector("main") ||
        body;
      ro.observe(root);
      for (const child of Array.from(body.children)) {
        if (child instanceof HTMLElement) ro.observe(child);
      }
    };
    observeTree();

    const mo = new MutationObserver(() => {
      observeTree();
      publish();
    });
    mo.observe(body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    window.addEventListener("load", onLoad);

    const timers = [0, 50, 150, 400, 900, 1800, 3200].map((ms) =>
      window.setTimeout(() => publish(true), ms)
    );

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("load", onLoad);
      timers.forEach(clearTimeout);
      html.classList.remove("usd-embed");
      body.classList.remove("usd-embed");
      html.style.height = "";
      body.style.height = "";
    };
  }, []);

  return null;
}
