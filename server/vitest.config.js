/** @type {import('vitest').UserConfig} */
module.exports = {
  test: {
    globals: true,
    include: ['test/unit/**/*.{test,spec}.{js,ts}', 'utils/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['utils/**/*.{js,ts}', 'middleware/**/*.{js,ts}', 'services/**/*.{js,ts}'],
    },
  },
};
