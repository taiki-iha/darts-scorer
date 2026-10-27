import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/darts-scorer/' : '/',
  plugins: [preact()],
  test: { environment: 'node' },
}));
