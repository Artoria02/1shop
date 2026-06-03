import { defineConfig } from 'vitest/config';
import path from 'path';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.AUTH_SECRET = 'change-me-to-a-random-secret-at-least-32-chars';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  }
});
