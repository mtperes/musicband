import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CALENDAR_ICS_URL =
  'https://calendar.google.com/calendar/ical/1aa1550534d11c7cdfa85fbcbf1b0852806cdac52efb8e540d22ffdfbb3d6ea5%40group.calendar.google.com/public/basic.ics'

type Next = (err?: unknown) => void

function calendarProxyPlugin(): Plugin {
  const handle: (req: IncomingMessage, res: ServerResponse, next: Next) => void = (
    req,
    res,
    next,
  ) => {
    if (!req.url || !req.url.startsWith('/api/calendar')) {
      return next()
    }

    void (async () => {
      try {
        const upstream = await fetch(CALENDAR_ICS_URL, {
          headers: { Accept: 'text/calendar' },
        })

        if (!upstream.ok || !upstream.body) {
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(`Upstream error: ${upstream.status}`)
          return
        }

        const body = await upstream.text()
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Cache-Control', 'public, max-age=300')
        res.end(body)
      } catch (err) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(`Proxy error: ${(err as Error).message}`)
      }
    })()
  }

  return {
    name: 'calendar-proxy',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), calendarProxyPlugin()],
  server: {
    port: 5173,
  },
})
