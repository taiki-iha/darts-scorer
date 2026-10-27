import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const BASE = '/darts-scorer/';

export default defineConfig(({ command, isPreview }) => ({
  // build と preview（ビルド結果の確認）は公開時と同じサブパスで配信する
  base: command === 'build' || isPreview ? BASE : '/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'DARTS SCORER',
        short_name: 'DARTS',
        description: '家で遊ぶダーツのスコア記録アプリ',
        lang: 'ja',
        display: 'standalone',
        orientation: 'any',
        background_color: '#05010f',
        theme_color: '#05010f',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
    }),
  ],
  test: { environment: 'node' },
}));
