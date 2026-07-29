import { defineConfig } from 'vitest/config';
import path from 'path';

process.env.DATABASE_URL = 'postgresql://1shop:1shop_password@localhost:5432/1shop_test?schema=public';
process.env.AUTH_SECRET = 'change-me-to-a-random-secret-at-least-32-chars';
process.env.REDIS_URL = 'redis://localhost:6379';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '..', 'src') }
  }
});
