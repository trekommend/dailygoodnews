import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.goodnewsnetwork.org"
      },
      {
        protocol: "https",
        hostname: "positive.news"
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "cdn.pixabay.com"
      }
    ]
  }
};

export default nextConfig;