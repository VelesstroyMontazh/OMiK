import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: process.env.NODE_ENV !== "production",
  // Билеты .xlsm >10MB: иначе Next обрезает body (proxy + middleware) → «Ошибка загрузки»
  experimental: {
    proxyClientMaxBodySize: "250mb",
  },
};

export default nextConfig;