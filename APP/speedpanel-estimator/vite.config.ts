import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Default (500kb) fires on every build -- the main bundle and the
    // pdf/xlsx export libraries are legitimately this size, not a
    // regression signal, so raise the threshold instead of chasing the
    // warning. Set comfortably above the current largest chunk (~825kb).
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
