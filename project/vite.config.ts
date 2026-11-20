import { defineConfig, loadEnv, normalizePath, type Plugin } from 'vite'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { contactSettings, createNodeContactHandler } from './server/contact.ts'
import { createNodeCalendarHandler } from './server/calendar.ts'

const pdfjsDirectory = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
type Next = (err?: unknown) => void

function calendarProxyPlugin(): Plugin {
  const calendar = createNodeCalendarHandler()
  const handle: (req: IncomingMessage, res: ServerResponse, next: Next) => void = (
    req,
    res,
    next,
  ) => {
    if (req.url?.split('?')[0] !== '/api/calendar') {
      return next()
    }

    void calendar(req, res)
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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const contact = createNodeContactHandler(contactSettings(env, mode !== 'production' && env.CONTACT_EMAIL_TEST_MODE !== '0'))
  const contactPlugin: Plugin = {
    name: 'contact-email',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/contact') return next()
        void contact(request, response)
      })
    },
  }
  return {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.SUPABASE_PUBLIC_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLIC_ANON_KEY || ''),
  },
  plugins: [react(), tailwindcss(), calendarProxyPlugin(), contactPlugin, viteStaticCopy({ targets: ['cmaps', 'standard_fonts', 'wasm'].map((directory) => ({ src: normalizePath(join(pdfjsDirectory, directory, '*')), dest: `pdfjs/${directory}` })) })],
  server: {
    port: 5173,
  },
  }
})
