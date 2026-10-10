import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.MORPH_REVIEW === "1" ? ".next-review" : ".next",
  outputFileTracingRoot: process.cwd(),
  experimental: { proxyClientMaxBodySize: "24mb" },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8000"}/api/:path*` }];
  },
};
export default nextConfig;
