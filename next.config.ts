import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-expect-error - serverExternalPackages is the Turbopack-compatible config for Next.js 16
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;