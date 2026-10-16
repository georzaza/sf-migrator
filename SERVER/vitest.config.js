import { defineConfig } from 'vitest/config';

// Unit suite: the pure DSL transform engine. No database, fully deterministic.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/transform/**/*.test.js', 'test/expansion/**/*.test.js', 'test/reference/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: [
                'src/utils/transformTree.js',
                'src/utils/expressionParser.js',
                'src/utils/transformationRule.js',
            ],
        },
    },
});
