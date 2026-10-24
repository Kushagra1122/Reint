import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
})

