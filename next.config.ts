import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Disable ESLint during build (handled separately)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Allow external image domains for social previews
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  // Server-side packages that should not be bundled
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "bullmq",
    "ioredis",
    "@prisma/client",
    "prisma",
    "bcryptjs",
    "nodemailer",
    "cheerio",
  ],
};

export default nextConfig;
