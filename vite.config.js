import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, Vite y React Refresh inyectan scripts en línea que la
// Content-Security-Policy estricta bloquearía. La quitamos solo al servir;
// en el build de producción se mantiene intacta.
const stripCspInDev = () => ({
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, ''),
})

// base './' es imprescindible: en producción Electron carga el index.html
// desde el sistema de archivos (file://), no desde un servidor.
export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react(), stripCspInDev()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
