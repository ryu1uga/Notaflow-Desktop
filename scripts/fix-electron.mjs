#!/usr/bin/env node
// ============================================================
//  Repara la instalación del binario de Electron sin descargar nada.
//
//  Por qué existe: en Windows es común que el antivirus interrumpa el
//  postinstall de Electron y deje node_modules/electron/dist a medias
//  (sin electron.exe y sin path.txt). El resultado es el error
//  "Electron failed to install correctly".
//
//  electron-builder guarda su propia copia del mismo zip en otra caché,
//  así que este script la busca y la extrae donde corresponde.
//
//  Uso:  node scripts/fix-electron.mjs [--quiet] [--force]
// ============================================================
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const quiet = process.argv.includes('--quiet')
const force = process.argv.includes('--force')
const log = (...a) => { if (!quiet) console.log(...a) }
const warn = (...a) => console.log(...a)

// El binario que buscamos según el sistema operativo.
const BIN = {
  win32: 'electron.exe',
  darwin: 'Electron.app/Contents/MacOS/Electron',
  linux: 'electron',
}[process.platform] || 'electron'

const electronDir = path.join(root, 'node_modules', 'electron')
const distDir = path.join(electronDir, 'dist')
const pathTxt = path.join(electronDir, 'path.txt')

function ok() {
  // Está bien instalado si existe path.txt y el binario al que apunta.
  if (!fs.existsSync(pathTxt)) return false
  const rel = fs.readFileSync(pathTxt, 'utf8').trim()
  if (!rel) return false
  return fs.existsSync(path.join(distDir, rel))
}

if (!fs.existsSync(electronDir)) {
  warn('· El paquete electron no está instalado. Corre `npm install` primero.')
  process.exit(0)
}

if (ok() && !force) {
  log('· Electron ya está bien instalado.')
  process.exit(0)
}

// Versión exacta que pide el proyecto.
let version
try {
  version = require(path.join(electronDir, 'package.json')).version
} catch {
  warn('· No pude leer la versión de electron.')
  process.exit(0)
}

const arch = process.arch === 'ia32' ? 'ia32' : process.arch // x64 | arm64 | ia32
const zipName = `electron-v${version}-${process.platform}-${arch}.zip`

// Cachés donde puede estar el zip ya descargado.
const home = os.homedir()
const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
const roots = process.platform === 'win32'
  ? [path.join(local, 'electron', 'Cache'), path.join(local, 'electron-builder', 'Cache', 'electron')]
  : process.platform === 'darwin'
    ? [path.join(home, 'Library', 'Caches', 'electron'), path.join(home, 'Library', 'Caches', 'electron-builder', 'electron')]
    : [path.join(home, '.cache', 'electron'), path.join(home, '.cache', 'electron-builder', 'electron')]

// Busca el zip recursivamente (las cachés a veces lo meten en subcarpetas con hash).
function findZip(dir, depth = 0) {
  if (depth > 3 || !fs.existsSync(dir)) return null
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return null }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isFile() && e.name === zipName) return full
    if (e.isDirectory()) {
      const found = findZip(full, depth + 1)
      if (found) return found
    }
  }
  return null
}

let zip = null
for (const r of roots) {
  zip = findZip(r)
  if (zip) break
}

if (!zip) {
  warn(`\n· No encontré ${zipName} en tus cachés locales.`)
  warn('  Busqué en:')
  roots.forEach((r) => warn(`    ${r}`))
  warn('\n  Opciones:')
  warn(`    1) Descarga el zip de https://github.com/electron/electron/releases/tag/v${version}`)
  warn(`       y déjalo en: ${roots[0]}`)
  warn('    2) Luego corre: npm run fix:electron')
  process.exit(0)
}

log(`· Encontré ${path.basename(zip)}`)
log(`  en ${path.dirname(zip)}`)
log('· Extrayendo…')

// Limpia lo que haya quedado a medias y extrae de nuevo.
try {
  fs.rmSync(distDir, { recursive: true, force: true })
} catch { /* puede no existir */ }
fs.mkdirSync(distDir, { recursive: true })

try {
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${distDir}' -Force`,
    ], { stdio: quiet ? 'ignore' : 'inherit' })
  } else {
    execFileSync('unzip', ['-o', '-q', zip, '-d', distDir], { stdio: quiet ? 'ignore' : 'inherit' })
  }
} catch (e) {
  warn(`· Falló la extracción: ${e.message}`)
  warn('  Si tienes antivirus activo, agrega una excepción para esta carpeta y reintenta.')
  process.exit(0)
}

// path.txt es lo que lee node_modules/electron/index.js para ubicar el binario.
fs.writeFileSync(pathTxt, BIN, 'utf8')

// En macOS y Linux el binario necesita permiso de ejecución.
if (process.platform !== 'win32') {
  try { fs.chmodSync(path.join(distDir, BIN), 0o755) } catch { /* no crítico */ }
}

if (ok()) {
  log(`· Listo. Electron ${version} quedó instalado en node_modules/electron/dist.`)
} else {
  warn('· La extracción terminó pero el binario no aparece.')
  warn('  Lo más probable es que tu antivirus lo esté borrando.')
  warn(`  Agrega una excepción para: ${distDir}`)
}
