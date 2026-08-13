import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow embedding in Framer (and similar) iframes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.framer.app https://*.framer.website https://*.framer.com https://framer.com https://*.vercel.app;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
