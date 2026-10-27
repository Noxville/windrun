import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_PROXY_UA = 'local-windrun-development'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyHeaders = { 'User-Agent': env.WINDRUN_DEV_PROXY_UA || DEFAULT_PROXY_UA }

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
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
          headers: proxyHeaders,
        },
        '/user': {
          target: 'https://api.windrun.io',
          changeOrigin: true,
          secure: true,
          headers: proxyHeaders,
        },
      },
    },
  }
})
