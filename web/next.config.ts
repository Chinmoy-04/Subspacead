import type { NextConfig } from "next";

const API_ORIGIN = process.env.SUBSPACEAD_API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Phone / tunnel testing hits the dev server from a non-localhost Origin.
  // Without this, Next blocks /_next/* and the page never hydrates — Menu,
  // metric toggles, and other client controls look dead.
  allowedDevOrigins: [
    "127.0.0.1",
    "*.trycloudflare.com",
    "formal-contain-competitive-scores.trycloudflare.com",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Paper-setting fits (ViT-G, 30 rotations) can take minutes.
    proxyTimeout: 15 * 60 * 1000,
  },
  rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
