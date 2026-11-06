import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Serves netlify/functions/rip.js during `npm run dev` so the frontend can call it without netlify-cli.
function netlifyFunctions(): Plugin {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use('/.netlify/functions/rip', async (req, res) => {
        try {
          const { default: rip } = await server.ssrLoadModule('/netlify/functions/rip.js')
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const controller = new AbortController()
          res.on('close', () => controller.abort())
          const headers = Object.entries(req.headers).flatMap(([key, value]) => value === undefined ? [] : [[key, String(value)] as [string, string]])
          const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET')
          const response: Response = await rip(new Request(new URL(req.originalUrl ?? '/', 'http://localhost'), {
            method: req.method, headers, body: hasBody ? new Uint8Array(Buffer.concat(chunks)) : undefined, signal: controller.signal,
          }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (response.body) Readable.fromWeb(response.body as NodeReadableStream).pipe(res)
          else res.end()
        } catch (error) {
          server.config.logger.error(`rip function failed: ${error instanceof Error ? error.stack : error}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ error: 'Local rip function crashed. Check the dev server log.' }))
        }
      })
    },
  }
}

export default defineConfig({ plugins: [react(), tailwindcss(), netlifyFunctions()] })
