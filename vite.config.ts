import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json'

const getGitHash = () => {
  try {
    return JSON.stringify(execSync('git rev-parse --short HEAD').toString().trim())
  } catch (error) {
    console.warn('Failed to retrieve commit hash:', error)
    return '"unknown"'
  }
}

const getAppVersion = () => {
  try {
    return JSON.stringify(packageJson.version)
  } catch (error) {
    console.warn('Failed to retrieve app version:', error)
    return '"unknown"'
  }
}

// https://vite.dev/config/
export default defineConfig({
  esbuild: {
    // Translation files are incrementally maintained and may contain duplicate keys.
    // Keep the last value instead of failing production builds.
    logOverride: { 'duplicate-object-key': 'warning' }
  },
  define: {
    'import.meta.env.GIT_COMMIT': getGitHash(),
    'import.meta.env.APP_VERSION': getAppVersion()
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-nostr': ['nostr-tools'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-avatar',
            '@radix-ui/react-scroll-area'
          ],
          // Heavy components that should be separate chunks
          'emoji-picker': ['emoji-picker-react'],
          'lightbox': ['yet-another-react-lightbox'],
          'editor': ['@tiptap/react', '@tiptap/starter-kit'],
          'qr': ['qr-code-styling', 'qr-scanner'],
          'markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize']
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg}'],
        globDirectory: 'dist/',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'JumbleKat',
        short_name: 'JumbleKat',
        icons: [
          {
            src: '/pwa-512x512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-192x192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-monochrome.svg?v=2',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'monochrome'
          }
        ],
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        description: packageJson.description
      }
    })
  ]
})
