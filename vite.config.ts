import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * N21 — per-vendor chunk splitting (bounded optimization node, 2026-08-02).
 *
 * The pre-split build emitted a single ~3,067 kB minified chunk (three + R3F +
 * rapier3d-compat glue + react). Grouping by top-level vendor gives cacheable
 * library chunks and attributes the bytes in the build table. This changes no
 * runtime behavior or authority boundary; it implements the code-splitting that
 * BOOTSTRAP.md deferred ("until real scene and asset boundaries exist").
 *
 * Deliberately NOT done here (documented in records/task-packets/N21-*.md):
 * - chunkSizeWarningLimit left at Vite's default so large chunks stay visible
 *   as evidence rather than being silently tolerated.
 * - No dependency removed/added: gsap and zustand are declared but uninstalled
 *   and unimported; changing the approved stack requires a charter decision.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/three/') || id.includes('three-stdlib')) {
            return 'three'
          }
          if (id.includes('@react-three')) return 'r3f'
          if (id.includes('@dimforge') || id.includes('rapier')) {
            return 'rapier'
          }
          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react'
          }
          return undefined
        },
      },
    },
  },
})
