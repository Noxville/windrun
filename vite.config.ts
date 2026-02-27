import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('d3')) return 'vendor-d3'
            if (id.includes('react') || id.includes('@tanstack')) return 'vendor-react'
            return 'vendor'
          }
          if (id.includes('/data/abilities') || id.includes('/data/heroes')) {
            return 'static-data'
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://api.windrun.io',
        changeOrigin: true,
        secure: true,
      },
      '/user': {
        target: 'https://api.windrun.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
