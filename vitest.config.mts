import { defineConfig } from 'vitest/config';


// Unit tests only — the pure logic where a silent regression is expensive:
// timezone maths, the Google/ICS description builder, search ranking. Nothing
// here touches Supabase or the network, so the suite runs in CI with no
// credentials and no fixtures to drift.
export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
