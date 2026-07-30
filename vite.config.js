import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Aucune infrastructure de test n'existait avant Vitest : ajouté
  // pour couvrir la logique pure (utils, data.js des tunnels) et
  // quelques rendus de composants clés. Le bloc `test` est ignoré par
  // `vite build`/`vite dev`, donc sans impact sur le site publié.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
