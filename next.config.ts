import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.goodnewsnetwork.org" },
      { protocol: "https", hostname: "positive.news" },
      { protocol: "https", hostname: "www.positive.news" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "cdn.pixabay.com" },
      { protocol: "https", hostname: "cdn.prod.website-files.com" },

      // Fox
      { protocol: "https", hostname: "a57.foxnews.com" },
      { protocol: "https", hostname: "static.foxnews.com" },

      // Washington Post / Arc / related image hosts
      { protocol: "https", hostname: "www.washingtonpost.com" },
      { protocol: "https", hostname: "arc-anglerfish-washpost-prod-washpost.s3.amazonaws.com" },
      { protocol: "https", hostname: "cloudfront-us-east-1.images.arcpublishing.com" },
      { protocol: "https", hostname: "images.arcpublishing.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;