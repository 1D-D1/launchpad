import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

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
