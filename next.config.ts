import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.goodnewsnetwork.org" },
      { protocol: "https", hostname: "positive.news" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent your site from being embedded in iframes (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent browsers from MIME-sniffing responses
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control how much referrer info is sent
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features you don't need
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Basic XSS protection for older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;