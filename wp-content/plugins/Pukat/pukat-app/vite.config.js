import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const wpProxyTarget = process.env.VITE_WP_PROXY_TARGET || 'http://localhost:8080'
const vitePort = Number(process.env.VITE_PORT || 3000)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Dev server — proxy WP REST API requests during development
  server: {
    host: '0.0.0.0',
    port: vitePort,
    strictPort: true,
    cors: true,
    proxy: {
      '/wp-json': {
        target: wpProxyTarget,
        changeOrigin: true,
      },
      '/wp-admin': {
        target: wpProxyTarget,
        changeOrigin: true,
      },
    },
  },

  base: './',

  build: {
    // Output directly to WordPress plugin assets/dist/
    outDir: resolve(__dirname, '../assets/dist'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.jsx'),
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
