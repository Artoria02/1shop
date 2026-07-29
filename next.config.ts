import { config } from "dotenv";
config({ path: "./infra/.env" });

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
};

export default nextConfig;