import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
try {
  process.loadEnvFile(envPath);
} catch {
  // ignore if missing
}

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
