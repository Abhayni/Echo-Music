import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiPort = Number(process.env.PORT || 4174)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": `http://localhost:${apiPort}`,
      "/ws": { target: `ws://localhost:${apiPort}`, ws: true },
    },
  },
})
