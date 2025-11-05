import {coverageConfigDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: [
      'test/**/*.js'
    ],
    coverage: {
      exclude: [
        ...coverageConfigDefaults.exclude,
        'example.js'
      ]
    }
  },
})
