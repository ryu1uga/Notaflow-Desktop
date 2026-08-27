// ============================================================
//  NotaFlow Desktop — proceso principal de Electron
//  Responsabilidades:
//   · crear la ventana
//   · persistir el estado en un JSON dentro de userData
//   · diálogos de exportar / importar
//   · notificaciones nativas del sistema
// ============================================================
import { app, BrowserWindow, ipcMain, dialog, shell, Notification, Menu, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { readFileSync, writeFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Solo se apunta al servidor de Vite cuando se arranca con `npm run dev`,
// que exporta NODE_ENV=development. Con `npm run start` (build + electron)
// no hay servidor: hay que cargar el dist ya construido.
const isPacked = app.isPackaged
const isDev = !isPacked && process.env.NODE_ENV === 'development'

// --- Rutas de datos -----------------------------------------
const dataFile = () => path.join(app.getPath('userData'), 'notaflow-data.json')
const firedFile = () => path.join(app.getPath('userData'), 'notaflow-fired.json')
const windowFile = () => path.join(app.getPath('userData'), 'notaflow-window.json')

let win = null

// ------------------------------------------------------------
//  Ventana: tamaño y posición
//  Se guardan en su propio JSON (no en los datos del usuario) para que
//  al reabrir la app quede como el usuario la dejó. La primera vez, sin
//  archivo que leer, arranca maximizada.
// ------------------------------------------------------------
function readWindowState() {
  try {
    const s = JSON.parse(readFileSync(windowFile(), 'utf8'))
    if (!Number.isFinite(s.width) || !Number.isFinite(s.height)) return null
    return s
  } catch {
    return null   // primera vez, archivo corrupto o sin permisos: valores por defecto
  }
}

// ¿La posición guardada sigue cayendo dentro de algún monitor conectado?
// Si se desenchufó la pantalla donde estaba, se ignora y vuelve al centro.
function enPantalla(b) {
  if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return false
  return screen.getAllDisplays().some(({ workArea: a }) => (
    b.x < a.x + a.width && b.x + b.width > a.x &&
    b.y < a.y + a.height && b.y + b.height > a.y
  ))
}

let guardarTimer = null

function saveWindowState() {
  if (!win || win.isDestroyed()) return
  // getNormalBounds da el tamaño "restaurado", no el de la pantalla completa,
  // que es justo lo que hay que recordar para cuando desmaximice.
  const b = win.getNormalBounds()
  try {
    writeFileSync(windowFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }))
  } catch {
    /* si no se puede escribir, la app sigue igual: solo no recuerda el tamaño */
  }
}

// Al arrastrar el borde llegan decenas de eventos: se guarda al parar.
const guardarLuego = () => {
  clearTimeout(guardarTimer)
  guardarTimer = setTimeout(saveWindowState, 400)
}

function createWindow() {
  const guardado = readWindowState()
  const recuperable = guardado != null && enPantalla(guardado)

  // Tamaño de respaldo cuando no hay nada guardado: nunca mayor que la pantalla.
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: recuperable ? guardado.width : Math.max(680, Math.min(1180, sw - 60)),
    height: recuperable ? guardado.height : Math.max(520, Math.min(820, sh - 60)),
    ...(recuperable ? { x: guardado.x, y: guardado.y } : {}),
    minWidth: 680,
    minHeight: 520,
    show: false,
    backgroundColor: '#f4f0e9',
    title: 'NotaFlow',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Sin estado guardado se abre maximizada; con él manda lo que dejó el usuario.
  if (!guardado || guardado.maximized) win.maximize()

  win.once('ready-to-show', () => win.show())

  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) win.on(ev, guardarLuego)
  win.on('close', saveWindowState)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Cualquier enlace externo se abre en el navegador, no dentro de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

// Menú mínimo en español (la barra queda oculta; se muestra con Alt).
function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(isPacked ? [] : [{ role: 'toggleDevTools', label: 'Herramientas de desarrollo' }]),
      ],
    },
  ]
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: 'Acerca de NotaFlow' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar NotaFlow' },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de NotaFlow' },
      ],
    })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ------------------------------------------------------------
