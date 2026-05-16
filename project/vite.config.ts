import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/calendar': {
        target: 'https://calendar.google.com',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/calendar/, ''),
      },
      '/calendar/ical': {
        target: 'https://calendar.google.com',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/calendar\/ical/, ''),
      },
    },
  },
})
