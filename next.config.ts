import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Daily-submission uploads carry multiple files; the 1MB default is too low.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
