import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
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
