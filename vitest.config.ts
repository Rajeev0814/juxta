import { defineConfig } from 'vitest/config'

// The folder-compare engine (src/core) is pure Node and is unit-tested in
// isolation from Electron. Tests run in the node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true
  }
})
