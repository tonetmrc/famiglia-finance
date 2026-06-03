import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// force rebuild: 2026-06-03
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
      }
    }
  }
})
