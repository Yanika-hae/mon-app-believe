import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Mêmes en-têtes de sécurité que sur l'hébergement (vercel.json) pour l'aperçu local et les tests de bout en bout : la CSP est ainsi vérifiée dans un vrai navigateur.
const headers: Record<string, string> = Object.fromEntries((JSON.parse(readFileSync('vercel.json', 'utf8')).headers?.[0]?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]))

export default defineConfig({
  preview: { headers },
  test: { environment: 'jsdom', include: ['src/**/*.test.tsx'] },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        id: '/', name: 'Believe', short_name: 'Believe', lang: 'fr', start_url: '/', scope: '/', display: 'standalone',
        description: 'Habitudes, sport, spiritualité et coaching IA.', background_color: '#0e0f1f', theme_color: '#44479a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'], navigateFallbackDenylist: [/^\/api\//], importScripts: ['sw-notify.js'] }
    })
  ]
})
