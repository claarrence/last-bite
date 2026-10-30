import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { createOneMapHandler } from './supabase/functions/_shared/onemap.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const handleOneMap = createOneMapHandler({
    email: env.ONEMAP_EMAIL,
    password: env.ONEMAP_PASSWORD,
    token: env.ONEMAP_TOKEN,
  })
  return {
    plugins: [
      vue(),
      vueDevTools(),
      {
        name: 'local-onemap-api',
        configureServer(server) {
          server.middlewares.use('/api/onemap', async (request, response) => {
            const result = await handleOneMap(
              new Request(`http://localhost/api/onemap${request.url}`, {
                method: request.method,
              }),
            )
            response.writeHead(result.status, Object.fromEntries(result.headers))
            response.end(await result.text())
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