//  Persistencia del estado
// ------------------------------------------------------------
ipcMain.handle('store:load', async () => {
  try {
    const raw = await fs.readFile(dataFile(), 'utf8')
    const data = JSON.parse(raw)
    return data && data.courses ? data : null
  } catch {
    return null // no existe todavía o está corrupto: se arranca vacío
  }
})

ipcMain.handle('store:save', async (_e, data) => {
  const file = dataFile()
  const tmp = `${file}.tmp`
  // Escritura atómica: primero el temporal, luego el rename.
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, file)
  return true
})

ipcMain.handle('store:path', async () => app.getPath('userData'))

// ------------------------------------------------------------
//  Exportar / Importar
// ------------------------------------------------------------
const backupName = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `notaflow-${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}.json`
}

ipcMain.handle('backup:export', async (_e, data) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Guardar copia de seguridad',
    defaultPath: path.join(app.getPath('documents'), backupName()),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (res.canceled || !res.filePath) return null
  await fs.writeFile(res.filePath, JSON.stringify(data, null, 2), 'utf8')
  return res.filePath
})

ipcMain.handle('backup:import', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Importar copia de seguridad',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (res.canceled || !res.filePaths?.length) return null
  const raw = await fs.readFile(res.filePaths[0], 'utf8')
  const data = JSON.parse(raw)
  if (!data || !Array.isArray(data.courses)) throw new Error('El archivo no tiene datos de NotaFlow.')
  return data
})

ipcMain.handle('backup:reveal', async (_e, filePath) => {
  if (filePath) shell.showItemInFolder(filePath)
})

// ------------------------------------------------------------
//  Notificaciones
//  El renderer manda la lista completa de avisos pendientes.
//  Un ticker revisa cada 30 s cuáles ya vencieron y los dispara.
//  Las claves ya disparadas se guardan para no repetir el aviso.
// ------------------------------------------------------------
let schedule = []          // [{ key, title, body, fireAt }]
let fired = new Set()
let ticker = null
const GRACE_MS = 3 * 24 * 60 * 60 * 1000 // no avisar de algo vencido hace más de 3 días

async function loadFired() {
  try {
    const raw = await fs.readFile(firedFile(), 'utf8')
    fired = new Set(JSON.parse(raw))
  } catch {
    fired = new Set()
  }
}

async function saveFired() {
  try {
    await fs.writeFile(firedFile(), JSON.stringify([...fired]), 'utf8')
  } catch { /* no crítico */ }
}

function tick() {
  if (!Notification.isSupported()) return
  const now = Date.now()
  let changed = false
  for (const item of schedule) {
    if (fired.has(item.key)) continue
    if (item.fireAt > now) continue
    if (now - item.fireAt > GRACE_MS) { fired.add(item.key); changed = true; continue }
    new Notification({
      title: item.title,
      body: item.body,
      icon: path.join(__dirname, '..', 'build', 'icon.png'),
    }).show()
    fired.add(item.key)
    changed = true
  }
  if (changed) saveFired()
}

ipcMain.handle('notify:schedule', async (_e, items) => {
  schedule = Array.isArray(items) ? items : []
  // Limpia las claves disparadas que ya no existen (evaluación borrada o con nota).
  const live = new Set(schedule.map((i) => i.key))
  let pruned = false
  for (const k of fired) if (!live.has(k)) { fired.delete(k); pruned = true }
  if (pruned) saveFired()
  tick()
  return schedule.length
})

ipcMain.handle('notify:test', async () => {
  if (!Notification.isSupported()) return false
  new Notification({
    title: 'NotaFlow',
    body: 'Los avisos están funcionando. Te recordaré tus evaluaciones.',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
  }).show()
  return true
})

ipcMain.handle('notify:supported', async () => Notification.isSupported())

// ------------------------------------------------------------
//  Ciclo de vida
// ------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })

  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId('com.ryuichi.notaflow')
    await loadFired()
    buildMenu()
    createWindow()
    ticker = setInterval(tick, 30_000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (ticker) clearInterval(ticker)
    if (process.platform !== 'darwin') app.quit()
  })
}
