type AppEnv = "development" | "test" | "production";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  appEnv: (process.env.APP_ENV ?? "development") as AppEnv,
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  authSecret: getRequiredEnv("AUTH_SECRET")
};