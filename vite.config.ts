import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * O caminho onde o app é servido.
 *
 * GitHub Pages publica em `/<nome-do-repo>/`, então o workflow passa
 * `BASE_PATH`. Vercel, Netlify e o servidor de desenvolvimento servem na raiz e
 * não precisam de nada. Manter isso configurável evita ter dois builds
 * diferentes.
 */
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Precisa do caminho completo: em subdiretório, 'index.html' sozinho
        // faz o service worker devolver 404 em links diretos.
        navigateFallback: `${base}index.html`,
      },
      manifest: {
        name: 'Pôquer — do vocabulário à mesa final',
        short_name: 'Pôquer',
        description:
          'Treino de Texas Hold\'em no-limit: vocabulário, ranking de mãos, pré-flop, pot odds, torneio contra bots e análise das suas mãos do PokerStars.',
        lang: 'pt-BR',
        theme_color: '#14171F',
        background_color: '#14171F',
        display: 'standalone',
        orientation: 'portrait',
        // `scope` define o que conta como "dentro do app" quando instalado.
        start_url: base,
        scope: base,
        categories: ['education', 'games'],
        icons: [
          // Relativos de propósito: o plugin prefixa com a base.
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
