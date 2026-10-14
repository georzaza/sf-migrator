import { defineConfig } from 'vitest/config';

// Opt-in integration suite: runs the engine against real extracted stg1_* data.
// Enable with: npm run test:realdata  (sets TEST_DB=1; also pass SOURCE_ORG_ID / TARGET_ORG_ID).
export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/realdata/**/*.test.js'],
        testTimeout: 30000,
    },
});
