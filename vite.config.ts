import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createApi } from './server/api.ts'
import { openStore } from './server/store.ts'

// En dev, la même API que le serveur de prod (server/index.ts), branchée dans Vite.
function sessionsApi(): Plugin {
  return {
    name: 'sessions-api',
    configureServer(server) {
      const api = createApi(openStore())
      server.middlewares.use((req, res, next) => void api(req, res, next))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), sessionsApi()],
})
