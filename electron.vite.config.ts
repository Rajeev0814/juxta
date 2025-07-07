import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite splits the build into three targets: main, preload and renderer.
// The folder-compare engine runs in a worker thread, so we register it as a
// second rollup input for the main process and emit it next to the main bundle.
export default defineConfig({
  main: {
    // Bundle these into the main/worker output so the packaged app needs no
    // node_modules at runtime (electron + node built-ins stay external).
    plugins: [externalizeDepsPlugin({ exclude: ['picomatch', 'adm-zip', 'yaml', 'fast-xml-parser', 'strnum'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          compareWorker: resolve(__dirname, 'src/main/worker/compareWorker.ts')
        },
        output: {
          // Keep predictable file names so the main process can locate the worker.
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    // Bundle these into the main/worker output so the packaged app needs no
    // node_modules at runtime (electron + node built-ins stay external).
    plugins: [externalizeDepsPlugin({ exclude: ['picomatch', 'adm-zip', 'yaml', 'fast-xml-parser', 'strnum'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
