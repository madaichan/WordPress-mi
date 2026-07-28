import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Dev server — proxy WP REST API requests during development
  server: {
    port: 3000,
    proxy: {
      '/wp-json': {
        target: 'http://localhost:8080', // Change to your WP dev URL
        changeOrigin: true,
      },
      '/wp-admin': {
        target: 'http://localhost:8080',
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
