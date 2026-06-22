import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 4k+ logo SVGs under public/logos can overwhelm the dev file watcher on Windows.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/public/logos/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
