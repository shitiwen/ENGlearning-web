import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { deepSeekWordCardMiddleware } from './server/localAiMiddleware'
import { contentFeedMiddleware } from './server/feeds'
import { practiceFeedMiddleware } from './server/practice'

function localAiPlugin(supabaseUrl?:string, publishableKey?:string, practiceFeedUrl?:string):Plugin {
  const middleware = deepSeekWordCardMiddleware(supabaseUrl, publishableKey)
  const feeds = contentFeedMiddleware()
  const practice = practiceFeedMiddleware(practiceFeedUrl)
  const install = (server:{middlewares:{use:(handler:(...args:Parameters<typeof middleware>)=>void)=>void}}) => {
    server.middlewares.use((request,response,next) => { void feeds(request,response,next) })
    server.middlewares.use((request,response,next) => { void practice(request,response,next) })
    server.middlewares.use((request,response,next) => { void middleware(request,response,next) })
  }
  return { name:'english-loop-local-ai', configureServer:install, configurePreviewServer:install }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [localAiPlugin(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, env.PRACTICE_FEED_URL),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'English Loop · 英语输入训练',
        short_name: 'English Loop',
        description: '本地优先的每日英语输入与训练工具',
        theme_color: '#173c35',
        background_color: '#f5f2e9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wav,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html'
      }
    })
  ]
  }
})
