import type { NextConfig } from "next";

const API_ORIGIN = process.env.SUBSPACEAD_API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
