import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource-variable/inter'
import '@fontsource-variable/sora'
import './styles.css'
import { seedDemo } from './lib/devSeed.js'

// Solo en desarrollo: http://localhost:5173/?seed llena la app con datos
// de ejemplo para trabajar en la interfaz sin crear cursos a mano.
if (import.meta.env.DEV && location.search.includes('seed')) seedDemo()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
