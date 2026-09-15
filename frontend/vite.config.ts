import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.SOBA_API_TARGET || 'http://127.0.0.1:8080'
  const proxy = {
    '/v1': { target, ws: true },
    '/health': { target },
  }
  return {
    plugins: [react()],
    server: { port: 5174, strictPort: true, proxy },
    preview: { proxy },
  }
})
